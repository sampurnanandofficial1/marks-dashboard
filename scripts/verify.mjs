import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {calculate,rollKey,validateSubject,bands} from '../lib/grades.ts';
import {parseLines} from '../lib/pdf.ts';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const sample=process.argv[2];if(!sample)throw Error('Pass the SCAS sample PDF path as the first argument.');
const task=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(sample)),useSystemFonts:true});
const doc=await task.promise,lines=[];
for(let page=1;page<=doc.numPages;page++){
 const content=await (await doc.getPage(page)).getTextContent(),groups=[];
 for(const item of content.items.filter(i=>'str' in i&&i.str.trim())){
  const y=item.transform[5];let g=groups.find(g=>Math.abs(g.y-y)<3);
  if(!g){g={y,items:[]};groups.push(g);}g.items.push(item);
 }
 for(const g of groups.sort((a,b)=>b.y-a.y))lines.push({page,text:g.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ')});
}
await task.destroy();
const parsed=parseLines(lines);
assert.equal(parsed.rows.length,117);assert.deepEqual(parsed.issues,[]);assert.equal(parsed.count,4);
const seed=JSON.parse(await fs.readFile(new URL('../lib/seed.json',import.meta.url)));
const scas=seed.subjects.find(s=>s.name==='SCAS'),map=new Map(scas.rows.map(r=>[rollKey(r.roll),r]));
for(const r of parsed.rows){const s=map.get(rollKey(r.roll));assert(s);assert.equal(r.name,s.name);assert.equal(r.total,s.total);assert.deepEqual(r.components,s.components);}
assert.equal(parsed.rows.find(r=>rollKey(r.roll)==='41221').total,69);
const calc=calculate(parsed.rows);const me=calc.find(r=>rollKey(r.roll)==='41221');assert.equal(me.grade,'B-');assert.equal(me.point,5);
const rows=[1,2,2,3].map((total,i)=>({total,name:'Test '+i,roll:'PGP/41/00'+i,section:'A',components:[]}));
assert.deepEqual(calculate(rows).map(r=>r.rank),[4,3,2,1]);
assert.deepEqual(calculate(rows).map(r=>r.percentile),[.2,.4,.4,.8]);
assert.equal(calculate(rows).reduce((s,r)=>s+r.z,0),0);
assert(calculate(rows.map(r=>({...r,total:2}))).every(r=>r.z===null&&r.grade===null));
for(const [threshold,grade,point] of bands){assert.equal(bands.find(b=>threshold>=b[0])[1],grade);assert.equal(bands.find(b=>threshold>=b[0])[2],point);}
assert.throws(()=>validateSubject({...scas,rows:[scas.rows[0],scas.rows[0]]}),/Duplicate/);
assert.throws(()=>validateSubject({...scas,credit:-1}),/Credit/);
const mine=seed.subjects.map(s=>({...s,result:calculate(s.rows).find(r=>rollKey(r.roll)==='41221')}));
const credits=mine.filter(s=>s.result?.point!=null).reduce((a,s)=>a+s.credit,0);
const points=mine.filter(s=>s.result?.point!=null).reduce((a,s)=>a+s.credit*s.result.point,0);
const actualCredit=seed.actual.reduce((a,r)=>a+r.credit,0),actual=seed.actual.reduce((a,r)=>a+r.credit*r.point,0)/actualCredit;
assert(Math.abs(actual-5.756756756756757)<1e-10);
console.log(JSON.stringify({subjects:seed.subjects.length,pdfRows:parsed.rows.length,SCAS:me,estimatedCGPA:points/credits,recordedCGPA:actual,tests:'passed'},null,2));
