import type {MarkRow} from './grades';
export type TextLine={text:string;page:number};
export function parseLines(lines:TextLine[]){
 const rows:MarkRow[]=[],issues:string[]=[];const seen=new Set<string>();let counts:number[]=[];
 for(const {text,page} of lines){
  if(!/(?:PGP|ABM)\s*[\/ ]?\s*\d{2}\s*[\/ ]?\s*\d{3,}R?/i.test(text))continue;
  const m=text.match(/^(.*?)\b((?:PGP|ABM)\s*[\/ ]?\s*\d{2}\s*[\/ ]?\s*\d{3,}R?)\s+(.+)$/i);
  if(!m){issues.push(`Page ${page}: could not read a student row.`);continue;}
  const numbers=m[3].match(/(?:\s+|^)(?:\d+(?:\.\d+)?|AB|ABS|NA|--|-)(?=\s|$)/g);
  const tail=m[3].match(/\s+((?:(?:\d+(?:\.\d+)?|AB|ABS|NA|--|-)\s*)+)$/i);
  if(!tail||!numbers){issues.push(`Page ${page}: incomplete marks for ${m[2]}.`);continue;}
  const vals=tail[1].trim().split(/\s+/).map(x=>/^\d/.test(x)?Number(x):null),total=vals.at(-1);
  const name=m[3].slice(0,m[3].length-tail[0].length).trim(),roll=m[2].replace(/\s/g,'').toUpperCase().replace(/^(PGP|ABM)(\d{2})(\d{3,}R?)$/,'$1/$2/$3');
  if(total===null||total===undefined||!name){issues.push(`Page ${page}: total marks missing for ${roll}.`);continue;}
  if(seen.has(roll)){issues.push(`Duplicate roll number ${roll}.`);continue;}seen.add(roll);
  const comps=vals.slice(0,-1);counts.push(comps.length);
  rows.push({roll,name,section:m[1].match(/\b[A-F]\b/)?.[0]??'',components:comps,total});
 }
 const count=counts.length?Math.max(...counts):0;
 if(counts.some(n=>n!==count))issues.push('Some rows have a different number of mark components. Check the PDF layout.');
 if(!rows.length)issues.push('No student rows were found. Upload a text-based result sheet with PGP or ABM roll numbers. Scanned PDFs need OCR before upload.');
 return {rows,issues,count};
}
export async function extractPdf(file:File){
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',document.baseURI).href;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true});
 const doc=await task.promise;
 const lines:TextLine[]=[];
 try{for(let p=1;p<=doc.numPages;p++){const content=await (await doc.getPage(p)).getTextContent();const items=content.items.filter((x:any)=>'str'in x&&x.str.trim()) as any[];const groups:{y:number;items:any[]}[]=[];for(const item of items){const y=item.transform[5];let group=groups.find(g=>Math.abs(g.y-y)<3);if(!group){group={y,items:[]};groups.push(group);}group.items.push(item);}for(const group of groups.sort((a,b)=>b.y-a.y))lines.push({text:group.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' '),page:p});}}
 finally{await task.destroy();}
 const parsed=parseLines(lines);const full=lines.map(l=>l.text).join('\n');const course=full.match(/Course\s*:?\s*(.+)/i)?.[1]?.trim();
 const columns=parsed.count===4&&/SUPPLY CHAIN ANALYTICS/i.test(full)?['Mid-Term (20)','Assignments / Quizzes / CP (20)','Project (30)','End-Term (30)']:Array.from({length:parsed.count},(_,i)=>`Component ${i+1}`);
 return {...parsed,columns,course,pages:Math.max(...lines.map(l=>l.page),1)};
}
