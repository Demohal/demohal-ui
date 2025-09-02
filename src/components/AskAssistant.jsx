// src/components/AskAssistant.jsx
// Monolithic with inline ThemeLab. Live preview fixes:
//  - Color inputs fire onInput (live while dragging) + onChange (on close)
//  - Preview iframe re-syncs vars onLoad

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AppShell from "./shared/AppShell";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

// Hooks
import useBotState from "../hooks/useBotState";
import useBrandTokens from "../hooks/useBrandTokens";
import useAsk from "../hooks/useAsk";
import usePricing from "../hooks/usePricing";
import useDemos from "../hooks/useDemos";
import useDocs from "../hooks/useDocs";
import useAgent from "../hooks/useAgent";

// Screens
import AskView from "./screens/AskView";
import BrowseDemos from "./screens/BrowseDemos";
import ViewDemo from "./screens/ViewDemo";
import BrowseDocs from "./screens/BrowseDocs";
import ViewDoc from "./screens/ViewDoc";
import PriceEstimate from "./screens/PriceEstimate";
import ScheduleMeeting from "./screens/ScheduleMeeting";

// Assets
import fallbackLogo from "../assets/logo.png";

/* --------------------------- ThemeLab (inline) --------------------------- */
function ThemeLab({ apiBase }) {
  const qs = new URLSearchParams(window.location.search);
  const alias = (qs.get("alias") || "").trim();
  const botIdFromUrl = (qs.get("bot_id") || "").trim();

  const snakeToKebab = (s) => String(s || "").trim().replace(/_/g, "-");
  const tokenKeyToCssVar = (k) => `--${snakeToKebab(k)}`;

  const [botId, setBotId] = useState(botIdFromUrl);
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const iframeRef = useRef(null);

  useEffect(() => {
    if (botId || !alias) return;
    let stop = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (!stop && data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch {}
    })();
    return () => { stop = true; };
  }, [alias, botId, apiBase]);

  useEffect(() => {
    if (!botId) return;
    let stop = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const urls = [
          `${apiBase}/brand/tokens?bot_id=${encodeURIComponent(botId)}`,
          `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`,
        ];
        let rows = [];
        for (const url of urls) {
          try {
            const r = await fetch(url);
            const j = await r.json();
            const items = j?.items || j?.tokens || j?.rows || [];
            if (Array.isArray(items) && items.length) { rows = items; break; }
          } catch {}
        }
        if (stop) return;
        const filtered = rows.filter((r) => r.client_controlled !== false);
        setTokens(filtered);
        setDraft({});
        const vars = {};
        for (const t of filtered) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
        iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
      } catch (e) {
        if (!stop) setError("Unable to load tokens.");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [botId, apiBase]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const t of tokens) {
      const g = t.group_key || t.group_label || t.screen_key || "General";
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(t);
    }
    return Array.from(m.entries());
  }, [tokens]);

  const onChangeToken = (t, value) => {
    const key = t.token_key || t.key;
    const cssVar = tokenKeyToCssVar(key);
    setDraft((prev) => ({ ...prev, [key]: value }));
    iframeRef.current?.contentWindow?.postMessage(
      { type: "preview:theme", payload: { vars: { [cssVar]: value } } },
      window.location.origin
    );
    const screen = t.screen_key || t.screen;
    if (screen) {
      iframeRef.current?.contentWindow?.postMessage({ type: "preview:go", payload: { screen } }, window.location.origin);
    }
  };

  const onSave = async () => {
    if (!botId || !Object.keys(draft).length) return;
    setSaving(true);
    setError("");
    try {
      const body = { bot_id: botId, tokens: draft, commit_key: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) };
      const res = await fetch(`${apiBase}/brand/update-tokens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Save failed");
      setDraft({});
      iframeRef.current?.contentWindow?.postMessage({ type: "preview:reload" }, window.location.origin);
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    setDraft({});
    const vars = {};
    for (const t of tokens) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
    iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
  };

  const previewSrc = useMemo(() => {
    const q = new URLSearchParams();
    if (alias) q.set("alias", alias);
    if (botId) q.set("bot_id", botId);
    q.set("preview", "1");
    return `${window.location.origin}/?${q.toString()}`;
  }, [alias, botId]);

  return (
    <div className="w-screen h-[100dvh] grid grid-cols-1 md:grid-cols-[300px_1fr]">
      <div className="border-r border-gray-200 p-4 overflow-y-auto bg-white">
        <div className="text-sm font-semibold mb-2 text-black">Theme Editor</div>
        <div className="text-xs text-black mb-4">{botId ? <>bot_id <code>{botId}</code></> : alias ? <>alias <code>{alias}</code> (resolving…)</> : "Provide alias or bot_id in the URL."}</div>
        {loading ? <div className="text-xs text-black mb-4">Loading tokens…</div> : null}
        {error ? <div className="text-xs text-red-600 mb-4">{error}</div> : null}
        {grouped.map(([grp, rows]) => (
          <div key={grp} className="mb-6">
            <div className="text-[0.8rem] font-bold mb-2 text-black">{grp}</div>
            <div className="space-y-2">
              {rows.map((t) => {
                const key = t.token_key || t.key;
                const type = (t.input_type || t.token_type || "color").toLowerCase();
                const val = draft[key] ?? t.value ?? "";
                const label = t.label || key;
                const screenKey = t.screen_key || t.screen || null;
                return (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-2 hover:bg-gray-50" onClick={() => { if (screenKey) { iframeRef.current?.contentWindow?.postMessage({ type: "preview:go", payload: { screen: screenKey } }, window.location.origin); } }}>
                    <div className="text-[0.8rem] text-black">
                      <div className="font-medium">{label}</div>
                      {t.description ? <div className="text-[0.7rem] text-black/70">{t.description}</div> : null}
                    </div>
                    {type === "boolean" ? (
                      <input type="checkbox" checked={String(val) === "1" || String(val).toLowerCase() === "true"} onChange={(e) => onChangeToken(t, e.target.checked ? "1" : "0")} />
                    ) : type === "length" || type === "number" ? (
                      <input type="text" className="w-28 border rounded px-2 py-1 text-sm text-black" value={val} onChange={(e) => onChangeToken(t, e.target.value)} placeholder={type === "length" ? "0.75rem" : "number"} />
                    ) : (
                      <input
                        type="color"
                        className="w-12 h-8 border rounded cursor-pointer"
                        value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val) ? val : "#ffffff"}
                        onChange={(e) => onChangeToken(t, e.target.value)}
                        onInput={(e) => onChangeToken(t, e.target.value)}
                        onBlur={(e) => onChangeToken(t, e.target.value)}
                        title={val}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="sticky bottom-0 pt-3 bg-white border-t border-gray-200 mt-6">
          <button className="w-full mb-2 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm text-black" onClick={onDiscard} disabled={saving || !Object.keys(draft).length}>Discard</button>
          <button className="w-full py-2 rounded bg-black text-white hover:opacity-90 text-sm disabled:opacity-50" onClick={onSave} disabled={saving || !Object.keys(draft).length}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
      <div className="bg-gray-50">
        <iframe
          ref={iframeRef}
          title="Preview"
          src={previewSrc}
          className="w-full h-full border-0"
          onLoad={() => {
            const vars = {};
            for (const t of tokens) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
            for (const [k, v] of Object.entries(draft || {})) vars[tokenKeyToCssVar(k)] = v;
            iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
          }}
        />
      </div>
    </div>
  );
}
/* ------------------------ End ThemeLab (inline) ------------------------- */

const DEFAULT_THEME_VARS = {
  "--banner-bg": "#0b1015",
  "--banner-fg": "#ffffff",
  "--page-bg": "#EFF2F5",
  "--card-bg": "#FFFFFF",
  "--card-border": "#E5E7EB",
  "--radius-card": "1rem",
  "--shadow-card": "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",
  "--field-bg": "#FFFFFF",
  "--field-border": "#9CA3AF",
  "--send-color": "#EA4335",
  "--send-color-hover": "#C03327",
};

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com";
  const { aliasFromUrl, botIdFromUrl, previewEnabled, themeLabEnabled } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      aliasFromUrl: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
      previewEnabled: qs.get("preview") === "1",
      themeLabEnabled: qs.get("themelab") === "1",
    };
  }, []);

  if (themeLabEnabled) return <ThemeLab apiBase={apiBase} />;

  const { botId, fatal, tabsEnabled, welcomeMessage, introVideoUrl, showIntroVideo, titleFor, bot } = useBotState({
    apiBase,
    initialBotId: botIdFromUrl,
    initialAlias: aliasFromUrl,
    defaultAlias: (import.meta.env.VITE_DEFAULT_ALIAS || "demo").trim(),
  });

  const { themeVars } = useBrandTokens({ apiBase, botId, fallback: DEFAULT_THEME_VARS });

  const [previewVars, setPreviewVars] = useState({});

  const [vcConfig, setVcConfig] = useState({ show_flag: false, message: "", skip_param: "dh_skip_capture" });
  const [vcFields, setVcFields] = useState([]);
  const [vcLoaded, setVcLoaded] = useState(false);
  const [vcOpen, setVcOpen] = useState(false);
  const [vcSubmitting, setVcSubmitting] = useState(false);
  const [vcErr, setVcErr] = useState("");
  const [vcName, setVcName] = useState("");
  const [vcEmail, setVcEmail] = useState("");
  const [vcExtras, setVcExtras] = useState({});
  const [deferredAction, setDeferredAction] = useState(null);

  const [mode, setMode] = useState("ask");
  const [selected, setSelected] = useState(null);

  const { input, setInput, lastQuestion, responseText, recommendations, loading: askLoading, send } = useAsk({ apiBase, botId });
  const { items: demoItems, loading: demosLoading, error: demosError, load: loadDemos } = useDemos({ apiBase, botId, autoLoad: false });
  const { items: docItems, loading: docsLoading, error: docsError, load: loadDocs } = useDocs({ apiBase, botId, autoLoad: false });
  const { agent, loading: agentLoading, error: agentError, refresh: refreshAgent } = useAgent({ apiBase, botId });
  const { uiCopy, answers, estimate, loadingQuestions, estimating, errorQuestions, errorEstimate, loadQuestions, setAnswer, toggleMulti, nextQuestion, mirrorLines } = usePricing({ apiBase, botId, autoCompute: true });

  const contentRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }, [input]);

  const vcKey = useMemo(() => (botId ? `vc::${botId}::done` : ""), [botId]);
  useEffect(() => {
    let stop = false;
    async function loadVC() {
      if (!botId) return;
      try {
        const url = new URL(`${apiBase}/visitor-capture/config`);
        url.searchParams.set("bot_id", botId);
        const r = await fetch(url.toString());
        const j = await r.json();
        const cfg = j?.config || {};
        const fields = Array.isArray(j?.fields) ? j.fields : [];
        if (stop) return;
        setVcConfig({ show_flag: !!cfg.show_flag, message: cfg.message || "", skip_param: (cfg.skip_param || "dh_skip_capture").trim() });
        setVcFields(fields);
        const qs = new URLSearchParams(window.location.search);
        const skipParam = (cfg.skip_param || "dh_skip_capture").trim();
        const hasSkip = skipParam && (qs.get(skipParam) || "").toLowerCase() === "1";
        if (hasSkip && vcKey) localStorage.setItem(vcKey, "1");
      } catch {} finally { if (!stop) setVcLoaded(true); }
    }
    loadVC();
    return () => { stop = true; };
  }, [apiBase, botId, vcKey]);

  const vcCompleted = useMemo(() => (vcKey ? localStorage.getItem(vcKey) === "1" : true), [vcKey]);
  const gatingActive = useMemo(() => vcLoaded && vcConfig.show_flag && !vcCompleted, [vcLoaded, vcConfig.show_flag, vcCompleted]);

  const validEmail = (s) => { const str = String(s || "").trim(); return str.includes("@") && str.split("@")[1]?.includes("."); };

  const openVC = useCallback((after) => { setDeferredAction(() => (typeof after === "function" ? after : null)); setVcOpen(true); setVcErr(""); }, []);
  const finishVC = useCallback(() => { if (vcKey) localStorage.setItem(vcKey, "1"); setVcOpen(false); const run = deferredAction; setDeferredAction(null); if (typeof run === "function") run(); }, [deferredAction, vcKey]);

  const submitVC = useCallback(async () => {
    setVcErr("");
    const name = (vcName || "").trim();
    const email = (vcEmail || "").trim();
    if (!name) return setVcErr("Please enter your name.");
    if (!validEmail(email)) return setVcErr("Please enter a valid email address.");
    setVcSubmitting(true);
    try {
      const sidKey = botId ? `sid::${botId}` : "sid::generic";
      let session_id = sessionStorage.getItem(sidKey);
      if (!session_id && window.crypto && crypto.randomUUID) { session_id = crypto.randomUUID(); sessionStorage.setItem(sidKey, session_id); }
      const body = { bot_id: botId, session_id, name, email, extras: vcExtras, landing_path: window.location.pathname + window.location.search };
      const r = await fetch(`${apiBase}/visitor-capture/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Failed to save");
      finishVC();
    } catch (e) { setVcErr(e.message || "Something went wrong. Please try again."); } finally { setVcSubmitting(false); }
  }, [apiBase, botId, vcName, vcEmail, vcExtras, finishVC]);

  const requireCaptureOr = useCallback((fn) => { if (gatingActive) openVC(fn); else fn(); }, [gatingActive, openVC]);

  const openAsk = () => { setMode("ask"); setSelected(null); requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" })); };
  const openBrowse = () => { setMode("browse"); setSelected(null); loadDemos(); requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" })); };
  const openBrowseDocs = () => { setMode("docs"); setSelected(null); loadDocs(); requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" })); };
  const openPrice = () => { setMode("price"); setSelected(null); loadQuestions(); requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" })); };
  const openMeeting = () => { setMode("meeting"); setSelected(null); refreshAgent(); requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" })); };

  const tabs = useMemo(() => {
    const out = [];
    if (tabsEnabled.demos) out.push({ key: "demos", label: "Browse Demos", active: mode === "browse", onClick: () => requireCaptureOr(openBrowse) });
    if (tabsEnabled.docs) out.push({ key: "docs", label: "Browse Documents", active: mode === "docs", onClick: () => requireCaptureOr(openBrowseDocs) });
    if (tabsEnabled.price) out.push({ key: "price", label: "Price Estimate", active: mode === "price", onClick: () => requireCaptureOr(openPrice) });
    if (tabsEnabled.meeting) out.push({ key: "meeting", label: "Schedule Meeting", active: mode === "meeting", onClick: () => requireCaptureOr(openMeeting) });
    return out;
  }, [tabsEnabled, mode, requireCaptureOr]);

  async function onPickDemo(item) {
    try {
      const r = await fetch(`${apiBase}/render-video-iframe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video_url: item.url }) });
      const j = await r.json();
      const embed = j?.video_url || item.url;
      setSelected({ ...item, url: embed });
    } catch { setSelected(item); }
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  }

  const bannerTitle = selected?.title || titleFor(mode, selected);

  function onPickPriceOption(q, opt) { if (!q) return; if (q.type === "multi_choice") toggleMulti(q.q_key, opt.key); else setAnswer(q.q_key, opt.key); }
  const nextQAugmented = nextQuestion ? { ...nextQuestion, _value: answers[nextQuestion.q_key] } : null;

  useEffect(() => {
    if (previewEnabled !== true) return;
    function onMsg(e) {
      if (e.origin !== window.location.origin) return;
      const { type, payload } = e.data || {};
      if (type === "preview:theme") {
        const vars = (payload && payload.vars) || {};
        setPreviewVars((prev) => ({ ...prev, ...vars }));
        try { const root = document.documentElement; Object.entries(vars).forEach(([k, v]) => { if (k && typeof v === "string") root.style.setProperty(k, v); }); } catch {}
      } else if (type === "preview:go") {
        if (payload && payload.screen) {
          const screen = String(payload.screen);
          switch (screen) {
            case "intro": setSelected(null); setMode("ask"); break;
            case "ask": openAsk(); break;
            case "browse": openBrowse(); break;
            case "view_demo": openBrowse(); setTimeout(() => setSelected((prev) => (prev || (demoItems?.[0] || null))), 0); break;
            case "docs": openBrowseDocs(); break;
            case "view_doc": openBrowseDocs(); setTimeout(() => setSelected((prev) => (prev || (docItems?.[0] || null))), 0); break;
            case "price_questions": openPrice(); break;
            case "price_results": openPrice(); break;
            case "meeting": openMeeting(); break;
            default: break;
          }
        }
      } else if (type === "preview:reload") {
        window.location.reload();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [previewEnabled]);

  if (fatal) {
    return (<div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4"><div className="text-red-600 font-semibold">{fatal}</div></div>);
  }
  if (!botId) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center" style={DEFAULT_THEME_VARS}>
        <div className="text-gray-800 text-center space-y-2"><div className="text-lg font-semibold">Resolving bot…</div></div>
      </div>
    );
  }

  const logoUrl = bot?.logo_url || bot?.logo_light_url || bot?.logo_dark_url || fallbackLogo;

  return (
    <>
      <AppShell
        title={bannerTitle}
        logoUrl={logoUrl}
        tabs={tabs}
        askValue={input}
        askPlaceholder="Ask your question here"
        onAskChange={(v) => { setInput(v); const el = inputRef.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
        onAskSend={(text) => requireCaptureOr(() => { setMode("ask"); setSelected(null); send(text); })}
        themeVars={{ ...themeVars, ...previewVars }}
        askInputRef={inputRef}
        askSendIcon={<ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:text-[var(--send-color-hover)]" />}
      >
        <div ref={contentRef} className="flex-1 flex flex-col space-y-4">
          {mode === "ask" && !selected && (
            <AskView welcomeMessage={welcomeMessage} showIntroVideo={showIntroVideo} introVideoUrl={introVideoUrl} lastQuestion={lastQuestion} loading={askLoading} responseText={responseText} recommendations={recommendations} onPick={(it) => onPickDemo(it)} />
          )}
          {mode === "ask" && selected && (<ViewDemo title={selected.title} url={selected.url} />)}
          {mode === "browse" && !selected && (<BrowseDemos items={demoItems} loading={demosLoading} error={demosError} onPick={(it) => onPickDemo(it)} />)}
          {mode === "browse" && selected && (<ViewDemo title={selected.title} url={selected.url} />)}
          {mode === "docs" && !selected && (
            <BrowseDocs items={docItems} loading={docsLoading} error={docsError} onPick={(it) => { setSelected(it); requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" })); }} />
          )}
          {mode === "docs" && selected && (<ViewDoc title={selected.title} url={selected.url} />)}
          {mode === "price" && (
            <PriceEstimate mirrorLines={mirrorLines} uiCopy={uiCopy} nextQuestion={nextQAugmented} estimate={estimate} estimating={estimating} errorQuestions={errorQuestions || (loadingQuestions ? "Loading questions…" : "")} errorEstimate={errorEstimate} onPickOption={onPickPriceOption} />
          )}
          {mode === "meeting" && (<ScheduleMeeting agent={agent} loading={agentLoading} error={agentError} onRefresh={refreshAgent} />)}
        </div>
      </AppShell>

      {vcOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="w-[92vw] max-w-xl rounded-2xl bg-white shadow-xl border border-gray-200">
            <div className="p-5 border-b border-gray-200">
              <div className="text-xl font-semibold text-gray-900">Before we get started</div>
              <div className="mt-1 text-sm text-gray-700">{vcConfig.message || "Tell us a little about yourself so we can better answer your questions."}</div>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-gray-900">Name</label><input type="text" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-gray-300" value={vcName} onChange={(e) => setVcName(e.target.value)} placeholder="Jane Doe" /></div>
              <div><label className="block text-sm font-medium text-gray-900">Email</label><input type="email" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-gray-300" value={vcEmail} onChange={(e) => setVcEmail(e.target.value)} placeholder="jane@company.com" /></div>
              {vcFields?.length ? (
                <div className="pt-2 space-y-4">
                  {vcFields.map((f) => {
                    const key = f.field_key || f.key;
                    const type = (f.input_type || "text").toLowerCase();
                    const val = vcExtras[key] ?? "";
                    const onChange = (v) => setVcExtras((prev) => ({ ...prev, [key]: v }));
                    if (type === "select") {
                      const opts = Array.isArray(f.options) ? f.options : Array.isArray(f.options?.items) ? f.options.items : [];
                      return (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-900">{f.label || key}</label>
                          <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" value={String(val)} onChange={(e) => onChange(e.target.value)}>
                            <option value="">{f.placeholder || "Select…"}</option>
                            {opts.map((o, idx) => (<option key={idx} value={o.value ?? o.key ?? o.id ?? o}>{o.label ?? o.name ?? String(o)}</option>))}
                          </select>
                          {f.help_text ? (<div className="mt-1 text-xs text-gray-600">{f.help_text}</div>) : null}
                        </div>
                      );
                    }
                    if (type === "textarea") {
                      return (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-900">{f.label || key}</label>
                          <textarea className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" rows={3} value={String(val)} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder || ""} />
                          {f.help_text ? (<div className="mt-1 text-xs text-gray-600">{f.help_text}</div>) : null}
                        </div>
                      );
                    }
                    if (type === "checkbox") {
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <input type="checkbox" checked={!!val} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
                          <label className="text-sm text-gray-900">{f.label || key}</label>
                        </div>
                      );
                    }
                    if (type === "radio") {
                      const opts = Array.isArray(f.options) ? f.options : Array.isArray(f.options?.items) ? f.options.items : [];
                      return (
                        <div key={key}>
                          <div className="block text-sm font-medium text-gray-900">{f.label || key}</div>
                          <div className="mt-2 flex flex-wrap gap-3">
                            {opts.map((o, idx) => {
                              const v = o.value ?? o.key ?? o.id ?? o;
                              const l = o.label ?? o.name ?? String(o);
                              return (
                                <label key={idx} className="inline-flex items-center gap-2 text-sm text-gray-900">
                                  <input type="radio" name={`vc-${key}`} checked={String(val) === String(v)} onChange={() => onChange(v)} />
                                  {l}
                                </label>
                              );
                            })}
                          </div>
                          {f.help_text ? (<div className="mt-1 text-xs text-gray-600">{f.help_text}</div>) : null}
                        </div>
                      );
                    }
                    return (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-900">{f.label || key}</label>
                        <input type={["email","number","tel","url"].includes(type) ? type : "text"} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" value={String(val)} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder || ""} />
                        {f.help_text ? (<div className="mt-1 text-xs text-gray-600">{f.help_text}</div>) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {vcErr ? <div className="text-sm text-red-600">{vcErr}</div> : null}
            </div>
            <div className="px-5 pb-5 pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
              <button onClick={submitVC} disabled={vcSubmitting} className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white text-sm hover:opacity-90 disabled:opacity-50">{vcSubmitting ? "Saving…" : "Continue"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
