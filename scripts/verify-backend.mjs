import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const sample=process.argv[2];if(!sample)throw Error('Pass the SCAS sample PDF.');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'marks-backend-')),base='http://127.0.0.1:5101',headers={Authorization:'Bearer test-access-code',Origin:'https://sampurnanandofficial1.github.io'};let child;
async function start(){child=spawn(process.execPath,['--experimental-strip-types','backend/server.mjs'],{env:{...process.env,PORT:'5101',ACCESS_CODE:'test-access-code',DATA_DIR:temp},stdio:['ignore','pipe','inherit']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',code=>reject(Error('Server exited '+code)));});}
async function stop(){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}
try{
 await start();assert.equal((await fetch(base+'/api/subjects')).status,401);const response=await fetch(base+'/api/subjects',{headers});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),headers.Origin);const data=await response.json();assert.equal(data.subjects.length,26);const qam=data.subjects.find(s=>s.name==='QAM-3');const legacy=new FormData();legacy.set('subject',JSON.stringify({...qam,credit:1.25,rows:qam.rows.filter(r=>/^PGP[ /]?41[ /]?/i.test(r.roll))}));assert.equal((await fetch(base+'/api/subjects',{headers,method:'POST',body:legacy})).status,200);const restored=(await (await fetch(base+'/api/subjects',{headers})).json()).subjects.find(s=>s.id===qam.id);assert.equal(restored.rows.length,qam.rows.length);assert.equal(restored.credit,1.25);const scas=data.subjects.find(s=>s.id==='SCAS');const form=new FormData();form.set('subject',JSON.stringify({...scas,credit:1.5}));form.set('pdf',new File([await fs.readFile(sample)],'SCAS.pdf',{type:'application/pdf'}));assert.equal((await fetch(base+'/api/subjects',{headers,method:'POST',body:form})).status,200);
 await stop();await start();const second=await (await fetch(base+'/api/subjects',{headers})).json();assert.equal(second.subjects.find(s=>s.id==='SCAS').credit,1.5);assert.equal(second.subjects.find(s=>s.id==='SCAS').rows.length,117);assert.equal((await fs.readdir(temp)).filter(p=>p.endsWith('.pdf')).length,1);
 const bad=new FormData();bad.set('subject',JSON.stringify({...scas,credit:-1}));assert.equal((await fetch(base+'/api/subjects',{headers,method:'POST',body:bad})).status,400);assert.equal((await fetch(base+'/api/subjects',{headers:{...headers,Origin:'https://example.com'}})).status,403);
 console.log('Passed: authentication, CORS, PDF save, credit updates, invalid input rejection and persistence after restart.');
}finally{if(child&&!child.killed)await stop();await fs.rm(temp,{recursive:true,force:true});}
