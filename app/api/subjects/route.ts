import seed from '@/lib/seed.json';
import {db,bucket} from '@/lib/store';
import {validateSubject,type Subject} from '@/lib/grades';
export async function GET(){try{const saved=await db().prepare('SELECT id,data FROM subjects').all<{id:string;data:string}>();const merged=new Map(seed.subjects.map(s=>[s.id,s]));for(const r of saved.results)merged.set(r.id,JSON.parse(r.data));return Response.json({subjects:[...merged.values()],actual:seed.actual});}catch(e){console.error(e);return Response.json({error:'Could not load saved marks. Please retry.'},{status:503});}}
export async function POST(req:Request){
 let pdfKey:string|null=null;
 try{
  if(Number(req.headers.get('content-length')??0)>25*1024*1024)return Response.json({error:'Choose a PDF smaller than 20 MB.'},{status:413});
  const form=await req.formData();const json=form.get('subject');if(typeof json!=='string')throw Error('Missing subject details.');
  const data=validateSubject(JSON.parse(json) as Subject);const id=String(data.id||crypto.randomUUID());if(id.length>100||/[\x00-\x1f]/.test(id))throw Error('Invalid subject identifier.');
  const file=form.get('pdf');if(file instanceof File&&file.size){if(file.size>20*1024*1024)throw Error('Choose a PDF smaller than 20 MB.');const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('The uploaded file is not a PDF.');pdfKey=`pdfs/${crypto.randomUUID()}.pdf`;await bucket().put(pdfKey,bytes,{httpMetadata:{contentType:'application/pdf'}});data.source=file.name;}
  const old=await db().prepare('SELECT pdf_key FROM subjects WHERE id=?').bind(id).first<{pdf_key:string|null}>();const updatedAt=new Date().toISOString();const subject={...data,id,updatedAt};
  await db().prepare('INSERT INTO subjects (id,data,pdf_key,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,pdf_key=excluded.pdf_key,updated_at=excluded.updated_at').bind(id,JSON.stringify(subject),pdfKey??old?.pdf_key??null,updatedAt).run();
  if(pdfKey&&old?.pdf_key)await bucket().delete(old.pdf_key).catch(e=>console.error('Previous PDF cleanup',e));
  return Response.json({subject});
 }catch(e){if(pdfKey)await bucket().delete(pdfKey).catch(()=>{});console.error(e);return Response.json({error:e instanceof Error?e.message:'The subject could not be saved.'},{status:400});}
}
