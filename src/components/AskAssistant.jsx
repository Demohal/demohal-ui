import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_THEME_VARS, inverseBW, UI, TabsNav } from "./AskAssistant/AskAssistant.ui";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // Debug
  const [stage, setStage] = useState("boot");

  // URL args
  const { alias, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      alias: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
    };
  }, []);
  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  // Core state
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");
  const [mode, setMode] = useState("browse"); // tabs switch this
  const [input, setInput] = useState("");
  const [responseText, setResponseText] = useState(""); // welcome + answers
  const [loading, setLoading] = useState(false);

  // Intro video
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // Refs
  const inputRef = useRef(null);

  // Identity
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const idHeaders = useMemo(
    () => ({
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
    }),
    [sessionId, visitorId]
  );

  // Theme
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);

  // Brand
  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });

  // -------- Form-capture (placeholder) --------
  const LS_KEY = "dh_form_v1";
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [pendingTab, setPendingTab] = useState(null); // "browse" | "docs" | "price" | "meeting"

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

  // ---- Resolve bot ----
  useEffect(() => {
    let cancel = false;
    async function loadBy(u) {
      setStage("fetch:bot-settings");
      const res = await fetch(u);
      const data = await res.json().catch(() => ({}));
      if (cancel) return;

      if (!res.ok || data?.ok === false || !data?.bot?.id) {
        setFatal("Invalid or inactive alias."); setStage("fatal"); return;
      }
      setVisitorId(data.visitor_id || ""); setSessionId(data.session_id || "");

      const b = data.bot || {};
      setResponseText(b.welcome_message || "");
      setIntroVideoUrl(b.intro_video_url || ""); setShowIntroVideo(!!b.show_intro_video);

      setBotId(b.id); setFatal(""); setStage("ok:botId");
    }
    (async () => {
      try {
        if (botIdFromUrl) { await loadBy(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`); return; }
        const useAlias = alias || defaultAlias;
        if (!useAlias) { setFatal("Invalid or inactive alias."); setStage("fatal"); return; }
        await loadBy(`${apiBase}/bot-settings?alias=${encodeURIComponent(useAlias)}`);
      } catch { setFatal("Invalid or inactive alias."); setStage("fatal"); }
    })();
    return () => { cancel = true; };
  }, [apiBase, alias, botIdFromUrl, defaultAlias]);

  // ---- Brand ----
  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      setStage("fetch:brand");
      try {
        const res = await fetch(`${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancel) return;

        if (data?.ok && data?.css_vars && typeof data.css_vars === "object") {
          setThemeVars((p) => ({ ...p, ...data.css_vars }));
        }
        if (data?.ok && data?.assets) {
          setBrandAssets({
            logo_url: data.assets.logo_url || null,
            logo_light_url: data.assets.logo_light_url || null,
            logo_dark_url: data.assets.logo_dark_url || null,
          });
        }
        setStage("ok:brand");
      } catch { setStage("warn:brand"); }
    })();
    return () => { cancel = true; };
  }, [botId, apiBase]);

  // Autosize
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Tabs (visible & wired)
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
    if (!formSubmitted) { setPendingTab(nextMode); setShowForm(true); return; }
    setMode(nextMode);
  }

  // Send
  async function reallySend(q) {
    setLoading(true); setStage("ask:posting");
    try {
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idHeaders },
        body: JSON.stringify({
          bot_id: botId,
          user_question: q,
          debug: false,
          scope: "standard",
          form_capture: formSubmitted ? form : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const text = data?.response_text || data?.answer?.text || data?.message || data?.text || data?.error || "OK.";
      setResponseText(String(text || "").trim());
      setStage(res.ok ? "ask:ok" : "ask:error");
    } catch { setResponseText("Network error."); setStage("ask:network-error"); }
    finally { setLoading(false); setInput(""); setTimeout(() => inputRef.current?.focus(), 0); }
  }
  function sendMessage() {
    const q = (input || "").trim(); if (!q) return;
    if (!botId) { setFatal("Invalid or inactive alias."); return; }
    if (!formSubmitted) { setPendingQuestion(q); setShowForm(true); return; }
    reallySend(q);
  }
  function onKeyDown(e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); sendMessage(); } }

  // Form helpers
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
    const errs = validateForm(form); setFormErrors(errs);
    if (Object.keys(errs).length) return;
    saveForm(form); setShowForm(false);
    if (pendingQuestion) { const q = pendingQuestion; setPendingQuestion(""); reallySend(q); }
    else if (pendingTab) { const t = pendingTab; setPendingTab(null); setMode(t); }
  }

  return (
    <div className="min-h-screen" style={derivedTheme}>
      {/* Stage */}
      <div style={{ position: "fixed", right: 8, top: 8, zIndex: 9999, background: "#000", color: "#fff", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
        Stage: {stage || "-"}
      </div>

      {/* Containerized banner */}
      <div className="w-full" style={{ background: "var(--banner-bg)", color: "var(--banner-fg)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brandAssets.logo_url ? (
              <img src={brandAssets.logo_url} alt="logo" className="h-8 w-auto" />
            ) : (
              <div className="font-extrabold">DemoHAL</div>
            )}
          </div>
          <div className="text-sm font-semibold" style={{ color: "#22c55e" }}>
            Ask the Assistant
          </div>
        </div>
      </div>

      {/* Tabs inside container */}
      <div className="max-w-3xl mx-auto px-4 mt-3">
        <TabsNav
          mode={mode}
          tabs={tabs.map((t) => ({ ...t, onClick: () => onTabClick(t.key) }))}
        />
      </div>

      {/* Body (inside same container width) */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {fatal ? (
          <div className={UI.CARD} style={{ border: "1px solid #ef4444" }}>
            <div className="font-bold text-red-600">Error</div>
            <div>{fatal}</div>
          </div>
        ) : (
          <div className={UI.CARD}>
            {/* Welcome / Response */}
            {responseText ? (
              <div className="text-base whitespace-pre-line text-[var(--message-fg)]">
                {responseText}
              </div>
            ) : null}

            {/* Intro video */}
            {showIntroVideo && introVideoUrl ? (
              <div className="mt-3">
                <iframe
                  title="intro"
                  src={introVideoUrl}
                  className="w-full aspect-video rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : null}

            {/* Ask row with circular send button */}
            <div className="mt-3 flex items-stretch gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask your question here"
                className={UI.FIELD}
              />
              <button
                type="button"
                className={UI.BTN_SEND}
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                title="Send"
                aria-label="Send"
              >
                ↗
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div className={UI.CARD} style={{ width: 560, maxWidth: "90vw" }}>
            <div className="font-bold text-lg mb-2">Tell us a bit about you</div>
            <form onSubmit={submitForm} className="grid gap-2">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  className={UI.FIELD}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
                {formErrors.name ? <div className="text-red-600 text-xs mt-1">{formErrors.name}</div> : null}
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  className={UI.FIELD}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@company.com"
                  type="email"
                />
                {formErrors.email ? <div className="text-red-600 text-xs mt-1">{formErrors.email}</div> : null}
              </div>
              <div>
                <label className="block text-sm mb-1">Company (optional)</label>
                <input
                  className={UI.FIELD}
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Company"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  className={UI.BTN_DOC}
                  onClick={() => {
                    setShowForm(false);
                    setPendingQuestion("");
                    setPendingTab(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={UI.BTN_DOC}>
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
