import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_THEME_VARS,
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

  // --- DEBUG STAGE ---
  const [stage, setStage] = useState("boot");

  // URL
  const { alias, botIdFromUrl, themeLabOn } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      alias: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
      themeLabOn:
        (qs.get("themelab") || "").trim() === "1" ||
        (qs.get("themelab") || "").trim().toLowerCase() === "true",
    };
  }, []);
  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  // Core state
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");
  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refs
  const contentRef = useRef(null);
  const inputRef = useRef(null);
  const frameRef = useRef(null);
  const priceScrollRef = useRef(null);

  // Identity
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Theme
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);
  const [pickerVars, setPickerVars] = useState({});
  const liveTheme = useMemo(
    () => ({ ...derivedTheme, ...pickerVars }),
    [derivedTheme, pickerVars]
  );

  // Brand
  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });
  const initialBrandReady = useMemo(() => !(botIdFromUrl || alias), [botIdFromUrl, alias]);
  const [brandReady, setBrandReady] = useState(initialBrandReady);

  // Tabs (from bot flags)
  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
    price: false,
  });

  // Pricing (stubbed)
  const [pricingCopy, setPricingCopy] = useState({ intro: "", outro: "", custom_notice: "" });
  const [priceQuestions, setPriceQuestions] = useState([]);
  const [priceAnswers, setPriceAnswers] = useState({});
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceErr, setPriceErr] = useState("");
  const mirrorLines = useMemo(() => [], []);
  const nextPriceQuestion = useMemo(() => null, []);

  // Intro video
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // Browse data
  const [browseItems, setBrowseItems] = useState([]); // demos
  const [browseDocs, setBrowseDocs] = useState([]);   // documents

  // ---- Init: resolve bot by alias / bot_id ----
  useEffect(() => {
    let cancel = false;

    async function loadBy(u) {
      setStage("fetch:bot-settings");
      const res = await fetch(u);
      const data = await res.json().catch(() => ({}));
      if (cancel) return;

      if (!res.ok || data?.ok === false || !data?.bot?.id) {
        setFatal("Invalid or inactive alias.");
        setStage("fatal");
        return;
      }

      setVisitorId(data.visitor_id || "");
      setSessionId(data.session_id || "");

      const b = data.bot || {};
      setTabsEnabled({
        demos: !!b.show_browse_demos,
        docs: !!b.show_browse_docs,
        meeting: !!b.show_schedule_meeting,
        price: !!b.show_price_estimate,
      });
      setResponseText(b.welcome_message || "");
      setIntroVideoUrl(b.intro_video_url || "");
      setShowIntroVideo(!!b.show_intro_video);
      setPricingCopy({
        intro: b.pricing_intro || "",
        outro: b.pricing_outro || "",
        custom_notice: b.pricing_custom_notice || "",
      });

      setBotId(b.id);
      setFatal("");
      setStage("ok:botId");
    }

    (async () => {
      try {
        if (botIdFromUrl) {
          await loadBy(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`);
          return;
        }
        const useAlias = alias || defaultAlias;
        if (!useAlias) {
          setFatal("Invalid or inactive alias.");
          setStage("fatal");
          return;
        }
        await loadBy(`${apiBase}/bot-settings?alias=${encodeURIComponent(useAlias)}`);
      } catch {
        if (!cancel) {
          setFatal("Invalid or inactive alias.");
          setStage("fatal");
        }
      }
    })();

    return () => { cancel = true; };
  }, [apiBase, alias, botIdFromUrl, defaultAlias]);

  // Brand load
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
          setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
        }
        if (data?.ok && data?.assets) {
          setBrandAssets({
            logo_url: data.assets.logo_url || null,
            logo_light_url: data.assets.logo_light_url || null,
            logo_dark_url: data.assets.logo_dark_url || null,
          });
        }
        setStage("ok:brand");
      } catch {
        setStage("warn:brand");
      } finally {
        if (!cancel) setBrandReady(true);
      }
    })();
    return () => { cancel = true; };
  }, [botId, apiBase]);

  // Autosize input
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Build tabs list from flags
  const tabs = useMemo(() => {
    const t = [];
    if (tabsEnabled.demos) t.push({ key: "demos", label: "Browse Demos", onClick: () => setMode("browse") });
    if (tabsEnabled.docs) t.push({ key: "docs", label: "Browse Documents", onClick: () => setMode("docs") });
    if (tabsEnabled.price) t.push({ key: "price", label: "Price", onClick: () => setMode("price") });
    if (tabsEnabled.meeting) t.push({ key: "meeting", label: "Schedule Meeting", onClick: () => setMode("meeting") });
    return t.length ? t : [{ key: "ask", label: "Ask", onClick: () => setMode("ask") }];
  }, [tabsEnabled]);

  // ---------- ASK FLOW (POST /demo-hal) ----------
  async function sendMessage() {
    const q = (input || "").trim();
    if (!q) return;
    if (!botId) { setFatal("Invalid or inactive alias."); return; }

    setLoading(true);
    setStage("ask:posting");
    setLastQuestion(q);

    try {
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionId ? { "X-Session-Id": sessionId } : {}),
          ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
        },
        body: JSON.stringify({
          bot_id: botId,
          user_question: q,
          debug: true,
          scope: "standard",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setResponseText(data?.error || "Sorry—something went wrong.");
        setDebugInfo(data?.debug || null);
        setStage("ask:error");
      } else {
        const text =
          data?.response_text ||
          data?.answer?.text ||
          data?.message ||
          data?.text ||
          "";
        setResponseText(String(text || "").trim());
        setDebugInfo(data?.debug || null);
        setStage("ask:ok");
      }
    } catch {
      setResponseText("Network error.");
      setStage("ask:network-error");
    } finally {
      setLoading(false);
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  }

  // ---- helper to normalize list payloads (array or object containers)
  function extractList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    const keys = ["items", "rows", "data", "demos", "documents", "docs", "list"];
    for (const k of keys) {
      const v = data?.[k];
      if (Array.isArray(v)) return v;
    }
    return [];
  }

  // --------- LOAD DEMOS/DOCS ----------
  useEffect(() => {
    if (!botId || !tabsEnabled.demos) return;
    setStage("fetch:demos");
    fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`)
      .then(r => r.json())
      .then((data) => {
        const list = extractList(data);
        setBrowseItems(list);
        setStage(`ok:demos:${list.length}`);
      })
      .catch(() => { setBrowseItems([]); setStage("warn:demos"); });
  }, [botId, tabsEnabled.demos, apiBase]);

  useEffect(() => {
    if (!botId || !tabsEnabled.docs) return;
    setStage("fetch:docs");
    fetch(`${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`)
      .then(r => r.json())
      .then((data) => {
        const list = extractList(data);
        setBrowseDocs(list);
        setStage(`ok:docs:${list.length}`);
      })
      .catch(() => { setBrowseDocs([]); setStage("warn:docs"); });
  }, [botId, tabsEnabled.docs, apiBase]);

  return (
    <div className="min-h-screen" style={liveTheme}>
      {/* Stage */}
      <div style={{position:"fixed",right:8,top:8,zIndex:9999,background:"#000",color:"#fff",padding:"4px 8px",borderRadius:6,fontSize:12}}>
        Stage: {stage || "-"}
      </div>

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
        <TabsNav mode={mode} tabs={tabs} />
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {fatal ? (
          <div className={UI.CARD} style={{ border: "1px solid #ef4444" }}>
            <div className="font-bold text-red-600">Error</div>
            <div>{fatal}</div>
          </div>
        ) : mode === "ask" ? (
          <div className={UI.CARD}>
            {/* Welcome copy */}
            <div className="text-base whitespace-pre-line text-[var(--message-fg)]">{responseText}</div>

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

            {/* Ask box */}
            <div className="mt-3 flex gap-2 items-start">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask a question (Cmd/Ctrl+Enter to send)"
                className={UI.FIELD}
              />
              <button
                className={UI.BTN_DOC}
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                title={loading ? "Sending..." : "Send"}
              >
                {loading ? "Sending…" : "Send"}
              </button>
              <button className={UI.BTN_DOC} onClick={() => setMode("browse")}>
                Browse
              </button>
            </div>

            <DebugPanel debug={debugInfo} />
          </div>
        ) : mode === "price" ? (
          <div className="space-y-3">
            <PriceMirror lines={[]} />
            {nextPriceQuestion ? (
              <QuestionBlock q={nextPriceQuestion} value={priceAnswers?.[nextPriceQuestion?.q_key]} onPick={() => {}} />
            ) : (
              <EstimateCard estimate={priceEstimate} outroText={pricingCopy?.outro || ""} />
            )}
          </div>
        ) : (
          <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
            {mode === "browse" && (
              <div className="grid gap-3">
                {browseItems.length === 0 ? (
                  <div className={UI.CARD}>No demos yet.</div>
                ) : (
                  browseItems.map((d) => (
                    <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className={UI.CARD}>
                      <div className="font-bold">{d.title}</div>
                      <div className="text-sm opacity-80">{d.description}</div>
                    </a>
                  ))
                )}
              </div>
            )}
            {mode === "docs" && (
              <div className="grid gap-3">
                {browseDocs.length === 0 ? (
                  <div className={UI.CARD}>No documents yet.</div>
                ) : (
                  browseDocs.map((doc) => (
                    <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className={UI.CARD}>
                      <div className="font-bold">{doc.title}</div>
                      <div className="text-sm opacity-80">{doc.description}</div>
                    </a>
                  ))
                )}
              </div>
            )}
            {mode !== "browse" && mode !== "docs" && (
              <div className={UI.CARD}>
                <div className="text-sm text-[var(--helper-fg)]">Other modes will render here.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ThemeLab */}
      {themeLabOn ? <ColorBox apiBase={apiBase} botId={botId} frameRef={frameRef} onVars={setPickerVars} /> : null}
    </div>
  );
}
