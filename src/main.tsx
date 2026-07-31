import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SettingsPage } from './components/SettingsPage';
import { ChatPage } from './components/ChatPage';
import { applyTheme, readStoredTheme, resolveTheme } from './theme';
import './styles.css';

const view = new URLSearchParams(window.location.search).get('view');
const settingsView = view === 'settings';
const chatView = view === 'chat';
if (settingsView || chatView) {
  document.title = settingsView
    ? 'Persona Chat Bridge Settings'
    : 'Persona Chat Bridge Fallback Chat';
  // Applied before the first render so a light window never paints dark first.
  // The avatar overlay is left untouched, keeping its dark transparent canvas.
  applyTheme(resolveTheme(readStoredTheme()));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {settingsView ? <SettingsPage /> : chatView ? <ChatPage /> : <App />}
  </StrictMode>,
);
