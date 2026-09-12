import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root absent');

// Pas de StrictMode : un double montage recréerait le device WebGPU et la boucle rAF.
createRoot(root).render(<App />);
