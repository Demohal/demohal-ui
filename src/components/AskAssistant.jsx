import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_THEME_VARS,
  TOKEN_TO_CSS,
  SCREEN_ORDER,
  classNames,
  inverseBW,
  UI,
  Row,
  OptionButton,
  PriceMirror,
  EstimateCard,
  normalizeOptions,
  QuestionBlock,
  TabsNav,
} from "./AskAssistant/AskAssistant.ui";
import DocIframe from "./AskAssistant/widgets/DocIframe";
import ColorBox from "./AskAssistant/widgets/ColorBox";
import DebugPanel from "./AskAssistant/widgets/DebugPanel";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL → alias / bot_id / themelab
  const { alias, botIdFromUrl, themeLabOn } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const a = (qs.get("alias") || qs.get("alais") || "").trim();
    const b = (qs.get("bot_id") || "").trim();
    const th = (qs.get("themelab") || "").trim();
    return { alias: a, botIdFromUrl: b, themeLabOn: th === "1" || th.toLowerCase() === "true" };
  }, []);
  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");

  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);

  const [helperPhase, setHelperPhase] = useState("hidden");
  const [isAnchored, setIsAnchored] = useState(false);

  const contentRef = useRef(null);
  const inputRef = useRef(null);
  const frameRef = useRef(null);
  const priceScrollRef = useRef(null);

  // IDs
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Theme
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);
  const [pickerVars, setPickerVars] = useState({});
  const liveTheme = useMemo(() => ({ ...derivedTheme, ...pickerVars }), [derivedTheme, pickerVars]);

  const [brandAssets, setBrandAssets] = useState({ logo_url: null, logo_light_url: null, logo_dark_url: null });
  const initialBrandReady = useMemo(() => !(botIdFromUrl || alias), [botIdFromUrl, alias]);
  const [brandReady, setBrandReady] = useState(initialBrandReady);

  const [tabsEnabled, setTabsEnabled] = useState({ demos: false, docs: false, meeting: false, price: false });

  // Pricing
  const [pricingCopy, setPricingCopy] = useState({ intro: "", outro: "", custom_notice: "" });
  const [priceQuestions, setPriceQuestions] = useState([]);
  const [priceAnswers, setPriceAnswers] = useState({});
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceErr, setPriceErr] = useState("");
  const [agent, setAgent] = useState(null);

  // Lead form (kept but unused here; wired in Section 4 UI)
  const [lead, setLead] = useState({ name: "", email: "", company: "", notes: "" });
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadErr, setLeadErr] = useState("");
  const [leadOk, setLeadOk] = useState(false);

  // Scope payload
  const [scopePayload, setScopePayload] = useState({ scope: "standard" });

  // Helpers to attach IDs
  const withIdsQS = (url) => {
    const u = new URL(url, window.location.origin);
    if (sessionId) u.searchParams.set("session_id", sessionId);
    if (visitorId) u.searchParams.set("visitor_id", visitorId);
    return u.toString();
  };
  const withIdsBody = (obj) => ({ ...obj, ...(sessionId ? { session_id: sessionId } : {}), ...(visitorId ? { visitor_id: visitorId } : {}) });
  const withIdsHeaders = () => ({ ...(sessionId ? { "X-Session-Id": sessionId } : {}), ...(visitorId ? { "X-Visitor-Id": visitorId } : {}) });

  // Derived pricing helpers
  const mirrorLines = useMemo(() => {
    const qs = Array.isArray(priceQuestions) ? priceQuestions : [];
    const out = [];
    for (const q of qs) {
      const key = q?.q_key; if (!key) continue;
      const val = priceAnswers?.[key];
      const isMulti = String(q?.type || "").toLowerCase().includes("multi");
      const has = isMulti ? Array.isArray(val) && val.length > 0 : val != null && val !== "";
      if (!has) continue;
      const label = q?.prompt || q?.label || key;
      const display = isMulti ? val.join(", ") : String(val);
      out.push(`${label}: ${display}`);
    }
    return out;
  }, [priceQuestions, priceAnswers]);

  const nextPriceQuestion = useMemo(() => {
    const qs = Array.isArray(priceQuestions) ? priceQuestions : [];
    for (const q of qs) {
      const key = q?.q_key; if (!key) continue;
      const val = priceAnswers?.[key];
      const isMulti = String(q?.type || "").toLowerCase().includes("multi");
      const answered = isMulti ? Array.isArray(val) && val.length > 0 : val != null && val !== "";
      if (!answered) return q;
    }
    return null;
  }, [priceQuestions, priceAnswers]);

  // Update scope when entering Demo/Doc views
  useEffect(() => {
    if (selected && selected.id && mode === "docs") setScopePayload({ scope: "doc", doc_id: String(selected.id) });
    else if (selected && selected.id && mode !== "docs") setScopePayload({ scope: "demo", demo_id: String(selected.id) });
    else setScopePayload({ scope: "standard" });
  }, [selected, mode]);

  // Resolve bot by alias
  useEffect(() => {
    if (botId) return;
    if (!alias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (cancel) return;
        const id = data?.ok ? data?.bot?.id : null;
        if (data?.ok) { setVisitorId(data.visitor_id || ""); setSessionId(data.session_id || ""); }
        const b = data?.ok ? data?.bot : null;
        if (b) {
          setTabsEnabled({ demos: !!b.show_browse_demos, docs: !!b.show_browse_docs, meeting: !!b.show_schedule_meeting, price: !!b.show_price_estimate });
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setPricingCopy({ intro: b.pricing_intro || "", outro: b.pricing_outro || "", custom_notice: b.pricing_custom_notice || "" });
        }
        if (id) { setBotId(id); setFatal(""); } else if (!res.ok || data?.ok === false) { setFatal("Invalid or inactive alias."); }
      } catch { if (!cancel) setFatal("Invalid or inactive alias."); }
    })();
    return () => { cancel = true; };
  }, [alias, apiBase, botId]);

  // Try default alias if needed
  useEffect(() => {
    if (botId || alias || !defaultAlias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(defaultAlias)}`);
        const data = await res.json();
        if (cancel) return;
        const id = data?.ok ? data?.bot?.id : null;
        if (data?.ok) { setVisitorId(data.visitor_id || ""); setSessionId(data.session_id || ""); }
        const b = data?.ok ? data?.bot : null;
        if (b) {
          setTabsEnabled({ demos: !!b.show_browse_demos, docs: !!b.show_browse_docs, meeting: !!b.show_schedule_meeting, price: !!b.show_price_estimate });
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setPricingCopy({ intro: b.pricing_intro || "", outro: b.pricing_outro || "", custom_notice: b.pricing_custom_notice || "" });
        }
        if (id) setBotId(id);
      } catch {}
    })();
    return () => { cancel = true; };
  }, [botId, alias, defaultAlias, apiBase]);

  // If we start with bot_id in URL
  useEffect(() => {
    if (!botIdFromUrl) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`);
        const data = await res.json();
        if (cancel) return;
        if (data?.ok) { setVisitorId(data.visitor_id || ""); setSessionId(data.session_id || ""); }
        const b = data?.ok ? data?.bot : null;
        if (b) {
          setTabsEnabled({ demos: !!b.show_browse_demos, docs: !!b.show_browse_docs, meeting: !!b.show_schedule_meeting, price: !!b.show_price_estimate });
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setPricingCopy({ intro: b.pricing_intro || "", outro: b.pricing_outro || "", custom_notice: b.pricing_custom_notice || "" });
        }
        if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch {}
    })();
    return () => { cancel = true; };
  }, [botIdFromUrl, apiBase]);

  useEffect(() => { if (!botId && !alias && !brandReady) setBrandReady(true); }, [botId, alias, brandReady]);

  // Brand
  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json();
        if (cancel) return;
        if (data?.ok && data?.css_vars && typeof data.css_vars === "object") setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
        if (data?.ok && data?.assets) setBrandAssets({ logo_url: data.assets.logo_url || null, logo_light_url: data.assets.logo_light_url || null, logo_dark_url: data.assets.logo_dark_url || null });
      } catch {} finally { if (!cancel) setBrandReady(true); }
    })();
    return () => { cancel = true; };
  }, [botId, apiBase]);

  // Tab flags refresh by bot_id
  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json();
        if (cancel) return;
        if (data?.ok) { setVisitorId((v) => v || data.visitor_id || ""); setSessionId((s) => s || data.session_id || ""); }
        const b = data?.ok ? data?.bot : null;
        if (b) {
          setTabsEnabled({ demos: !!b.show_browse_demos, docs: !!b.show_browse_docs, meeting: !!b.show_schedule_meeting, price: !!b.show_price_estimate });
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setPricingCopy({ intro: b.pricing_intro || "", outro: b.pricing_outro || "", custom_notice: b.pricing_custom_notice || "" });
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, [botId, apiBase]);

  // Autosize ask box
  useEffect(() => {
    const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // ================= RENDER =================
  return (
    <div className="min-h-screen" style={liveTheme}>
      {/* Banner */}
      <div className="w-full p-4" style={{ background: "var(--banner-bg)", color: "var(--banner-fg)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brandAssets.logo_url ? (
              <img src={brandAssets.logo_url} alt="logo" className="h-8 w-auto" />
            ) : (
              <div className="font-extrabold">DemoHAL</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto mt-2">
        <TabsNav
          mode={mode}
          tabs={[
            { key: "demos", label: "Browse Demos", onClick: () => setMode("browse") },
            { key: "docs", label: "Browse Documents", onClick: () => setMode("docs") },
            { key: "price", label: "Price", onClick: () => setMode("price") },
            { key: "meeting", label: "Schedule Meeting", onClick: () => setMode("meeting") },
          ]}
        />
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* ASK MODE */}
        {mode === "ask" ? (
          <div className={UI.CARD}>
            <div className="text-base whitespace-pre-line text-[var(--message-fg)]">{responseText}</div>
            <div className="mt-3 flex gap-2">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question" className={UI.FIELD} />
              <button className={UI.BTN_DOC} onClick={() => setMode("browse")}>Browse</button>
            </div>
            <DebugPanel debug={debugInfo} />
          </div>
        ) : mode === "price" ? (
          <div className="space-y-3">
            <PriceMirror lines={mirrorLines} />
            {nextPriceQuestion ? (
              <QuestionBlock q={nextPriceQuestion} value={priceAnswers?.[nextPriceQuestion?.q_key]} onPick={(q, opt) => {
                setPriceAnswers((prev) => {
                  const k = q?.q_key; if (!k) return prev;
                  const t = String(q?.type || "").toLowerCase();
                  if (t.includes("multi")) {
                    const old = Array.isArray(prev[k]) ? prev[k] : [];
                    const exists = old.includes(opt.key);
                    const nxt = exists ? old.filter((x) => x !== opt.key) : [...old, opt.key];
                    return { ...prev, [k]: nxt };
                  }
                  return { ...prev, [k]: opt.key };
                });
              }} />
            ) : (
              <EstimateCard estimate={priceEstimate} outroText={pricingCopy?.outro || ""} />
            )}
          </div>
        ) : (
          <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
            <div className={UI.CARD}>
              <div className="text-sm text-[var(--helper-fg)]">Other modes will render here.</div>
            </div>
          </div>
        )}
      </div>

      {/* ThemeLab */}
      {themeLabOn ? (
        <ColorBox apiBase={apiBase} botId={botId} frameRef={frameRef} onVars={setPickerVars} />
      ) : null}
    </div>
  );
}
