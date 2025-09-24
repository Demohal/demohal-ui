import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_THEME_VARS, inverseBW, UI, TabsNav } from "./AskAssistant/AskAssistant.ui";
import ColorBox from "./AskAssistant/widgets/ColorBox";
import DocIframe from "./AskAssistant/widgets/DocIframe"; // uses iframe_html from backend

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // ---------------- URL args ----------------
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

  // ---------------- Core state ----------------
  const [stage, setStage] = useState("boot");
  const [fatal, setFatal] = useState("");
  const [botId, setBotId] = useState(botIdFromUrl || "");

  const [mode, setMode] = useState("browse"); // "browse" | "docs" | "price" | "meeting" | "ask"
  const [input, setInput] = useState("");
  const [responseText, setResponseText] = useState(""); // welcome + answers
  const [loading, setLoading] = useState(false);

  // tabs content
  const [items, setItems] = useState([]);        // demos
  const [browseDocs, setBrowseDocs] = useState([]); // docs
  const [selected, setSelected] = useState(null);   // current demo/doc

  // intro video
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // ids for logging / headers
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const idHeaders = useMemo(
    () => ({
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
    }),
    [sessionId, visitorId]
  );

  // theme / brand
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);

  // ask box refs
  const inputRef = useRef(null);

  // ---------- Form-capture (placeholder; persists once) ----------
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

  // ---------------- Resolve bot ----------------
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

  // ---------------- Brand ----------------
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

  // ---------------- Tabs & fetchers ----------------
  const tabs = useMemo(
    () => [
      { key: "browse", label: "Browse Demos" },
      { key: "docs", label: "Browse Documents" },
      { key: "price", label: "Price Estimate" },
      { key: "meeting", label: "Schedule Meeting" },
    ],
    []
  );

  async function fetchDemos() {
    if (!botId) return;
    const url = `${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`;
    const res = await fetch(url, { headers: { ...idHeaders } });
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data?.demos) ? data.demos : []);
  }

  async function fetchDocs() {
    if (!botId) return;
    const url = `${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`;
    const res = await fetch(url, { headers: { ...idHeaders } });
    const data = await res.json().catch(() => ({}));
    setBrowseDocs(Array.isArray(data?.docs) ? data.docs : []);
  }

  useEffect(() => {
    if (!botId) return;
    if (mode === "browse") fetchDemos();
    if (mode === "docs") fetchDocs();
  }, [mode, botId]);

  function onTabClick(nextMode) {
    if (!formSubmitted) { setPendingTab(nextMode); setShowForm(true); return; }
    setSelected(null);
    setMode(nextMode);
  }

  // ---------------- View doc (uses DocIframe) ----------------
  const [docIframeHtml, setDocIframeHtml] = useState("");
  useEffect(() => {
    let abort = false;
    async function loadDocIframe() {
      if (!selected || mode !== "docs") return;
      setDocIframeHtml("");
      try {
        const res = await fetch(`${apiBase}/render-doc-iframe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...idHeaders },
          body: JSON.stringify({ bot_id: botId, doc_id: selected.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!abort) setDocIframeHtml(data?.iframe_html || "");
      } catch { if (!abort) setDocIframeHtml(""); }
    }
    loadDocIframe();
    return () => { abort = true; };
  }, [selected, mode, botId]);

  // ---------------- Ask flow ----------------
  function currentScope() {
    if (selected && mode === "docs") return { scope: "doc", doc_id: String(selected.id) };
    if (selected && mode === "browse") return { scope: "demo", demo_id: String(selected.id) };
    return { scope: "standard" };
  }

  async function reallySend(q) {
    setLoading(true);
    setMode("ask");               // show answer in shell
    setSelected(null); setItems([]); setBrowseDocs([]);
    try {
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idHeaders },
        body: JSON.stringify({
          bot_id: botId,
          user_question: q,
          debug: false,
          ...currentScope(),
          form_capture: formSubmitted ? form : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const text = data?.response_text || data?.answer?.text || data?.message || data?.text || data?.error || "OK.";
      setResponseText(String(text || "").trim());
    } catch { setResponseText("Network error."); }
    finally { setLoading(false); setInput(""); setTimeout(() => inputRef.current?.focus(), 0); }
  }

  function sendMessage() {
    const q = (input || "").trim(); if (!q) return;
    if (!botId) { setFatal("Invalid or inactive alias."); return; }
    if (!formSubmitted) { setPendingQuestion(q); setShowForm(true); return; }
    reallySend(q);
  }
  function onKeyDown(e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); sendMessage(); } }

  // ---------------- Form helpers ----------------
  function validateForm(f) {
    const errs = {};
    if (!f.name.trim()) errs.name = "Required";
    if (!f.email.trim()) errs.email = "Required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) errs.email = "Invalid";
    return errs;
  }
  function saveForm(f) { try { localStorage.setItem(LS_KEY, JSON.stringify(f)); } catch {}; setFormSubmitted(true); }
  function submitForm(e) {
    e?.preventDefault?.();
    const errs = validateForm(form); setFormErrors(errs);
    if (Object.keys(errs).length) return;
    saveForm(form); setShowForm(false);
    if (pendingQuestion) { const q = pendingQuestion; setPendingQuestion(""); reallySend(q); }
    else if (pendingTab) { const t = pendingTab; setPendingTab(null); setMode(t); }
  }

  // ---------------- UI ----------------
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  return (
    <div className="min-h-screen" style={derivedTheme}>
      {/* stage pill */}
      <div style={{ position: "fixed", right: 8, top: 8, zIndex: 9999, background: "#000", color: "#fff", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
        Stage: {stage || "-"}
      </div>

      {/* fixed-width container with banner inside */}
      <div className="max-w-3xl mx-auto mt-8 mb-10 rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-elevation, 0 10px 30px rgba(0,0,0,.08))" }}>
        {/* banner */}
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

        {/* tabs */}
        <div className="px-4 pt-3">
          <TabsNav
            mode={mode}
            tabs={[
              { key: "browse", label: "Browse Demos", onClick: () => onTabClick("browse") },
              { key: "docs", label: "Browse Documents", onClick: () => onTabClick("docs") },
              { key: "price", label: "Price Estimate", onClick: () => onTabClick("price") },
              { key: "meeting", label: "Schedule Meeting", onClick: () => onTabClick("meeting") },
            ]}
          />
        </div>

        {/* body */}
        <div className="px-4 pb-4">
          {fatal ? (
            <div className={UI.CARD} style={{ border: "1px solid #ef4444" }}>
              <div className="font-bold text-red-600">Error</div>
              <div>{fatal}</div>
            </div>
          ) : (
            <div className={UI.CARD}>
              {/* Welcome / Answer */}
              {responseText ? (
                <div className="text-base whitespace-pre-line text-[var(--message-fg)]">{responseText}</div>
              ) : null}

              {/* Intro video (only when no selection) */}
              {showIntroVideo && introVideoUrl && !selected && (mode === "browse" || mode === "docs" || mode === "ask") ? (
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

              {/* Browse Demos list */}
              {mode === "browse" && !selected ? (
                <div className="mt-3 space-y-3">
                  {items.length === 0 ? (
                    <div className="text-sm opacity-70">No demos available.</div>
                  ) : (
                    items.map((d) => (
                      <button
                        key={d.id}
                        className={UI.LIST_BTN}
                        onClick={() => setSelected({ ...d, kind: "demo" })}
                        title="View demo"
                      >
                        <div className="font-semibold">{d.title || d.name}</div>
                        {d.description ? <div className="text-xs opacity-80">{d.description}</div> : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}

              {/* Browse Docs list */}
              {mode === "docs" && !selected ? (
                <div className="mt-3 space-y-3">
                  {browseDocs.length === 0 ? (
                    <div className="text-sm opacity-70">No documents available.</div>
                  ) : (
                    browseDocs.map((doc) => (
                      <button
                        key={doc.id}
                        className={UI.LIST_BTN}
                        onClick={() => setSelected({ ...doc, kind: "doc" })}
                        title="View document"
                      >
                        <div className="font-semibold">{doc.title || doc.name}</div>
                        {doc.description ? <div className="text-xs opacity-80">{doc.description}</div> : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}

              {/* View Demo (simple iframe from embed_url/url) */}
              {selected && selected.kind === "demo" ? (
                <div className="mt-3">
                  <iframe
                    title={selected.title || "Demo"}
                    src={selected.embed_url || selected.url}
                    className="w-full aspect-video rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : null}

              {/* View Doc (server-provided iframe_html) */}
              {selected && selected.kind === "doc" ? (
                <div className="mt-3">
                  <DocIframe iframeHtml={docIframeHtml} />
                </div>
              ) : null}

              {/* Ask bar with green arrow inside */}
              <div className="mt-3 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask your question here"
                  className={UI.FIELD + " pr-12"}
                />
                <button
                  type="button"
                  className={UI.BTN_SEND + " !absolute !right-2 !top-1/2 -translate-y-1/2"}
                  onClick={
