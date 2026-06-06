import React from 'react';
import { createRoot } from 'react-dom/client';
import CmaTool from './CmaTool.jsx';
const mockTx = { id: 'buy-tx', address: '500 Buyer Ln', type: 'Buyer Representation' };
createRoot(document.getElementById('root')).render(React.createElement(CmaTool, { tx: mockTx, token: '', currentUser: { firstName: 'Maria', lastName: 'Gonzalez' } }));
