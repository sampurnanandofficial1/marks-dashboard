import assert from 'node:assert/strict';
import {parsePdfLines} from '../lib/pdf.ts';
const line=(cells)=>{let text='';const spans=[];for(const [str,x,width=10] of cells){if(text)text+=' ';const start=text.length;text+=str;spans.push({start,end:text.length,x,width});}return {text,page:1,spans};};
const header=line([['Section',10],['Roll no.',35,18],['Name',75,14],['Total CP',417,20],['Project',448,20],['End term',510,14],['Total marks',546,27]]);
const row=(id,name,section,total)=>line([[section,10],[id,35,28],[name,75,70],['20',436],['24',470],['43',538],[total,592,6]]);
const parsed=parsePdfLines([header,row('PGP/41/001','FIRST STUDENT','A','87'),row('PhD-26014','SECOND STUDENT','A','88.5'),row('PhD-26014','THIRD STUDENT','B','86.5')]);
assert.equal(parsed.rows.length,3);assert.deepEqual(parsed.rows.map(r=>r.total),[87,88.5,86.5]);assert(parsed.rows.every(r=>JSON.stringify(r.components)==='[20,24,43]'));assert.equal(parsed.issues.length,1);assert(parsed.issues[0].includes('SECOND STUDENT and THIRD STUDENT'));assert.equal(parsed.rows[2].section,'B');
console.log('Passed: wide right-aligned Total Marks, intermediate Total CP excluded, duplicated source IDs preserve both rows and report an explicit conflict.');
