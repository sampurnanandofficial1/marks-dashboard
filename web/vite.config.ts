import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({root:path.resolve('web'),base:'/marks-dashboard/',plugins:[react(),tailwind()],resolve:{alias:{'@':path.resolve('.')}},publicDir:path.resolve('public'),build:{outDir:path.resolve('web-dist'),emptyOutDir:true}});
