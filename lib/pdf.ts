import {normalizeRoll,type MarkRow} from './grades.ts';
export type TextLine={text:string;page:number;spans?:{start:number;end:number;x:number;width:number}[]};
export function parseLines(lines:TextLine[]){
 const rows:MarkRow[]=[],issues:string[]=[],warnings:string[]=[];const seen=new Set<string>();let counts:number[]=[];
 const positions:(number[]|null)[]=[];
 for(const {text,page,spans} of lines){
  if(!/(?:PGP|ABM)\s*[\/ ]?\s*\d{2}\s*[\/ ]?\s*\d{3,}R?/i.test(text))continue;
  const m=text.match(/^(.*?)\b((?:PGP|ABM)\s*[\/ ]?\s*\d{2}\s*[\/ ]?\s*\d{3,}R?)\s+(.+)$/i);
  if(!m){issues.push(`Page ${page}: could not read a student row.`);continue;}
  const numbers=m[3].match(/(?:\s+|^)(?:\d+(?:\.\d+)?|AB|ABS|NA|--|-)(?=\s|$)/g);
  const tail=m[3].match(/\s+((?:(?:\d+(?:\.\d+)?|AB|ABS|NA|--|-)\s*)+)$/i);
  if(!tail||!numbers){issues.push(`Page ${page}: incomplete marks for ${m[2]}.`);continue;}
  const vals=tail[1].trim().split(/\s+/).map(x=>/^\d/.test(x)?Number(x):null),total=vals.at(-1);
  const name=m[3].slice(0,m[3].length-tail[0].length).trim(),roll=normalizeRoll(m[2]);
  if(total===null||total===undefined||!name){issues.push(`Page ${page}: total marks missing for ${roll}.`);continue;}
  if(seen.has(roll)){issues.push(`Duplicate roll number ${roll}.`);continue;}seen.add(roll);
  const comps=vals.slice(0,-1);counts.push(comps.length);
  const offset=m.index!+m[0].length-tail[1].length;
  const centers=[...tail[1].matchAll(/\S+/g)].slice(0,-1).map(token=>{
   const center=offset+token.index!+token[0].length/2;
   const span=spans?.find(s=>center>=s.start&&center<=s.end);
   return span?span.x+span.width*(center-span.start)/Math.max(1,span.end-span.start):NaN;
  });
  positions.push(centers.every(Number.isFinite)?centers:null);
  rows.push({roll,name,section:m[1].match(/\b[A-F]\b/)?.[0]??'',components:comps,total});
 }
 let count=counts.length?Math.max(...counts):0;
 if(counts.some(n=>n!==count)){
  const complete=positions.filter((p):p is number[]=>p!==null&&p.length===count);
  const anchors=Array.from({length:count},(_,i)=>{const values=complete.map(p=>p[i]).sort((a,b)=>a-b);return values[Math.floor(values.length/2)];});
  const spacing=count>1?Math.min(...anchors.slice(1).map((x,i)=>x-anchors[i])):Infinity;
  const aligned=rows.map((row,i)=>{
   if(!positions[i]||!complete.length||spacing<=0)return null;
   const components:(number|null)[]=Array(count).fill(null),used=new Set<number>();
   for(let j=0;j<row.components.length;j++){
    const x=positions[i]![j],column=anchors.reduce((best,a,k)=>Math.abs(a-x)<Math.abs(anchors[best]-x)?k:best,0);
    if(used.has(column)||Math.abs(anchors[column]-x)>Math.min(12,spacing/3))return null;
    used.add(column);components[column]=row.components[j];
   }
   return components;
  });
  if(aligned.every(c=>c!==null)){
   rows.forEach((r,i)=>{r.components=aligned[i]!;});
   warnings.push('Blank mark cells were kept empty in their original columns. Grades use the printed total.');
  }else{
   rows.forEach(r=>{r.components=[];});count=0;
   warnings.push('Component columns could not be aligned reliably. Imported student names and printed totals; grades and report cards can still be calculated.');
  }
 }
 if(!rows.length)issues.push('No student rows were found. Upload a text-based result sheet with PGP or ABM roll numbers. Scanned PDFs need OCR before upload.');
 return {rows,issues,warnings,count};
}
export async function extractPdf(file:File){
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',document.baseURI).href;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true});
 const doc=await task.promise;
 const lines:TextLine[]=[];
 try{for(let p=1;p<=doc.numPages;p++){const content=await (await doc.getPage(p)).getTextContent();const items=content.items.filter((x:any)=>'str'in x&&x.str.trim()) as any[];const groups:{y:number;items:any[]}[]=[];for(const item of items){const y=item.transform[5];let group=groups.find(g=>Math.abs(g.y-y)<3);if(!group){group={y,items:[]};groups.push(group);}group.items.push(item);}for(const group of groups.sort((a,b)=>b.y-a.y)){let text='';const spans:NonNullable<TextLine['spans']>=[];for(const item of group.items.sort((a,b)=>a.transform[4]-b.transform[4])){if(text)text+=' ';const start=text.length;text+=item.str;spans.push({start,end:text.length,x:item.transform[4],width:item.width});}lines.push({text,page:p,spans});}}}
 finally{await task.destroy();}
 const parsed=parseLines(lines);const full=lines.map(l=>l.text).join('\n');const course=full.match(/Course\s*:?\s*(.+)/i)?.[1]?.trim();
 const columns=parsed.count===4&&/SUPPLY CHAIN ANALYTICS/i.test(full)?['Mid-Term (20)','Assignments / Quizzes / CP (20)','Project (30)','End-Term (30)']:Array.from({length:parsed.count},(_,i)=>`Component ${i+1}`);
 return {...parsed,columns,course,pages:Math.max(...lines.map(l=>l.page),1)};
}
