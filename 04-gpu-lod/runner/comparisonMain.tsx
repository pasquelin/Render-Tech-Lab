import { createRoot } from 'react-dom/client';
import { ComparisonApp } from './ComparisonApp.tsx';
import '../../src/style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root absent');
createRoot(root).render(<ComparisonApp />);
