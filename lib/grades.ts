export type MarkRow={roll:string;name:string;section:string;components:(number|null)[];total:number};
export type Subject={id:string;name:string;term:number;credit:number;columns:string[];rows:MarkRow[];source:string;updatedAt:string|null};
export const bands:[number,string,number][]=[[.95,'A+',10],[.85,'A',9],[.75,'A-',8],[.5334,'B+',7],[.3168,'B',6],[.1002,'B-',5],[.05,'C+',4],[.025,'C',3],[.01,'C-',2],[0,'D',1]];
export const rollKey=(s:string)=>s.replace(/[^0-9]/g,'');
export const normalizeRoll=(s:string)=>s.replace(/\s/g,'').toUpperCase().replace(/^(PGP|ABM|IEP|PHD)[ /-]?(\d{2})[ /-]?(\d+R?)$/,'$1/$2/$3');
// Excel PERCENTRANK.EXC with the omitted significance argument (three decimals).
// Build one complete subject range; a displayed filter or sort never changes it.
function exclusivePercentileRange(values:number[]){
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
 return (x:number):number|null=>{
  if(!sorted.length||!Number.isFinite(x)||x<sorted[0]||x>sorted[sorted.length-1])return null;
  let low=0,high=sorted.length;
  while(low<high){const middle=Math.floor((low+high)/2);if(sorted[middle]<x)low=middle+1;else high=middle;}
  // Excel gives tied values the first ascending position, independently of rank.
  let position=low+1;
  if(sorted[low]!==x){const previous=low-1;position=low+(x-sorted[previous])/(sorted[low]-sorted[previous]);}
  const percentile=position/(sorted.length+1);
  return Math.floor((percentile+Number.EPSILON)*1000)/1000;
 };
}
export function percentRankExc(values:number[],x:number):number|null{
 return exclusivePercentileRange(values)(x);
}
export function gradeFromPercentile(percentile:number|null){
 return percentile===null?null:bands.find(b=>percentile>=b[0])?.[1]??'D';
}
export function gradePoint(grade:string|null){
 return grade===null?null:bands.find(b=>b[1]===grade)?.[2]??0;
}
export function calculate(rows:MarkRow[]){
 // I2:I(last row): the final printed total, including every student to the end.
 // Component marks are never substituted for the supplied final total.
 const totals=rows.map(row=>row.total),n=totals.length;
 const avg=n?totals.reduce((sum,total)=>sum+total,0)/n:0;
 const sd=n?Math.sqrt(totals.reduce((sum,total)=>sum+(total-avg)**2,0)/n):0;
 const zScores=totals.map(total=>sd>0?(total-avg)/sd:null);
 // K2:K(last row): full-precision Z-scores, before any display rounding.
 const percentileOf=exclusivePercentileRange(zScores.filter((z):z is number=>z!==null));
 const frequency=new Map<number,number>();for(const total of totals)frequency.set(total,(frequency.get(total)??0)+1);
 const descending=[...frequency.keys()].sort((a,b)=>b-a),equalRanks=new Map<number,number>();
 let higher=0;for(const total of descending){equalRanks.set(total,higher+1);higher+=frequency.get(total)!;}
 const remaining=new Map(frequency);
 return rows.map((row,i)=>{
  // RANK.EQ(I2,I$2:I$last,0) + COUNTIF(I2:I$last,I2) - 1.
  const rank=equalRanks.get(row.total)!+remaining.get(row.total)!-1;
  remaining.set(row.total,remaining.get(row.total)!-1);
  const z=zScores[i],percentile=z===null?null:percentileOf(z);
  const grade=gradeFromPercentile(percentile);
  return {...row,rank,z,percentile,grade,point:gradePoint(grade),error:sd===0?'#DIV/0!':null,average:avg,cohort:n};
 });
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
export function studentId(roll:string){
 const compact=roll.replace(/[\s/\-]/g,'').toUpperCase();
 const match=compact.match(/^(PGP|ABM|IEP|PHD)?(\d{2})(\d+)(R?)$/);
 if(!match)return '';
 return (match[1]??'PGP')+'/'+match[2]+'/'+match[3].padStart(3,'0')+match[4];
}
export function studentReport(subjects:Subject[],roll:string){
 const id=studentId(roll);
 if(!id)return [];
 return applyReportCredits(subjects).flatMap(s=>{
  const rows=calculate(s.rows),result=rows.find(r=>studentId(r.roll)===id);
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
  if(typeof r.roll!=='string'||!/^(?:PGP|ABM|IEP|PHD)\/\d{2}\/\d+R?$/i.test(normalizeRoll(r.roll)))throw Error(`${label}: unrecognized roll number. Expected PGP/41/001 or ABM/22/001; returning-student suffix R is allowed.`);
  r.roll=normalizeRoll(r.roll);
  const rowLabel=`${label} (${r.roll})`;
  if(!Number.isFinite(r.total)||r.total<0)throw Error(`${rowLabel}: total marks must be a non-negative number.`);
  if(!Array.isArray(r.components)||r.components.length!==s.columns.length)throw Error(`${rowLabel}: expected ${s.columns.length} mark components; found ${Array.isArray(r.components)?r.components.length:0}. Upload the PDF again to align its columns.`);
  const bad=r.components.findIndex(v=>v!==null&&(!Number.isFinite(v)||v<0));
  if(bad>=0)throw Error(`${rowLabel}: component ${bad+1} must be a non-negative number or blank.`);
  const key=studentId(r.roll);
  if(seen.has(key)&&!(s.source==='Marks Databse.xlsx'&&JSON.stringify(seen.get(key))===JSON.stringify(r)))throw Error('Duplicate student roll number: '+r.roll);
  seen.set(key,r);
 }
 return s;
}
