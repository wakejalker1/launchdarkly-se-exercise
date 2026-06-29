import { useState } from 'react';

// Extra credit: AI Configs.
// A floating support chatbot. The frontend just sends the user's message and
// the active persona context to /api/chat. The BACKEND decides which model and
// system prompt to use by reading a LaunchDarkly AI Config — so a PM can change
// the model/prompt (and even run an experiment on it) without any code change.
export default function ChatWidget({ persona }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);

  async function send() {
    const message = input.trim();
    if (!message || loading) return;
    setInput('');
    const priorHistory = history;
    setHistory([...priorHistory, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: persona.context, history: priorHistory, message }),
      });
      const data = await res.json();
      if (data.error) {
        setHistory((h) => [...h, { role: 'assistant', content: `⚠️ ${data.error}` }]);
      } else {
        setHistory((h) => [...h, { role: 'assistant', content: data.reply }]);
        setMeta(data.meta);
      }
    } catch (err) {
      setHistory((h) => [...h, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label="Toggle chat">
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div>
              <strong>ABC Assistant</strong>
              <div className="chat-sub">Powered by a LaunchDarkly AI Config</div>
            </div>
          </div>

          <div className="chat-log">
            {history.length === 0 && (
              <div className="chat-empty">
                Ask me anything about ABC Company. The model &amp; prompt are
                controlled from LaunchDarkly.
              </div>
            )}
            {history.map((m, i) => (
              <div key={i} className={`chat-msg chat-${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && <div className="chat-msg chat-assistant chat-typing">…</div>}
          </div>

          {meta?.model && (
            <div className="chat-meta">
              model: <code>{meta.model}</code>
              {meta.variationKey && (
                <>
                  {' · '}variation: <code>{meta.variationKey}</code>
                </>
              )}
            </div>
          )}

          <div className="chat-input">
            <input
              value={input}
              placeholder="Type a message…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button onClick={send} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
