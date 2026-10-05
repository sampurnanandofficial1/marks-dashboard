import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const subjects=sqliteTable('subjects',{id:text('id').primaryKey(),data:text('data').notNull(),pdfKey:text('pdf_key'),updatedAt:text('updated_at').notNull()});
