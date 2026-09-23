import { env } from 'cloudflare:workers';
import { applyAction, initialState, visibleState, isParent, names, DomainError, type Person, type State, type Action } from './domain';
import { settleCycles } from './cycles';
type Stored = {id:number;revision:number;data:string;credentials:string};
type Session = {token:string;profile:Person|null;expires:number;parent_until:number};
type Hash = {salt:string;hash:string};
type Credentials = {password:Hash;codes?:Record<Person,Hash>;pins?:Record<Person,Hash>;pendingCodes?:Record<Person,string[]>};
const animalIds=['bengal','panda','fox','otter','owl','frog','lion','bunny','koala','dog','penguin','flamingo'];
const db=()=>{if(!env.DB) throw new Error('storage unavailable');return env.DB;};
const json=(data:unknown,status=200,cookie?:string)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...(cookie?{'set-cookie':cookie}:{})}});
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(n=>n.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
async function digest(s:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}
async function passwordHash(value:string,salt=random()):Promise<Hash>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));return {salt,hash};}
async function matches(v:unknown,h:Hash){if(typeof v!=='string'||v.length>256)return false;const result=await passwordHash(v,h.salt);let mismatch=0;for(let i=0;i<h.hash.length;i++) mismatch|=h.hash.charCodeAt(i)^result.hash.charCodeAt(i);return mismatch===0;}
function validAnimalCode(value:unknown):value is string{return typeof value==='string'&&value.split('.').length===4&&value.split('.').every(x=>animalIds.includes(x));}
function makeAnimalCodes(){const result={} as Record<Person,string[]>;const used=new Set<string>();for(const p of Object.keys(names) as Person[]){let code:string[],key:string;do{code=[];while(code.length<4){const id=animalIds[crypto.getRandomValues(new Uint32Array(1))[0]%animalIds.length];if(!code.includes(id))code.push(id);}key=code.join('.');}while(used.has(key));used.add(key);result[p]=code;}return result;}
async function codeHashes(codes:Record<Person,string[]>){const result={} as Record<Person,Hash>;for(const p of Object.keys(names) as Person[])result[p]=await passwordHash(codes[p].join('.'));return result;}
function cookie(request:Request,value:string,maxAge:number|null=604800){return `txp_session=${value}; Path=/; HttpOnly; SameSite=Strict${maxAge===null?'':`; Max-Age=${maxAge}`}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
async function readSession(request:Request):Promise<Session|null>{const value=request.headers.get('cookie')?.match(/(?:^|;\s*)txp_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!value)return null;return db().prepare('SELECT * FROM sessions WHERE token = ? AND expires > ?').bind(await digest(value),Date.now()).first<Session>();}
async function newSession(request:Request,profile:Person|null,old?:Session|null){
  const value=random();
  // This is a shared home device: profiles stay open until someone locks or logs out.
  const persistent=true;
  const expires=Date.now()+365*86400000;
  const parentUntil=0;
  const statements=[db().prepare('INSERT INTO sessions (token, profile, expires, parent_until) VALUES (?, ?, ?, ?)').bind(await digest(value),profile,expires,parentUntil)];
  if(old)statements.push(db().prepare('DELETE FROM sessions WHERE token = ?').bind(old.token));
  statements.push(db().prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()));
  await db().batch(statements);
  return cookie(request,value,persistent?Math.max(0,Math.floor((expires-Date.now())/1000)):null);
}
async function limit(key:string){const now=Date.now();await db().prepare('INSERT INTO attempts (key, count, until) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN until <= ? THEN 1 ELSE count + 1 END, until = CASE WHEN until <= ? THEN ? ELSE until END').bind(key,now+15*60000,now,now,now+15*60000).run();const row=await db().prepare('SELECT count FROM attempts WHERE key = ?').bind(key).first<{count:number}>();if(row!.count>10)throw new DomainError('rate');}
function checkOrigin(r:Request){const origin=r.headers.get('origin');if(!origin||origin!==new URL(r.url).origin)throw new DomainError('origin');}
function setupAllowed(r:Request,body?:Record<string,unknown>){const host=new URL(r.url).hostname;const local=process.env.NODE_ENV!=='production'&&(host==='localhost'||host==='127.0.0.1');const secret=(env as unknown as Record<string,string>).TASK_XP_SETUP_TOKEN;return local||(typeof secret==='string'&&secret.length>=24&&body?.setupToken===secret);}
function responseState(row:Stored,s:Session|null){return {initialized:true,authenticated:!!s,profile:s?.profile??null,parentUntil:s?.parent_until??0,state:s?.profile?visibleState(JSON.parse(row.data),s.profile):null};}
export async function handle(request:Request){try{
  let row=await db().prepare('SELECT * FROM family WHERE id = 1').first<Stored>();
  const session=await readSession(request);
  if(row&&session?.profile){
    for(let retry=0;retry<5;retry++){
      const data=JSON.stringify(settleCycles(JSON.parse(row.data)));
      if(data===row.data)break;
      const result=await db().prepare('UPDATE family SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(data,row.revision).run();
      if(result.meta.changes){row={...row,data,revision:row.revision+1};break;}
      row=await db().prepare('SELECT * FROM family WHERE id = 1').first<Stored>();if(!row)throw new DomainError('missing');
      if(retry===4)throw new DomainError('conflict');
    }
  }
  if(request.method==='GET')return json(row?responseState(row,session):{initialized:false,localSetup:setupAllowed(request)});
  checkOrigin(request);
  const raw=await request.text();if(raw.length>16000)return json({error:'invalid'},413);
  let b:Record<string,unknown>;try{b=JSON.parse(raw);}catch{return json({error:'invalid'},400);}if(!b||typeof b!=='object')throw new DomainError('invalid');
  const op=b.op;const ip=request.headers.get('cf-connecting-ip')??'local';
  if(op==='setup'){
    if(row)throw new DomainError('already');if(!setupAllowed(request,b))throw new DomainError('setup');
    if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)throw new DomainError('password');
    const generated=makeAnimalCodes();
    const credentials:Credentials={password:await passwordHash(b.password),codes:await codeHashes(generated),pendingCodes:generated};
    const state=initialState();await db().prepare('INSERT INTO family (id, revision, data, credentials) VALUES (1, 0, ?, ?)').bind(JSON.stringify(state),JSON.stringify(credentials)).run();
    return json({ok:true,animalCodes:generated},200,await newSession(request,null));
  }
  if(!row)throw new DomainError('setup');
  if(op==='login'){
    await limit('login:'+await digest(ip));const cred:Credentials=JSON.parse(row.credentials);if(!await matches(b.password,cred.password))throw new DomainError('credentials');
    const reveal=cred.pendingCodes;if(reveal){delete cred.pendingCodes;await db().prepare('UPDATE family SET credentials = ? WHERE id = 1').bind(JSON.stringify(cred)).run();}
    return json({ok:true,...(reveal?{animalCodes:reveal}:{})},200,await newSession(request,null,session));
  }
  if(!session)return json({error:'session'},401);
  if(op==='logout'){await db().prepare('DELETE FROM sessions WHERE token = ?').bind(session.token).run();return json({ok:true},200,cookie(request,'',0));}
  if(op==='lock')return json({ok:true},200,await newSession(request,null,session));
  if(op==='unlock'){
    await limit('pin-auto:'+await digest(ip));
    const cred:Credentials=JSON.parse(row.credentials),stored=cred.codes??cred.pins;
    if(!stored)throw new DomainError('credentials');
    const found:Person[]=[];
    const candidate=b.code??b.pin;for(const p of Object.keys(names) as Person[])if(await matches(candidate,stored[p]))found.push(p);
    if(found.length===0)throw new DomainError('credentials');
    if(found.length>1)return json({needsProfile:true});
    return json({ok:true},200,await newSession(request,found[0],session));
  }
  if(op==='profile'){
    const p=b.profile as Person;if(!Object.hasOwn(names,p))throw new DomainError('invalid');await limit('pin:'+p+':'+await digest(ip));
    const cred:Credentials=JSON.parse(row.credentials),stored=cred.codes??cred.pins;if(!stored||!await matches(b.code??b.pin,stored[p]))throw new DomainError('credentials');
    return json({ok:true},200,await newSession(request,p,session));
  }
  if(!session.profile)return json({error:'session'},401);
  if(op==='security'){
    if(!isParent(session.profile))throw new DomainError('forbidden');const c:Credentials=JSON.parse(row.credentials);
    const stored=c.codes??c.pins;if(!stored)throw new DomainError('credentials');
    await limit('security:'+await digest(ip));if(!await matches(b.currentCode??b.currentPin,stored[session.profile]))throw new DomainError('credentials');
    if(typeof b.password==='string'&&b.password){if(b.password.length<10||b.password.length>128)throw new DomainError('password');c.password=await passwordHash(b.password);}
    if(b.profile){const p=b.profile as Person,code=b.code??b.pin;if(!Object.hasOwn(names,p)||!validAnimalCode(code))throw new DomainError('pin');for(const other of Object.keys(names) as Person[])if(other!==p&&await matches(code,stored[other]))throw new DomainError('pin');if(!c.codes)c.codes={} as Record<Person,Hash>;c.codes[p]=await passwordHash(code);}
    await db().batch([db().prepare('UPDATE family SET credentials = ? WHERE id = 1').bind(JSON.stringify(c)),db().prepare('DELETE FROM sessions WHERE token != ?').bind(session.token)]);return json({ok:true});
  }
  if(op==='export'){if(!isParent(session.profile))throw new DomainError('forbidden');return json({exportedAt:new Date().toISOString(),data:JSON.parse(row.data)});}
  if(op!=='action'||!b.action||typeof b.action!=='object')throw new DomainError('invalid');
  for(let retry=0;retry<5;retry++){
    const current=retry===0?row:await db().prepare('SELECT * FROM family WHERE id = 1').first<Stored>();if(!current)throw new DomainError('missing');
    const state=applyAction(JSON.parse(current.data) as State,session.profile,b.action as Action);
    const result=await db().prepare('UPDATE family SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(JSON.stringify(state),current.revision).run();
    if(result.meta.changes){return json({ok:true,state:visibleState(state,session.profile)});}
  }
  return json({error:'conflict'},409);
}catch(error){if(error instanceof DomainError)return json({error:error.code},error.code==='forbidden'?403:error.code==='rate'?429:400);console.error('Task XP API failure',error instanceof Error?error.message:'unknown');return json({error:'storage'},503);}}
