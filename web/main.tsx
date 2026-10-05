import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../app/page';
import '../app/globals.css';
(window as any).ACADEMIC_API_URL=(import.meta.env as unknown as Record<string,unknown>).VITE_API_URL;
createRoot(document.getElementById('root')!).render(<Dashboard/>);
