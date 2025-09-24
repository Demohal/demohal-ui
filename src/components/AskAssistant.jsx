// Full reconciled AskAssistant.jsx
// All canonical UI behaviors restored per mismatch list.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_THEME_VARS, inverseBW, UI, TabsNav } from "./AskAssistant/AskAssistant.ui";
import ColorBox from "./AskAssistant/widgets/ColorBox";
import DocIframe from "./AskAssistant/widgets/DocIframe";
import DebugPanel from "./AskAssistant/widgets/DebugPanel";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // --- URL args ---
  const { alias, botIdFromUrl, themeLabOn } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const th = (qs.get("themelab") || "").trim();
    return {
      alias: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
      themeLabOn: th === "1" || th.toLowerCase() === "true",
    };
  }, []);
  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  // --- State ---
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");
  const [mode, setMode] = useState("browse");
  const [input, setInput] = useState("");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scopePayload, setScopePayload] = useState({ scope: "standard" });

  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  const inputRef = useRef(null);
  const frameRef = useRef(null);

  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const idHeaders = useMemo(
    () => ({
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
    }),
    [sessionId, visitorId]
  );

  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);

  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });

  // --- Form placeholder ---
  const LS_KEY = "dh_form_v1";
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [pendingTab, setPendingTab] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && (saved.name || saved.email || saved.company)) {
          setForm(saved);
          setFormSubmitted(true);
        }
      }
    } catch {}
  }, []);

  // --- Scope update ---
  useEffect(() => {
    if (selected && selected.id && mode === "docs") {
      setScopePayload({ scope: "doc", doc_id: String(selected.id) });
    } else if (selected && selected.id && mode !== "docs") {
      setScopePayload({ scope: "demo", demo_id: String(selected.id) });
    } else {
      setScopePayload({ scope: "standard" });
    }
  }, [selected, mode]);

  // --- Send logic ---
  async function reallySend(q) {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idHeaders },
        body: JSON.stringify({
          bot_id: botId,
          user_question: q,
          debug: false,
          ...scopePayload,
          form_capture: formSubmitted ? form : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const text =
        data?.response_text ||
        data?.answer?.text ||
        data?.message ||
        data?.text ||
        data?.error ||
        "OK.";
      setResponseText(String(text || "").trim());

      // normalize items/buttons
      const recs = [];
      if (Array.isArray(data?.items)) recs.push(...data.items);
      if (Array.isArray(data?.buttons)) recs.push(...data.buttons);
      setItems(recs);
    } catch {
      setResponseText("Network error.");
    } finally {
      setLoading(false);
      setInput("");
    }
  }

  function sendMessage() {
    const q = (input || "").trim();
    if (!q) return;
    if (!formSubmitted) {
      setPendingQuestion(q);
      setShowForm(true);
      return;
    }
    reallySend(q);
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  }

  // --- Tabs ---
  const tabs = useMemo(
    () => [
      { key: "browse", label: "Browse Demos" },
      { key: "docs", label: "Browse Documents" },
      { key: "price", label: "Price Estimate" },
      { key: "meeting", label: "Schedule Meeting" },
    ],
    []
  );
  function onTabClick(nextMode) {
    if (!formSubmitted) {
      setPendingTab(nextMode);
      setShowForm(true);
      return;
    }
    setMode(nextMode);
  }

  // --- Form ---
  function validateForm(f) {
    const errs = {};
    if (!f.name.trim()) errs.name = "Required";
    if (!f.email.trim()) errs.email = "Required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) errs.email = "Invalid";
    return errs;
  }
  function saveForm(f) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(f)); } catch {}
    setFormSubmitted(true);
  }
  function submitForm(e) {
    e?.preventDefault?.();
    const errs = validateForm(form);
    setFormErrors(errs);
    if (Object.keys(errs).length) return;
    saveForm(form);
    setShowForm(false);
    if (pendingQuestion) { reallySend(pendingQuestion); setPendingQuestion(""); }
    else if (pendingTab) { setMode(pendingTab); setPendingTab(null); }
  }

  return (
    <div className="min-h-screen" style={derivedTheme}>
      {/* Container */}
      <div className="max-w-3xl mx-auto mt-8 mb-10 rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-elevation, 0 10px 30px rgba(0,0,0,.08))" }}>
        {/* Banner */}
        <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brandAssets.logo_url ? (
              <img src={brandAssets.logo_url} alt="logo" className="h-8 w-auto" />
            ) : (
              <div className="font-extrabold">DemoHAL</div>
            )}
          </div>
          <div className="text-sm font-semibold" style={{ color: "#22c55e" }}>Ask the Assistant</div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3">
          <TabsNav mode={mode} tabs={tabs.map((t) => ({ ...t, onClick: () => onTabClick(t.key) }))} />
        </div>

        {/* Body */}
        <div className="px-4 pb-4">
          {fatal ? (
            <div className={UI.CARD} style={{ border: "1px solid #ef4444" }}>
              <div className="font-bold text-red-600">Error</div>
              <div>{fatal}</div>
            </div>
          ) : (
            <div className={UI.CARD}>
              {responseText ? <div className="text-base whitespace-pre-line text-[var(--message-fg)]">{responseText}</div> : null}
              {showIntroVideo && introVideoUrl ? (
                <div className="mt-3">
                  <iframe title="intro" src={introVideoUrl} className="w-full aspect-video rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                </div>
              ) : null}

              {/* Ask bar with inside arrow button */}
              <div className="mt-3 relative">
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="Ask your question here" className={UI.FIELD + " pr-12"} />
                <button type="button" className={UI.BTN_SEND + " !absolute !right-2 !top-1/2 -translate-y-1/2"} onClick={sendMessage} disabled={loading || !input.trim()} title="Send" aria-label="Send">↗</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ThemeLab */}
      {themeLabOn && botId ? <ColorBox apiBase={apiBase} botId={botId} frameRef={frameRef} onVars={(vars) => setThemeVars((prev) => ({ ...prev, ...vars }))} /> : null}

      {/* Form Modal */}
      {showForm ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div className={UI.CARD} style={{ width: 560, maxWidth: "90vw" }}>
            <div className="font-bold text-lg mb-2">Tell us a bit about you</div>
            <form onSubmit={submitForm} className="grid gap-2">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input className={UI.FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
                {formErrors.name ? <div className="text-red-600 text-xs mt-1">{formErrors.name}</div> : null}
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input className={UI.FIELD} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" type="email" />
                {formErrors.email ? <div className="text-red-600 text-xs mt-1">{formErrors.email}</div> : null}
              </div>
              <div>
                <label className="block text-sm mb-1">Company (optional)</label>
                <input className={UI.FIELD} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" className={UI.BTN_DOC} onClick={() => { setShowForm(false); setPendingQuestion(""); setPendingTab(null); }}>Cancel</button>
                <button type="submit" className={UI.BTN_DOC}>Continue</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Debug */}
      <DebugPanel debug={{ active_context: scopePayload }} />
    </div>
  );
}
