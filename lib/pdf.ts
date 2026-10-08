import {normalizeRoll,type MarkRow} from './grades.ts';
export type TextLine={text:string;page:number;spans?:{start:number;end:number;x:number;width:number}[]};
export function parseLines(lines:TextLine[]){
 const totalColumns=new Map<number,{x:number;tolerance:number}>();
 for(const line of lines){for(const span of line.spans??[]){const label=line.text.slice(span.start,span.end),match=label.match(/\bTotal(?:\s+(?:Marks|Score))?\b/i);if(!match)continue;const center=match.index!+match[0].length/2;totalColumns.set(line.page,{x:span.x+span.width*center/Math.max(1,label.length),tolerance:Math.max(15,span.width/2+5)});}}
 let totalColumn:{x:number;tolerance:number}|undefined;

 const rows:MarkRow[]=[],issues:string[]=[],warnings:string[]=[];const seen=new Set<string>();let counts:number[]=[];
 const positions:(number[]|null)[]=[];
 for(const line of lines){
  let {text,page,spans}=line;
  totalColumn=totalColumns.get(page)??totalColumn;

  if(!/(?:PGP|ABM|IEP|PHD)\s*[\/ -]?\s*\d{2}\s*[\/ -]?\s*\d{3,}R?/i.test(text))continue;
  if(totalColumn&&spans){
   const candidates=[...text.matchAll(/\S+/g)].filter(token=>/^(?:\d+(?:\.\d+)?|AB|ABS|NA|--|-)$/i.test(token[0])).map(token=>{
    const center=token.index!+token[0].length/2,span=spans.find(s=>center>=s.start&&center<=s.end);
    return {token,x:span?span.x+span.width*(center-span.start)/Math.max(1,span.end-span.start):NaN};
   }).filter(candidate=>Number.isFinite(candidate.x)&&Math.abs(candidate.x-totalColumn!.x)<=totalColumn!.tolerance).sort((a,b)=>Math.abs(a.x-totalColumn!.x)-Math.abs(b.x-totalColumn!.x));
   if(!candidates.length){issues.push(`Page ${page}: could not identify the marks in the Total column.`);continue;}
   const token=candidates[0].token;text=text.slice(0,token.index!+token[0].length);
  }
  const m=text.match(/^(.*?)\b((?:PGP|ABM|IEP|PHD)\s*[\/ -]?\s*\d{2}\s*[\/ -]?\s*\d{3,}R?)\s+(.+)$/i);
  if(!m){issues.push(`Page ${page}: could not read a student row.`);continue;}
  const numbers=m[3].match(/(?:\s+|^)(?:\d+(?:\.\d+)?|AB|ABS|NA|--|-)(?=\s|$)/g);
  const tail=m[3].match(/\s+((?:(?:\d+(?:\.\d+)?|AB|ABS|NA|--|-)\s*)+)$/i);
  if(!tail||!numbers){issues.push(`Page ${page}: incomplete marks for ${m[2]}.`);continue;}
  const vals=tail[1].trim().split(/\s+/).map(x=>/^\d/.test(x)?Number(x):null),total=vals.at(-1);
  const name=m[3].slice(0,m[3].length-tail[0].length).trim(),roll=normalizeRoll(m[2]);
  if(total===null||total===undefined||!name||!/[A-Za-z]/.test(name)){issues.push(`Page ${page}: total marks missing for ${roll}.`);continue;}
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
type PdfTextItem={str:string;transform:number[];width:number;height:number};
const rollPattern=/(?:PGP|ABM|IEP|PHD)\s*[\/ -]?\s*\d{2}\s*[\/ -]?\s*\d{3,}R?/i;
export function pdfTextLines(items:PdfTextItem[],page:number):TextLine[]{
 const groups:{y:number;items:PdfTextItem[]}[]=[];
 for(const item of items.filter(item=>item.str?.trim())){
  const y=item.transform[5];let group=groups.find(g=>Math.abs(g.y-y)<3);
  if(!group){group={y,items:[]};groups.push(group);}group.items.push(item);
 }
 const groupText=(group:typeof groups[number])=>[...group.items].sort((a,b)=>a.transform[4]-b.transform[4]).map(item=>item.str).join(' ');
 const consumed=new Set<typeof groups[number]>();
 const nameless=groups.filter(group=>{const text=groupText(group),roll=text.match(rollPattern);return roll&&/^(?:\s+\d+(?:\.\d+)?)+$/.test(text.slice(roll.index!+roll[0].length));});
 for(const group of groups){
  if(!/^[A-Z][A-Z .'-]*$/i.test(groupText(group)))continue;
  const x=Math.min(...group.items.map(item=>item.transform[4]));
  const candidates=nameless.filter(target=>{
   if(Math.abs(target.y-group.y)>Math.max(...group.items.map(item=>item.height)))return false;
   const ordered=[...target.items].sort((a,b)=>a.transform[4]-b.transform[4]),roll=ordered.find(item=>rollPattern.test(item.str));
   const firstMark=ordered.find(item=>/^\d+(?:\.\d+)?$/.test(item.str)&&roll&&item.transform[4]>roll.transform[4]);
   return roll&&firstMark&&x>roll.transform[4]+roll.width&&x<firstMark.transform[4];
  });
  if(candidates.length===1){candidates[0].items.push(...group.items);consumed.add(group);}
 }

 for(const group of groups){
  // A vertically centered roll cell may sit on a separate baseline from its row.
  const text=groupText(group).trim(),roll=text.match(rollPattern);
  if(!roll||roll[0]!==text)continue;
  const height=Math.max(...group.items.map(item=>item.height));
  const candidates=groups.filter(other=>other!==group&&!consumed.has(other)&&Math.abs(other.y-group.y)<=height&&
   !rollPattern.test(groupText(other))&&/^\d+\s+[A-F]\s+\D.*\s+\d+(?:\.\d+)?\s*$/i.test(groupText(other)));
  // Never attach a roll to an ambiguous neighboring row.
  if(candidates.length!==1)continue;
  const target=candidates[0],x=Math.min(...group.items.map(item=>item.transform[4]));
  const ordered=[...target.items].sort((a,b)=>a.transform[4]-b.transform[4]);
  if(ordered.length<3||x<=ordered[1].transform[4]||x>=ordered[2].transform[4])continue;
  target.items.push(...group.items);consumed.add(group);
 }
 return groups.filter(group=>!consumed.has(group)).sort((a,b)=>b.y-a.y).map(group=>{
  let text='';const spans:NonNullable<TextLine['spans']>=[];
  for(const item of group.items.sort((a,b)=>a.transform[4]-b.transform[4])){if(text)text+=' ';const start=text.length;text+=item.str;spans.push({start,end:text.length,x:item.transform[4],width:item.width});}
  return {text,page,spans};
 });
}
export async function extractPdf(file:File){
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',document.baseURI).href;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true});
 const doc=await task.promise;
 const lines:TextLine[]=[];
 try{for(let p=1;p<=doc.numPages;p++){const content=await (await doc.getPage(p)).getTextContent();const items=content.items.filter((x:any)=>'str'in x) as PdfTextItem[];lines.push(...pdfTextLines(items,p));}}
 finally{await task.destroy();}
 const parsed=parseLines(lines);
 if(!lines.some(line=>(line.spans??[]).some(span=>/\bTotal(?:\s+(?:Marks|Score))?\b/i.test(line.text.slice(span.start,span.end)))))parsed.issues.push('Could not identify a Total Marks column heading. Upload a sheet with a clearly labelled total column; group numbers will not be used as marks.');
 const full=lines.map(l=>l.text).join('\n');const course=full.match(/Course\s*:?\s*(.+)/i)?.[1]?.trim();
 const columns=parsed.count===4&&/SUPPLY CHAIN ANALYTICS/i.test(full)?['Mid-Term (20)','Assignments / Quizzes / CP (20)','Project (30)','End-Term (30)']:Array.from({length:parsed.count},(_,i)=>`Component ${i+1}`);
 return {...parsed,columns,course,pages:Math.max(...lines.map(l=>l.page),1)};
}
