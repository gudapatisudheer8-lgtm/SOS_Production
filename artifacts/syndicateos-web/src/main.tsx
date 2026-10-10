import { createRoot } from 'react-dom/client';

import App from './App';
import { ConfigProvider } from './adapter/config';
import { installOriginalFetchBridge } from './adapter/api';

import './index.css';

installOriginalFetchBridge();

createRoot(document.getElementById('root')!).render(<ConfigProvider><App /></ConfigProvider>);
