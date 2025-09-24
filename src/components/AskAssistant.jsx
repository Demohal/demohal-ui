import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_THEME_VARS,
  inverseBW,
  UI,
  PriceMirror,
  EstimateCard,
  QuestionBlock,
  TabsNav,
} from "./AskAssistant/AskAssistant.ui";
import DocIframe from "./AskAssistant/widgets/DocIframe";
import ColorBox from "./AskAssistant/widgets/ColorBox";
import DebugPanel from "./AskAssistant/widgets/DebugPanel";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  const [stage, setStage] = useState("boot");

  // URL args
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
  const [responseText, setResponseText] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refs
  const inputRef = useRef(null);
  const frameRef = useRef(null);

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
  const liveTheme = useMemo(() => ({ ...derivedTheme, ...pickerVars }), [derivedTheme, pickerVars]);

  // Brand
  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });
  const initialBrandReady = useMemo(() => !(botIdFromUrl || alias), [botIdFromUrl, alias]);
  const [brandReady, setBrandReady] = useState(initialBrandReady);

  // Tabs
  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
    price: false,
  });

  // Pricing (stubs)
  const [pricingCopy, setPricingCopy] = useState({ intro: "", outro: "", custom_notice: "" });
  const [priceAnswers] = useState({});
  const [priceEstimate] = useState(null);

  // Intro
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // Browse data
  const [browseItems, setBrowseItems] = useState([]); // demos
  const [browseDocs, setBrowseDocs] = useState([]);   // docs

  // Selection for inline views
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Helpers to include identity headers
  const idHeaders = useMemo(
    () => ({
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
    }),
    [sessionId, visitorId]
  );

  // Resolve bot
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

  // Brand
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

  // Autosize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Tabs list
  const tabs = useMemo(() => {
    const t = [];
    if (tabsEnabled.demos) t.push({ key: "demos", label: "Browse Demos", onClick: () => { setMode("browse"); setSelectedDoc(null);} });
    if (tabsEnabled.docs) t.push({ key: "docs", label: "Browse Documents", onClick: () => { setMode("docs"); setSelectedDoc(null);} });
    if (tabsEnabled.price) t.push({ key: "price", label: "Price", onClick: () => setMode("price") });
    if (tabsEnabled.meeting) t.push({ key: "meeting", label: "Schedule Meeting", onClick: () => setMode("meeting") });
    return t.length ? t : [{ key: "ask", label: "Ask", onClick: () => setMode("ask") }];
  }, [tabsEnabled]);

  // Send question (/demo-hal)
  async function sendMessage() {
    const q = (input || "").trim();
    if (!q) return;
    if (!botId) { setFatal("Invalid or inactive alias."); return; }

    setLoading(true);
    setStage("ask:posting");

    try {
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idHeaders },
        body: JSON.stringify({ bot_id: botId, user_question: q, debug: true, scope: "standard" }),
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

  // ---- Load demos/docs (correct endpoints)
  useEffect(() => {
    if (!botId || !tabsEnabled.demos) return;
    setStage("fetch:demos");
    fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`, { headers: { ...idHeaders } })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.items || data.demos || data.rows || data.data || []);
        setBrowseItems(list || []);
        setStage(`ok:demos:${(list || []).length}`);
      })
      .catch(() => { setBrowseItems([]); setStage("warn:demos"); });
  }, [botId, tabsEnabled.demos, apiBase, idHeaders]);

  useEffect(() => {
    if (!botId || !tabsEnabled.docs) return;
    setStage("fetch:docs");
    fetch(`${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`, { headers: { ...idHeaders } })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.items || data.documents || data.docs || data.rows || data.data || []);
        setBrowseDocs(list || []);
        setStage(`ok:docs:${(list || []).length}`);
      })
      .catch(() => { setBrowseDocs([]); setStage("warn:docs"); });
  }, [botId, tabsEnabled.docs, apiBase, idHeaders]);

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
            <div className="text-base whitespace-pre-line text-[var(--message-fg)]">{responseText}</div>

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
            <EstimateCard estimate={priceEstimate} outroText={pricingCopy?.outro || ""} />
          </div>
        ) : mode === "docs" ? (
          <div className="flex flex-col gap-4">
            {selectedDoc ? (
              <div className={UI.CARD}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold">{selectedDoc.title}</div>
                  <div className="flex gap-2">
                    <a href={selectedDoc.url} target="_blank" rel="noreferrer" className={UI.BTN_DOC}>Open in new tab</a>
                    <button className={UI.BTN_DOC} onClick={() => setSelectedDoc(null)}>Back</button>
                  </div>
                </div>
                <DocIframe url={selectedDoc.url} />
              </div>
            ) : (
              <div className="grid gap-3">
                {browseDocs.length === 0 ? (
                  <div className={UI.CARD}>No documents yet.</div>
                ) : (
                  browseDocs.map((doc) => (
                    <button
                      key={doc.id}
                      className={UI.CARD}
                      onClick={() => setSelectedDoc(doc)}
                      title="View"
                    >
                      <div className="font-bold text-left">{doc.title}</div>
                      <div className="text-sm opacity-80 text-left">{doc.description}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
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
      </div>

      {themeLabOn ? (
        <ColorBox apiBase={apiBase} botId={botId} frameRef={frameRef} onVars={setPickerVars} />
      ) : null}
    </div>
  );
}
