import assert from 'node:assert/strict';
import {parsePdfLines} from '../lib/pdf.ts';
const line=(cells)=>{let text='';const spans=[];for(const [str,x,width=10] of cells){if(text)text+=' ';const start=text.length;text+=str;spans.push({start,end:text.length,x,width});}return {text,page:1,spans};};
// The Student Name label starts just left of the roll/name midpoint.
const headings=line([['S.No.',58,16],['Roll No',91,22.7],['Student Name',123,43.4],['Quiz(b)',248,22],['Project(20)',488,33]]);
const total=line([['Total(100%)',526,29]]);
const row=line([['1',64],['PGP/41/001',87,30],['TEST STUDENT',123,50],['10',256,6],['20',502,6],['76',552,6],['9',590,6]]);
const parsed=parsePdfLines([headings,total,row]);
assert.deepEqual(parsed.issues,[]);assert.equal(parsed.rows.length,1);assert.equal(parsed.rows[0].total,76);assert.deepEqual(parsed.rows[0].components,[10,20]);
const missing=line([['2',64],['PGP/41/002',87,30],['SECOND STUDENT',123,50],['10',256,6],['20',502,6],['9',590,6]]);
const invalid=parsePdfLines([headings,total,row,missing]);assert.equal(invalid.rows.length,1);assert.equal(invalid.issues.length,1);assert(invalid.issues[0].includes('Total column'));
console.log('Passed: overlapping headers are excluded, annotated Total headings accept right-aligned values, trailing groups are excluded, genuinely missing totals remain flagged.');
