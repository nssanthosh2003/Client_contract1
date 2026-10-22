import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const START = {
  global: ["Which contracts expire in the next 60 days?", "Which clients have critical PTRs?", "Show overdue invoices", "Which projects are off track?"],
  client: ["What expires soon?", "Summarise the open PTRs", "Which invoices are overdue?", "Are there any blockers?"],
};

/** Floating assistant, bottom right. scope="global" talks about every client; scope="client" about one. */
export default function ChatWidget({ scope, clientId, clientName }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);
  const [suggestions, setSuggestions] = useState(START[scope]);
  const input = useRef(null);
  const end = useRef(null);

  useEffect(() => {
    if (open) input.current?.focus();
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async (raw) => {
    const message = raw.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => !m.error);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setText("");
    setBusy(true);
    try {
      const res = await api.chat({ scope, client_id: clientId, message, history: history.map(({ role, content }) => ({ role, content })) });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      setMode(res.mode);
      setSuggestions(res.suggestions || START[scope]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `I couldn't answer that. ${e.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const title = scope === "client" ? clientName || "this client" : "TCS AgentAssist";

  return (
    <>
      {open && (
        <section className="chat" role="dialog" aria-label={`Assistant for ${title}`}>
          <header className="chat-head">
            <div>
              <h2>Chat Support</h2>
              <p>{scope === "client" ? `Asking about ${title}` : "TCS AgentAssist Intelligent Assistant"}</p>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat support">
              Close
            </button>
          </header>

          <div className="chat-log" aria-live="polite">
            {messages.length === 0 && (
              <p className="chat-hello">
                {scope === "client" ? `Ask about ${title}'s contracts, PTRs, invoices or project.` : "Ask about contracts, PTRs, invoices or project health across every client."}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`} data-error={m.error ? "true" : undefined}>
                {m.content}
              </div>
            ))}
            {busy && <div className="bubble assistant typing">Thinking</div>}
            <div ref={end} />
          </div>

          {!busy && (
            <div className="chat-suggest">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <label className="sr" htmlFor="chat-input">
              Your question
            </label>
            <input id="chat-input" ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question" maxLength={1000} autoComplete="off" />
            <button className="btn" type="submit" disabled={busy || !text.trim()}>
              Send
            </button>
          </form>
          {mode === "rules" && <p className="chat-foot">Answers come from rules over your data. Set ANTHROPIC_API_KEY for open-ended answers.</p>}
        </section>
      )}
      <button
        className="chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close chat support" : "Open chat support"}
        title={open ? "Close chat support" : "Chat Support"}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            <circle cx="8.5" cy="11.5" r="1" fill="currentColor" />
            <circle cx="12" cy="11.5" r="1" fill="currentColor" />
            <circle cx="15.5" cy="11.5" r="1" fill="currentColor" />
          </svg>
        )}
      </button>
    </>
  );
}
