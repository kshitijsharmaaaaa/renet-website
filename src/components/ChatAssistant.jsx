import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../lib/api";
import { ADVISOR_STEPS, MODEL_SLUGS, detectModel, recommend } from "../lib/advisor";
import { enquiryLink } from "../lib/enquiry";

const WELCOME_MESSAGE = {
  role: "assistant",
  content:
    "Hi, I'm the RENET assistant. Ask me about the D-8 White, the D-8 Black or how to book a test ride — or let me help you choose.",
};

const SUGGESTIONS = [
  "What's the difference between D-8 White and D-8 Black?",
  "What is the price and range?",
  "How do I make an enquiry?",
];

// Enquire / test ride / view actions shown under a recommendation.
function ModelActions({ models, onNavigate }) {
  return (
    <div className="renet-chat-actions">
      {models.map((model) => {
        const enquiry = enquiryLink(model);
        return (
          <div key={model} className="renet-chat-action-group">
            <span>{model}</span>
            <a {...enquiry.linkProps} className="is-primary">
              {enquiry.channel === "whatsapp" ? "Enquire on WhatsApp" : "Enquire by email"} ↗
            </a>
            <button type="button" onClick={() => onNavigate(`/?model=${MODEL_SLUGS[model]}&form=test-ride#contact`)}>
              Book a test ride
            </button>
            <Link to={`/scooters/${MODEL_SLUGS[model]}`} onClick={() => onNavigate(null)}>
              View {model}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export default function ChatAssistant({ open, onOpenChange }) {
  const navigate = useNavigate();
  // "checking" | "online" | "offline"
  const [status, setStatus] = useState("checking");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Guided advisor: null when inactive, otherwise { step, answers }.
  const [advisor, setAdvisor] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const toggleRef = useRef(null);
  const panelRef = useRef(null);

  // Only present the assistant as AI-powered once the backend confirms it is configured.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/health`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setStatus(data?.aiConfigured ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      // Return focus to the toggle if it was inside the closing panel.
      if (panelRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onOpenChange]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, error, advisor]);

  const goTo = (path) => {
    onOpenChange(false);
    if (path) navigate(path);
  };

  const startAdvisor = () => {
    setError("");
    setAdvisor({ step: 0, answers: {} });
    setMessages((previous) => [
      ...previous,
      { role: "user", content: "Help me choose a D-8" },
      { role: "assistant", content: `Happy to help — four quick questions.\n\n${ADVISOR_STEPS[0].question}` },
    ]);
  };

  const answerAdvisor = (value, label) => {
    const step = ADVISOR_STEPS[advisor.step];
    const answers = { ...advisor.answers, [step.id]: value };
    const next = advisor.step + 1;
    if (next < ADVISOR_STEPS.length) {
      setAdvisor({ step: next, answers });
      setMessages((previous) => [
        ...previous,
        { role: "user", content: label },
        { role: "assistant", content: ADVISOR_STEPS[next].question },
      ]);
      return;
    }
    const result = recommend(answers);
    setAdvisor(null);
    setMessages((previous) => [
      ...previous,
      { role: "user", content: label },
      { role: "assistant", content: result.text, actions: result.models },
    ]);
  };

  const sendMessage = async (text, previousMessages = messages) => {
    const content = text.trim();
    if (!content || sending || status !== "online") return;

    setAdvisor(null);
    const history = [...previousMessages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setError("");
    setSending(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The welcome message is UI-only, so it isn't sent to the model.
        body: JSON.stringify({
          messages: history.slice(1).map(({ role, content: text }) => ({ role, content: text })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.reply) {
        throw new Error(data.error || "The assistant couldn't reply. Please try again.");
      }
      const model = detectModel(data.reply);
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.reply, ...(model ? { actions: [model] } : {}) },
      ]);
    } catch (caught) {
      setError(
        caught instanceof TypeError
          ? "Couldn't reach the assistant. Check your connection and try again."
          : caught.message,
      );
    } finally {
      setSending(false);
    }
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUser) return;
    sendMessage(lastUser.content, messages.slice(0, messages.lastIndexOf(lastUser)));
  };

  const onlyWelcome = messages.length === 1;

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={open ? "renet-chat-toggle renet-chat-toggle-open" : "renet-chat-toggle"}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="renet-chat-panel"
        aria-label={open ? "Close RENET assistant" : "Open RENET assistant"}
      >
        <span className="renet-chat-toggle-icon" aria-hidden="true">
          {open ? "×" : "ϟ"}
        </span>
        <span className="renet-chat-toggle-label">
          {status === "online" ? "Ask RENET AI" : "Ask RENET"}
        </span>
      </button>

      <section
        ref={panelRef}
        id="renet-chat-panel"
        className={open ? "renet-chat-panel renet-chat-panel-open" : "renet-chat-panel"}
        role="dialog"
        aria-modal="false"
        aria-label="RENET assistant"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="renet-chat-header">
          <div>
            <span className="renet-chat-eyebrow">
              <span className={`renet-chat-status renet-chat-status-${status}`} />
              {status === "online" ? "AI ASSISTANT · ONLINE" : status === "checking" ? "CONNECTING…" : "ASSISTANT OFFLINE"}
            </span>
            <h2>
              RENET<span>.</span> assistant
            </h2>
          </div>
          <button
            type="button"
            className="renet-chat-close"
            onClick={() => onOpenChange(false)}
            aria-label="Close assistant"
          >
            ×
          </button>
        </header>

        <div className="renet-chat-messages" ref={listRef} aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={message.role === "user" ? "renet-chat-row is-user" : "renet-chat-row"}>
              <p
                className={
                  message.role === "user"
                    ? "renet-chat-bubble renet-chat-bubble-user"
                    : "renet-chat-bubble renet-chat-bubble-assistant"
                }
              >
                {message.content}
              </p>
              {message.actions && <ModelActions models={message.actions} onNavigate={goTo} />}
            </div>
          ))}

          {advisor && (
            <div className="renet-chat-quick" role="group" aria-label={ADVISOR_STEPS[advisor.step].question}>
              {ADVISOR_STEPS[advisor.step].options.map(([value, label]) => (
                <button type="button" key={value} onClick={() => answerAdvisor(value, label)}>
                  {label}
                </button>
              ))}
              <button type="button" className="is-quiet" onClick={() => setAdvisor(null)}>
                Cancel
              </button>
            </div>
          )}

          {status === "offline" && (
            <p className="renet-chat-bubble renet-chat-bubble-assistant renet-chat-notice">
              The AI assistant isn't available right now — but “Help me choose” still works. You can
              also reach the RENET team at <a href="mailto:info@renet.in">info@renet.in</a> or
              through the contact form.
            </p>
          )}

          {sending && (
            <div className="renet-chat-typing" aria-label="Assistant is typing">
              <span />
              <span />
              <span />
            </div>
          )}

          {error && (
            <div className="renet-chat-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={retryLast}>
                Retry ↻
              </button>
            </div>
          )}

          {!advisor && !sending && status !== "checking" && (
            <div className="renet-chat-suggestions">
              <button type="button" className="is-advisor" onClick={startAdvisor}>
                ϟ Help me choose a D-8
              </button>
              {onlyWelcome && status === "online" && SUGGESTIONS.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => sendMessage(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          className="renet-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(input);
          }}
        >
          <label htmlFor="renet-chat-input" className="renet-chat-sr-only">
            Your message
          </label>
          <input
            id="renet-chat-input"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={status === "online" ? "Ask about RENET D-8…" : "Assistant unavailable"}
            maxLength={1000}
            autoComplete="off"
            disabled={status !== "online"}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending || status !== "online"}
            aria-label="Send message"
          >
            ↗
          </button>
        </form>

        <p className="renet-chat-disclaimer">
          Answers use information published on this website. Confirm specifications with RENET.
        </p>
      </section>
    </>
  );
}
