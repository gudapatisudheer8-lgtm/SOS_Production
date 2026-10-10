import { createRoot } from 'react-dom/client';

import App from './App';
import { installOriginalFetchBridge } from './adapter/api';

import './index.css';

installOriginalFetchBridge();

createRoot(document.getElementById('root')!).render(<App />);
