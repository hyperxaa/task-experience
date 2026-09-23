import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

// Exercise the actual request handler against an isolated in-memory D1 adapter.
const sql=new DatabaseSync(':memory:');
sql.exec(readFileSync('drizzle/0000_massive_bloodstorm.sql','utf8'));
const adapter={prepare(query){let values=[];return {bind(...v){values=v;return this;},async first(){return sql.prepare(query).get(...values)??null;},async run(){const r=sql.prepare(query).run(...values);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){const out=[];for(const s of statements)out.push(await s.run());return out;}};
globalThis.__taskXpTestDB=adapter;
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const cycles=url(compile(readFileSync('lib/cycles.ts','utf8')));
const domain=url(compile(readFileSync('lib/domain.ts','utf8')).replace("from './cycles.ts'",`from '${cycles}'`));
const server=compile(readFileSync('lib/server.ts','utf8')).replace("import { env } from 'cloudflare:workers';",'const env={DB:globalThis.__taskXpTestDB};').replace("from './domain'",`from '${domain}'`).replace("from './cycles'",`from '${cycles}'`);
const {handle}=await import(url(server));
let cookie='';
async function request(body,{auth=true,origin='http://localhost',method='POST'}={}){
  const response=await handle(new Request('http://localhost/api/xp',{method,headers:{origin,...(auth?{cookie}:{}),'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
  const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
  return {status:response.status,data:await response.json(),setCookie};
}
const password='test-family-secret-2026';
let codes;

test('access lifecycle: remembered device, direct PIN, role boundaries and revocation',async()=>{
  const setup=await request({op:'setup',password});assert.equal(setup.status,200);codes=setup.data.animalCodes;
  const code=p=>codes[p].join('.');
  assert.equal((await request({op:'unlock',code:code('aina')},{auth:false})).status,401);
  assert.equal((await request({op:'login',password:'wrong',remember:true})).status,400);
  const login=await request({op:'login',password,remember:true});
  assert.equal(login.status,200);assert.match(login.setCookie,/Max-Age=3153\d+/);assert.match(login.setCookie,/HttpOnly; SameSite=Strict/);
  const old=cookie;
  const unlock=await request({op:'unlock',code:code('aina')});assert.equal(unlock.status,200);assert.notEqual(cookie,old);assert.match(unlock.setCookie,/Max-Age=/);
  const snapshot=await request(null,{method:'GET'});assert.equal(snapshot.data.profile,'aina');
  assert.equal((await request({op:'security',currentCode:code('aina'),password:'changed-password'})).status,403);
  await request({op:'lock'});assert.equal((await request(null,{method:'GET'})).data.profile,null);
  await request({op:'unlock',code:code('xavi')});assert.equal((await request(null,{method:'GET'})).data.profile,'xavi');
  assert.equal((await request({op:'security',currentCode:code('xavi'),profile:'iara',code:code('aina')})).data.error,'pin');
  const changedCode='bengal.flamingo.penguin.koala';
  const changed=await request({op:'security',currentCode:code('xavi'),profile:'iara',code:changedCode});assert.equal(changed.status,200);
  await request({op:'lock'});await request({op:'unlock',code:changedCode});assert.equal((await request(null,{method:'GET'})).data.profile,'iara');
  assert.equal((await request({op:'lock'},{origin:'http://evil.test'})).data.error,'origin');
  await request({op:'logout'});assert.equal((await request(null,{method:'GET'})).data.authenticated,false);
  const transient=await request({op:'login',password,remember:false});assert.equal(transient.status,200);assert.match(transient.setCookie,/Max-Age=3153\d+/);
  const remaining=sql.prepare('SELECT expires FROM sessions').get().expires-Date.now();assert.ok(remaining>360*86400000);
  await request({op:'login',password,remember:true});
  const optOut=await request({op:'login',password,remember:false});assert.match(optOut.setCookie,/Max-Age=3153\d+/);
  assert.ok(sql.prepare('SELECT expires FROM sessions').get().expires-Date.now()>360*86400000);
});

test('animal-code attempts are limited across all profiles',async()=>{
  sql.exec('DELETE FROM attempts');
  for(let i=0;i<10;i++)assert.equal((await request({op:'unlock',code:'fox.fox.fox.fox'})).status,400);
  assert.equal((await request({op:'unlock',code:codes.aina.join('.')})).status,429);
});

test('duplicate animal code never selects an arbitrary profile',async()=>{
  sql.exec('DELETE FROM attempts');
  const c=JSON.parse(sql.prepare('SELECT credentials FROM family').get().credentials);c.codes.iara=c.codes.aina;
  sql.prepare('UPDATE family SET credentials=?').run(JSON.stringify(c));
  await request({op:'lock'});
  assert.equal((await request({op:'unlock',code:codes.aina.join('.')})).data.needsProfile,true);
  assert.equal((await request(null,{method:'GET'})).data.profile,null);
});
