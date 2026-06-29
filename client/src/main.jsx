import React from 'react';
import ReactDOM from 'react-dom/client';
import { asyncWithLDProvider } from 'launchdarkly-react-client-sdk';
import App from './App.jsx';
import { getPersona, DEFAULT_PERSONA_ID } from './lib/personas.js';
import './styles.css';

// The client-side ID is PUBLIC and safe to ship to the browser. Vite injects
// it at build time from the root .env (VITE_LD_CLIENT_ID), populated by
// `npm run bootstrap`.
const clientSideID = import.meta.env.VITE_LD_CLIENT_ID;

const root = ReactDOM.createRoot(document.getElementById('root'));

async function bootstrap() {
  if (!clientSideID) {
    root.render(<SetupNeeded />);
    return;
  }

  // asyncWithLDProvider waits for the initial flag values before first render,
  // so there is no UI flicker. streaming:true opens a live connection to
  // LaunchDarkly; when a flag changes, the SDK pushes the new value and React
  // re-renders — no page reload (Part 1: Instant releases/rollbacks).
  const LDProvider = await asyncWithLDProvider({
    clientSideID,
    context: getPersona(DEFAULT_PERSONA_ID).context,
    options: { streaming: true },
    // Keep flag keys exactly as defined in LaunchDarkly (kebab-case).
    reactOptions: { useCamelCaseFlagKeys: false },
  });

  root.render(
    <React.StrictMode>
      <LDProvider>
        <App />
      </LDProvider>
    </React.StrictMode>
  );
}

// Friendly message shown when the app hasn't been configured yet.
function SetupNeeded() {
  return (
    <div className="setup-needed">
      <h1>⚙️ Setup needed</h1>
      <p>
        <code>VITE_LD_CLIENT_ID</code> is not set. Create a LaunchDarkly account,
        then from the repo root run:
      </p>
      <pre>cp .env.example .env   # add your LD_API_TOKEN{'\n'}npm run bootstrap      # auto-fills the SDK keys</pre>
      <p>Then restart the dev server. See the README for full instructions.</p>
    </div>
  );
}

bootstrap();
