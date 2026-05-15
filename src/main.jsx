import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PartyUploadPage from './PartyUploadPage.jsx'
import ResetPasswordPage from './ResetPasswordPage.jsx'

// Public routes — no login required
const path = window.location.pathname;
let Root;
if (path.startsWith('/upload/')) Root = <PartyUploadPage />;
else if (path.startsWith('/reset-password')) Root = <ResetPasswordPage />;
else Root = <App />;

createRoot(document.getElementById('root')).render(Root);
