import assert from 'node:assert/strict';
import {parsePdfLines,pdfTextLines} from '../lib/pdf.ts';
const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y],width:str.length*3,height:5.64});
const heading=[item('Roll No',50,140),item('Student Name',130,140),item('Total100',420,140),item('GrpNo',460,140)];
const marks=(y,total,group)=>[item('10',240,y),item('20',280,y),item(total,420,y),item(group,460,y)];
const items=[...heading,item('0',10,108),item('PGP/41/004',50,108),item('PREVIOUS STUDENT',130,108),...marks(108,'35','G1'),item('1',10,100),item('PGP/41/001',50,100),item('FIRST STUDENT',130,103.72),item('SURNAME',140,96.28),...marks(100,'30','G3'),item('2',10,92.08),item('PGP/41/002',50,92.08),item('SECOND STUDENT',130,92.08),...marks(92.08,'40','G 4'),item('3',10,75),item('PGP/41/003',50,75),item('THIRD STUDENT',130,75),...marks(71.28,'50','G2')];
const parsed=parsePdfLines(pdfTextLines(items,1));assert.deepEqual(parsed.issues,[]);assert.equal(parsed.rows.length,4);assert.deepEqual(parsed.rows.map(r=>r.total),[35,30,40,50]);assert(parsed.rows.every(r=>JSON.stringify(r.components)==='[10,20]'));assert.equal(parsed.rows[1].name,'FIRST STUDENT SURNAME');assert.equal(parsed.rows[2].name,'SECOND STUDENT');
console.log('Passed: Total100 headings, G3 and G 4 trailing groups, wrapped names, displaced marks with group codes and neighboring row separation.');
