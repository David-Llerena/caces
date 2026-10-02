import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/atkinson-hyperlegible-next';
import './styles.css';

document.title = import.meta.env.VITE_TITULO ?? 'Simulacro de Evaluación';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
