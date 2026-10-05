import fs from 'node:fs/promises';
await fs.mkdir('public',{recursive:true});
await fs.copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','public/pdf.worker.min.mjs');
