import { useEffect, useRef, useState } from 'react';
import { useLDClient } from 'launchdarkly-react-client-sdk';

// Part 1: the "listener".
// We register an explicit listener on the LD client's `change` event. The
// streaming SDK fires this the instant a flag is toggled in LaunchDarkly — with
// NO page reload — and we surface each change as a toast. (This is the same
// mechanism that powers the live UI updates elsewhere in the app; here we make
// it visible.)
export default function ChangeToast() {
  const ldClient = useLDClient();
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  useEffect(() => {
    if (!ldClient) return;

    // `change` fires with an object: { [flagKey]: { current, previous } }.
    const handler = (changes) => {
      const items = Object.entries(changes).map(([key, val]) => ({
        id: ++counter.current,
        key,
        current: val.current,
        previous: val.previous,
      }));
      setToasts((prev) => [...items, ...prev].slice(0, 5));
      // Auto-dismiss each toast after a few seconds.
      items.forEach((it) => {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== it.id));
        }, 6000);
      });
    };

    ldClient.on('change', handler);
    return () => ldClient.off('change', handler);
  }, [ldClient]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <div className="toast-title">⚡ Flag changed live</div>
          <div className="toast-body">
            <code>{t.key}</code>: {fmt(t.previous)} → <strong>{fmt(t.current)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function fmt(v) {
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
