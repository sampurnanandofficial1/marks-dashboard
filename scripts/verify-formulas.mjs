import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate,percentRankExc,gradeFromPercentile,gradePoint,weightedGpa,applyReportCredits,validateSubject} from '../lib/grades.ts';
import {parseLines} from '../lib/pdf.ts';
const row=(total,i)=>({total,roll:'PGP/41/'+i,name:'Student '+i,section:'A',components:[]});
const tied=calculate([1,2,2,3].map(row));
assert.deepEqual(tied.map(r=>r.rank),[4,3,2,1]);
assert.deepEqual(tied.map(r=>r.percentile),[.2,.4,.4,.8]);
assert(Math.abs(tied[0].z+Math.SQRT2)<1e-12);
assert.equal(percentRankExc([1,2,3,6,6,6,7,8,9],7),.7);
assert.equal(percentRankExc([1,2,3,6,6,6,7,8,9],5.43),.381);
assert.equal(percentRankExc([1,2,3,6,6,6,7,8,9],6),.4);
assert.equal(percentRankExc([1,2],1),.333);
for(const [threshold,grade,point] of [[.95,'A+',10],[.85,'A',9],[.75,'A-',8],[.5334,'B+',7],[.3168,'B',6],[.1002,'B-',5],[.05,'C+',4],[.025,'C',3],[.01,'C-',2],[0,'D',1]]){
 assert.equal(gradeFromPercentile(threshold),grade);assert.equal(gradePoint(grade),point);
 if(threshold>0)assert.notEqual(gradeFromPercentile(threshold-1e-8),grade);
}
assert.equal(gradePoint('UNKNOWN'),0);
assert(calculate([2,2].map(row)).every(r=>r.error==='#DIV/0!'&&r.z===null&&r.percentile===null));
assert.equal(weightedGpa([{credit:1,point:7},{credit:.5,point:4}]),6);
assert.equal(weightedGpa([{credit:1,point:7},{credit:1,point:null}]),null);
assert.equal(weightedGpa([{credit:1,point:7},{credit:0,point:null}]),7);
assert(Math.abs(weightedGpa([{credit:6,point:6},{credit:4,point:5}])-5.6)<1e-12);
const seed=JSON.parse(fs.readFileSync(new URL('../lib/seed.json',import.meta.url)));
for(const s of seed.subjects)validateSubject(s);
const report=applyReportCredits(seed.subjects);
assert.equal(report.length,seed.subjects.length);
const moved=applyReportCredits([{name:'ESGMR',term:5,credit:0}]);assert.equal(moved[0].term,4);assert.equal(moved[0].credit,1);
const parsed=parseLines([{page:1,text:'1 ABM/22/010 TEST NAME 20 30 50'},{page:1,text:'2 PGP/40/138R RETURNING STUDENT 15 20 35'},{page:1,text:'3 PGP41221 SAMPURN ANAND 10 20 30'}]);
assert.equal(parsed.rows.length,3);assert.deepEqual(parsed.issues,[]);
assert.equal(parsed.rows[1].roll,'PGP/40/138R');assert.equal(parsed.rows[2].roll,'PGP/41/221');
console.log('Formula checks passed: Excel ranks, population Z-scores, exclusive percentiles, all grade boundaries, SWITCH fallback, SGPA/CGPA credits, missing grades, PGP/ABM PDF extraction.');

// A subject extends beyond the example's row 119. The last total changes
// the average, population deviation, ranks and exclusive percentile range.
const fullRange=Array.from({length:208},(_,i)=>({...row(i+1,i),components:[999,999,999,999]}));
const full=calculate(fullRange);
assert.equal(full[0].average,104.5);assert.equal(full[0].cohort,208);
assert.equal(full[0].rank,208);assert.equal(full.at(-1).rank,1);
assert.equal(full[0].percentile,.004);assert.equal(full.at(-1).percentile,.995);
assert.equal(full.at(-1).grade,'A+');assert.equal(full.at(-1).point,10);
assert.equal(full[0].grade,'D');assert.equal(full[0].point,1);
assert(Math.abs(full.at(-1).z-(208-104.5)/Math.sqrt((208**2-1)/12))<1e-12);
const reference=totals=>{
 const mean=totals.reduce((a,b)=>a+b,0)/totals.length;
 const deviation=Math.sqrt(totals.reduce((a,b)=>a+(b-mean)**2,0)/totals.length);
 const zs=totals.map(total=>(total-mean)/deviation),sorted=[...zs].sort((a,b)=>a-b);
 return totals.map((total,i)=>({rank:1+totals.filter(t=>t>total).length+totals.slice(i).filter(t=>t===total).length-1,z:zs[i],percentile:Math.floor(((sorted.indexOf(zs[i])+1)/(totals.length+1)+Number.EPSILON)*1000)/1000}));
};
for(const totals of [[0,100,50,100,20,0],Array.from({length:300},(_,i)=>(i*37)%101)]){
 const actual=calculate(totals.map(row)),expected=reference(totals);
 for(let i=0;i<totals.length;i++){assert.equal(actual[i].rank,expected[i].rank);assert.equal(actual[i].z,expected[i].z);assert.equal(actual[i].percentile,expected[i].percentile);}
}
const finalTotals=parseLines([{page:1,text:'1 A PGP/41/001 FIRST STUDENT 10 20 30 40 83.75'},{page:1,text:'2 A PGP/41/002 LAST STUDENT 90 80 70 60 24.5'}]);
assert.deepEqual(finalTotals.rows.map(r=>r.total),[83.75,24.5]);
assert.deepEqual(calculate(finalTotals.rows).map(r=>r.rank),[1,2]);
console.log('Passed: complete ranges beyond row 119, last-row totals, all component columns, repeated totals, and independent formula comparison.');
