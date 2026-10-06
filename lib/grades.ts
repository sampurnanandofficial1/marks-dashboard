export type MarkRow={roll:string;name:string;section:string;components:(number|null)[];total:number};
export type Subject={id:string;name:string;term:number;credit:number;columns:string[];rows:MarkRow[];source:string;updatedAt:string|null};
export const bands:[number,string,number][]=[[.95,'A+',10],[.85,'A',9],[.75,'A-',8],[.5334,'B+',7],[.3168,'B',6],[.1002,'B-',5],[.05,'C+',4],[.025,'C',3],[.01,'C-',2],[0,'D',1]];
export const rollKey=(s:string)=>s.replace(/[^0-9]/g,'');
export const normalizeRoll=(s:string)=>s.replace(/\s/g,'').toUpperCase().replace(/^(PGP|ABM)[ /]?(\d{2})[ /]?(\d+R?)$/,'$1/$2/$3');
// Excel PERCENTRANK.EXC with the omitted significance argument (three decimals).
export function percentRankExc(values:number[],x:number):number|null{
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!sorted.length||!Number.isFinite(x)||x<sorted[0]||x>sorted[sorted.length-1])return null;
 const exact=sorted.indexOf(x);
 let rank:number;
 if(exact>=0)rank=(exact+1)/(sorted.length+1);
 else{
  const upper=sorted.findIndex(v=>v>x),lower=upper-1;
  rank=(lower+1+(x-sorted[lower])/(sorted[upper]-sorted[lower]))/(sorted.length+1);
 }
 return Math.floor((rank+Number.EPSILON)*1000)/1000;
}
export function gradeFromPercentile(percentile:number|null){
 return percentile===null?null:bands.find(b=>percentile>=b[0])?.[1]??'D';
}
export function gradePoint(grade:string|null){
 return grade===null?null:bands.find(b=>b[1]===grade)?.[2]??0;
}
export function calculate(rows:MarkRow[]){
 const n=rows.length,avg=n?rows.reduce((s,r)=>s+r.total,0)/n:0;
 const sd=n?Math.sqrt(rows.reduce((s,r)=>s+(r.total-avg)**2,0)/n):0;
 const zScores=rows.map(r=>sd>0?(r.total-avg)/sd:null);
 const numericZ=zScores.filter((z):z is number=>z!==null);
 return rows.map((r,i)=>{
  // RANK.EQ(total, totals, 0) + COUNTIF(current row through last row, total) - 1.
  const rank=1+rows.filter(x=>x.total>r.total).length+rows.slice(i).filter(x=>x.total===r.total).length-1;
  const z=zScores[i],percentile=z===null?null:percentRankExc(numericZ,z);
  const grade=gradeFromPercentile(percentile);
  return {...r,rank,z,percentile,grade,point:gradePoint(grade),error:sd===0?'#DIV/0!':null,average:avg,cohort:n};
 });
}
// Excel XLOOKUP(..., name column, result column, "N/A", 0): case-insensitive,
// exact name comparison, first match in the unchanged source row order.
export function lookupResult(rows:ReturnType<typeof calculate>,name:string){
 return rows.find(r=>r.name.toLowerCase()===name.toLowerCase());
}
export function weightedGpa(entries:{credit:number;point:number|null|undefined}[]){
 const credit=entries.reduce((s,e)=>s+e.credit,0);
 if(!credit||entries.some(e=>e.credit>0&&e.point==null))return null;
 const weighted=entries.reduce((s,e)=>s+e.credit*(e.point??0),0);
 return weighted/(credit*10)*10;
}
export const term4Subjects=[{name:'ESGMR',credit:1},{name:'ECT',credit:1},{name:'HFS',credit:1},{name:'Strat All',credit:1},{name:'SM-2',credit:0},{name:'SCAS',credit:1},{name:'TIDPBM',credit:1}];
export function applyReportCredits(subjects:Subject[]):Subject[]{
 return subjects.map(s=>s.name.trim().toLowerCase()==='esgmr'?{...s,term:4,credit:1}:s);
}
const nameKey=(name:string)=>name.trim().replace(/\s+/g,' ').toLowerCase();
export function studentReport(subjects:Subject[],name:string){
 return applyReportCredits(subjects).flatMap(s=>{
  const rows=calculate(s.rows),result=rows.find(r=>nameKey(r.name)===nameKey(name));
  if(!result)return [];
  // When population variance is zero, use the exclusive percentile of printed
  // totals directly so the report can still assign a grade without a Z-score.
  const percentile=result.percentile??percentRankExc(s.rows.map(r=>r.total),result.total)!;
  const grade=gradeFromPercentile(percentile)!;
  return [{...s,result:{...result,percentile,grade,point:gradePoint(grade)!,error:null,usedTotalPercentile:result.percentile===null}}];
 });
}
export function validateSubject(s:Subject){
 if(!s||typeof s.name!=='string'||!s.name.trim())throw Error('Enter a subject name.');
 if(!Number.isFinite(s.credit)||s.credit<0)throw Error('Credit must be a non-negative number.');
 if(!Number.isInteger(s.term)||s.term<1)throw Error('Enter a positive whole-number term.');
 if(!Array.isArray(s.rows))throw Error('Invalid student rows.');
 if(!Array.isArray(s.columns)||s.columns.some(c=>typeof c!=='string'))throw Error('Invalid component headers.');
 const seen=new Map<string,MarkRow>();
 for(const [i,r] of s.rows.entries()){
  const label=`Student row ${i+1}`;
  if(!r||typeof r.name!=='string'||!r.name.trim())throw Error(`${label}: student name is missing.`);
  if(typeof r.roll!=='string'||!/^(?:PGP|ABM)\/\d{2}\/\d+R?$/i.test(normalizeRoll(r.roll)))throw Error(`${label}: unrecognized roll number. Expected PGP/41/001 or ABM/22/001; returning-student suffix R is allowed.`);
  r.roll=normalizeRoll(r.roll);
  const rowLabel=`${label} (${r.roll})`;
  if(!Number.isFinite(r.total)||r.total<0)throw Error(`${rowLabel}: total marks must be a non-negative number.`);
  if(!Array.isArray(r.components)||r.components.length!==s.columns.length)throw Error(`${rowLabel}: expected ${s.columns.length} mark components; found ${Array.isArray(r.components)?r.components.length:0}. Upload the PDF again to align its columns.`);
  const bad=r.components.findIndex(v=>v!==null&&(!Number.isFinite(v)||v<0));
  if(bad>=0)throw Error(`${rowLabel}: component ${bad+1} must be a non-negative number or blank.`);
  const key=rollKey(r.roll);
  if(seen.has(key)&&!(s.source==='Marks Databse.xlsx'&&JSON.stringify(seen.get(key))===JSON.stringify(r)))throw Error('Duplicate student roll number: '+r.roll);
  seen.set(key,r);
 }
 return s;
}
