import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {validateSubject} from '../lib/grades.ts';
const root=process.env.DATA_DIR??'/data';
await fs.mkdir(root,{recursive:true});
const db=new DatabaseSync(root+'/marks.sqlite');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS subjects(id TEXT PRIMARY KEY,data TEXT NOT NULL,pdf_key TEXT,updated_at TEXT NOT NULL)');
const seed=JSON.parse(await fs.readFile(new URL('../lib/seed.json',import.meta.url)));
const password=process.env.ACCESS_CODE;if(!password)throw Error('ACCESS_CODE must be configured');
const expected=createHash('sha256').update(password).digest();
const allowed=new Set(['https://sampurnanandofficial1.github.io',...(process.env.EXTRA_ORIGINS??'').split(',').filter(Boolean)]);
createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&allowed.has(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(req.url==='/health')return send(200,{status:'ok'});
 if(origin&&!allowed.has(origin))return send(403,{error:'This origin is not allowed.'});
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 const token=(req.headers.authorization??'').replace(/^Bearer /,'');
 if(!timingSafeEqual(createHash('sha256').update(token).digest(),expected))return send(401,{error:'Enter the correct access code to open your marks.'});
 if(req.url!=='/api/subjects')return send(404,{error:'Not found.'});
 try{
  if(req.method==='GET'){const merged=new Map(seed.subjects.map(s=>[s.id,s]));for(const r of db.prepare('SELECT id,data FROM subjects').all())merged.set(r.id,JSON.parse(r.data));return send(200,{subjects:[...merged.values()],actual:seed.actual});}
  if(req.method!=='POST')return send(405,{error:'Method not allowed.'});
  const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>25*1024*1024)return send(413,{error:'Choose a PDF smaller than 20 MB.'});parts.push(chunk);}
  const request=new Request('http://internal/api/subjects',{method:'POST',headers:req.headers,body:Buffer.concat(parts)});
  const form=await request.formData();const data=validateSubject(JSON.parse(form.get('subject')));const id=String(data.id||randomUUID());if(id.length>100||/[\x00-\x1f]/.test(id))throw Error('Invalid subject identifier.');
  const file=form.get('pdf'),old=db.prepare('SELECT pdf_key FROM subjects WHERE id=?').get(id);let pdfKey=old?.pdf_key??null;
  if(file instanceof File&&file.size){if(file.size>20*1024*1024)throw Error('Choose a PDF smaller than 20 MB.');const bytes=Buffer.from(await file.arrayBuffer());if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('This file is not a PDF.');pdfKey=randomUUID()+'.pdf';await fs.writeFile(root+'/'+pdfKey,bytes);data.source=file.name;}
  const updatedAt=new Date().toISOString(),subject={...data,id,updatedAt};
  db.prepare('INSERT INTO subjects(id,data,pdf_key,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,pdf_key=excluded.pdf_key,updated_at=excluded.updated_at').run(id,JSON.stringify(subject),pdfKey,updatedAt);
  if(old?.pdf_key&&old.pdf_key!==pdfKey)await fs.unlink(root+'/'+old.pdf_key).catch(console.error);
  return send(200,{subject});
 }catch(e){console.error(e);return send(400,{error:e instanceof Error?e.message:'Could not save this subject.'});}
}).listen(Number(process.env.PORT??3000),'0.0.0.0',()=>console.log('Marks API is ready'));
