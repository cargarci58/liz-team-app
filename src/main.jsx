import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PartyUploadPage from './PartyUploadPage.jsx'

// Public upload route — no login required
const path = window.location.pathname;
const Root = path.startsWith('/upload/') ? <PartyUploadPage /> : <App />;

createRoot(document.getElementById('root')).render(Root);
