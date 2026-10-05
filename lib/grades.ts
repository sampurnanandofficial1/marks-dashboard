export type MarkRow={roll:string;name:string;section:string;components:(number|null)[];total:number};
export type Subject={id:string;name:string;term:number;credit:number;columns:string[];rows:MarkRow[];source:string;updatedAt:string|null};
export const bands:[number,string,number][]=[[.95,'A+',10],[.85,'A',9],[.75,'A-',8],[.5334,'B+',7],[.3168,'B',6],[.1002,'B-',5],[.05,'C+',4],[.025,'C',3],[.01,'C-',2],[0,'D',1]];
export const rollKey=(s:string)=>s.replace(/[^0-9]/g,'');
export function calculate(rows:MarkRow[]){
 const n=rows.length,avg=n?rows.reduce((s,r)=>s+r.total,0)/n:0;
 const sd=n?Math.sqrt(rows.reduce((s,r)=>s+(r.total-avg)**2,0)/n):0;
 const sorted=rows.map(r=>r.total).sort((a,b)=>a-b);
 return rows.map((r,i)=>{
  const rank=1+rows.filter(x=>x.total>r.total).length+rows.slice(i).filter(x=>x.total===r.total).length-1;
  const percentile=sd>0?Math.floor(((sorted.indexOf(r.total)+1)/(n+1)+1e-12)*1000)/1000:null;
  const band=percentile===null?null:bands.find(b=>percentile>=b[0])!;
  return {...r,rank,z:sd>0?(r.total-avg)/sd:null,percentile,grade:band?.[1]??null,point:band?.[2]??null,average:avg,cohort:n};
 });
}
export function validateSubject(s:Subject){
 if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100)throw Error('Enter a subject name (up to 100 characters).');
 if(!Number.isFinite(s.credit)||s.credit<0||s.credit>20)throw Error('Credit must be between 0 and 20.');
 if(!Number.isInteger(s.term)||s.term<1||s.term>6)throw Error('Select a term from 1 to 6.');
 if(!Array.isArray(s.rows)||s.rows.length<2||s.rows.length>2000)throw Error('A marks sheet needs between 2 and 2,000 students.');
 if(!Array.isArray(s.columns)||s.columns.length>30||s.columns.some(c=>typeof c!=='string'))throw Error('Invalid component headers.');
 const seen=new Set<string>();
 for(const r of s.rows){if(!r.name||!/^PGP[ /]?41[ /]?\d+$/i.test(r.roll)||!Number.isFinite(r.total)||r.total<0||r.total>1000||!Array.isArray(r.components)||r.components.length!==s.columns.length||r.components.some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>1000)))throw Error('Some student rows are incomplete or invalid.');const key=rollKey(r.roll);if(seen.has(key))throw Error('Duplicate student roll number: '+r.roll);seen.add(key);}
 return s;
}
