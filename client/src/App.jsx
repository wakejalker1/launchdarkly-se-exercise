import { useState, useCallback } from 'react';
import { useLDClient } from 'launchdarkly-react-client-sdk';
import { PERSONAS, getPersona, DEFAULT_PERSONA_ID } from './lib/personas.js';
import PersonaSwitcher from './components/PersonaSwitcher.jsx';
import Part1Recommendations from './components/Part1Recommendations.jsx';
import Part2Hero from './components/Part2Hero.jsx';
import FlagInspector from './components/FlagInspector.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import ChangeToast from './components/ChangeToast.jsx';

export default function App() {
  const ldClient = useLDClient();
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);
  const persona = getPersona(personaId);

  // Switching persona re-identifies the LD client. Every flag re-evaluates for
  // the new context immediately — the live targeting demonstration (Part 2).
  const handleSelect = useCallback(
    (id) => {
      setPersonaId(id);
      const next = getPersona(id);
      ldClient?.identify(next.context);
    },
    [ldClient]
  );

  return (
    <div className="app">
      <header className="site-header">
        <div className="brand">
          <span className="logo">◆</span> ABC&nbsp;Company
        </div>
        <nav className="site-nav">
          <a>Product</a>
          <a>Pricing</a>
          <a>Docs</a>
          <span className="badge">LaunchDarkly SE Exercise</span>
        </nav>
      </header>

      <PersonaSwitcher personas={PERSONAS} selectedId={personaId} onSelect={handleSelect} />

      <main className="content">
        {/* Part 2 + Experimentation: the landing component "your team" owns. */}
        <Part2Hero persona={persona} />

        {/* Part 1: a brand-new feature gated behind a flag with instant rollback. */}
        <Part1Recommendations />

        {/* Live view of flag values + the active context (great for demos). */}
        <FlagInspector persona={persona} />
      </main>

      <footer className="site-footer">
        Demo app for the LaunchDarkly SE technical exercise · flags evaluate live
        via the client-side SDK.
      </footer>

      {/* Extra credit: AI Configs chatbot. */}
      <ChatWidget persona={persona} />

      {/* Explicit flag-change listener -> toast (Part 1: the "listener"). */}
      <ChangeToast />
    </div>
  );
}
