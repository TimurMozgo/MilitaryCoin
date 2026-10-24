import React from 'react';
import {createRoot} from 'react-dom/client';
import Shop from '../app/shop';
import '../app/globals.css';
import '../app/tactical.css';
import '../app/armory.css';
window.MILITARYCOIN_API_ORIGIN='https://coin-collection-tma.nikitalesnikovtest1.chatgpt.site';
createRoot(document.getElementById('root')!).render(<Shop/>);
