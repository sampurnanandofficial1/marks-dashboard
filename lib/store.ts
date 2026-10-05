import {env} from 'cloudflare:workers';
export const db=()=>{if(!env.DB)throw Error('Marks storage is unavailable. Please try again.');return env.DB;};
export const bucket=()=>{if(!env.BUCKET)throw Error('PDF storage is unavailable. Please try again.');return env.BUCKET;};
