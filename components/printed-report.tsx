import {weightedGpa} from '@/lib/grades';
export type PrintedRow={subject:string;term:number;credit:number;grade:string;point:number;total?:number;rank?:number;cohort?:number;percentile?:number};
const number=(n:number|null|undefined,d=2)=>n==null?'—':n.toFixed(d);
export function PrintedReport({name,id,term,basis,rows,gpa}:{name:string;id:string;term:string;basis:string;rows:PrintedRow[];gpa:number|null}){
 const credits=rows.reduce((sum,r)=>sum+r.credit,0);
 const terms=[...new Set(rows.map(r=>r.term))].sort((a,b)=>a-b);
 return <article className="print-report" aria-label="Printable student report card">
  <header className="print-brand"><div><strong>ACADEMIC DESK</strong><span>IIM Lucknow · Academic overview</span></div><span className="print-document">STUDENT REPORT CARD</span></header>
  <section className="print-identity"><div><p className="print-kicker">{term}</p><h1>{name||'Select a student'}</h1><p className="print-id">{id}</p></div><div className="print-score"><span>{term==='All terms'?'Cumulative GPA':'Term GPA'}</span><strong>{number(gpa)}<small> / 10</small></strong></div></section>
  <section className="print-summary"><div><span>Subjects</span><strong>{rows.length}</strong></div><div><span>Total credits</span><strong>{number(credits)}</strong></div><div><span>Grade basis</span><strong>{basis}</strong></div></section>
  {terms.length>1&&<section className="print-terms">{terms.map(t=>{const list=rows.filter(r=>r.term===t);return <div key={t}><span>Term {t}</span><strong>{number(weightedGpa(list.map(r=>({credit:r.credit,point:r.point}))))}</strong><small>{list.length} subjects</small></div>;})}</section>}
  <section className="print-results"><h2>Subject results</h2><p className="print-caption">Subjects matched to {id} · {term}</p><table><thead><tr>{['Subject','Term','Credits','Marks','Rank / cohort','Percentile','Grade','Points'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.subject}{r.credit===0&&<small>Non-credit</small>}</td><td>{r.term}</td><td>{number(r.credit,r.credit%1?2:0)}</td><td>{number(r.total)}</td><td>{r.rank==null?'—':r.rank+' / '+r.cohort}</td><td>{r.percentile==null?'—':number(r.percentile*100,1)+'%'}</td><td><span className={'print-grade '+(r.point>=8?'excellent':r.point<=4?'developing':'')}>{r.grade}</span></td><td>{r.point}</td></tr>)}</tbody><tfoot><tr><td colSpan={2}>Credit-weighted {term==='All terms'?'CGPA':'SGPA'}</td><td>{number(credits)}</td><td colSpan={4}>Σ(credits × grade points) ÷ Σ(credits)</td><td>{number(gpa)}</td></tr></tfoot></table>{!rows.length&&<p className="print-caption">No subjects match this ID in the selected term.</p>}</section>
  <footer className="print-footer"><span>Academic Desk · {basis}</span><span>{new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></footer>
 </article>;
}
