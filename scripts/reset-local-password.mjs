// Explicit local maintenance. Never exposes a reset endpoint in the app.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
const root='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const file=readdirSync(root).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite');
if(!file)throw new Error('Local database not found');
const db=new DatabaseSync(join(root,file));
const row=db.prepare('SELECT credentials, data FROM family WHERE id=1').get();
if(!row)throw new Error('No family configured');
const password=process.argv[2];
if(typeof password!=='string'||password.length<10)throw new Error('Pass a password with at least 10 characters');
const animalCodes={
  aina:['bengal','otter','fox','panda'],
  iara:['bunny','bengal','frog','penguin'],
  xavi:['lion','owl','bengal','dog'],
  mireia:['flamingo','koala','bengal','otter'],
};
const salt=randomBytes(32).toString('hex');
const credentials=JSON.parse(row.credentials);
credentials.password={salt,hash:pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')};
credentials.codes={};
for(const [person,animals] of Object.entries(animalCodes)){const codeSalt=randomBytes(32).toString('hex');credentials.codes[person]={salt:codeSalt,hash:pbkdf2Sync(animals.join('.'),codeSalt,100000,32,'sha256').toString('hex')};}
credentials.pendingCodes=animalCodes;
delete credentials.pins;
db.exec('BEGIN IMMEDIATE');
try{db.prepare('UPDATE family SET credentials=? WHERE id=1').run(JSON.stringify(credentials));db.exec('DELETE FROM sessions; DELETE FROM attempts; COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
if(db.prepare('SELECT data FROM family WHERE id=1').get().data!==row.data)throw new Error('Unexpected data change');
db.close();
console.log(JSON.stringify({password,animalCodes,dataPreserved:true,sessionsRevoked:true}));
