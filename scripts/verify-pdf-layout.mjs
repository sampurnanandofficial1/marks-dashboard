import assert from 'node:assert/strict';
import {parseLines} from '../lib/pdf.ts';
import {validateSubject,calculate} from '../lib/grades.ts';
const line=(roll,marks)=>{
 const tokens=[['PGP/41/'+roll,10],['TEST STUDENT',70],...marks];let text='';const spans=[];
 for(const [str,x] of tokens){if(text)text+=' ';const start=text.length;text+=str;spans.push({start,end:text.length,x,width:10});}
 return {text,page:1,spans};
};
const complete=line('001',[['10',200],['20',250],['30',300],['60',350]]);
const blank=line('002',[['12',200],['35',300],['47',350]]);
const parsed=parseLines([complete,blank]);
assert.deepEqual(parsed.issues,[]);assert.equal(parsed.count,3);
assert.deepEqual(parsed.rows[1].components,[12,null,35]);assert.equal(parsed.rows[1].total,47);
assert.equal(parsed.warnings.length,1);
validateSubject({name:'Test',term:4,credit:1,columns:['A','B','C'],rows:parsed.rows,source:'test.pdf'});
assert.equal(calculate(parsed.rows)[0].rank,1);
const fallback=parseLines([complete,blank].map(({text,page})=>({text,page})));
assert.deepEqual(fallback.issues,[]);assert.equal(fallback.count,0);assert(fallback.rows.every(r=>r.components.length===0));
assert.deepEqual(fallback.rows.map(r=>r.total),[60,47]);assert.equal(fallback.warnings.length,1);
validateSubject({name:'Test',term:4,credit:1,columns:[],rows:fallback.rows,source:'test.pdf'});
const misaligned=parseLines([complete,line('003',[['12',225],['35',300],['47',350]])]);
assert.equal(misaligned.count,0);assert.deepEqual(misaligned.issues,[]);
const explicit=parseLines([complete,line('004',[['12',200],['AB',250],['35',300],['47',350]])]);
assert.equal(explicit.count,3);assert.deepEqual(explicit.rows[1].components,[12,null,35]);assert.deepEqual(explicit.warnings,[]);
assert(parseLines([complete,complete]).issues.some(i=>i.includes('Duplicate')));
assert(parseLines([{text:'PGP/41/005 TEST STUDENT AB',page:1}]).issues.length>0);
console.log('Passed: blank-cell column alignment, printed totals, safe totals-only fallback, explicit absences, duplicate and missing-total rejection.');
