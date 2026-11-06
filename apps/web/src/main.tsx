import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// No StrictMode: drei's <Html> overlays create their own React roots, and StrictMode's double
// mount unmounts them mid-render (labels disappear, console errors).
createRoot(document.getElementById('root')!).render(<App />);
