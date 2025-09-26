/* Welcome.jsx — Phase 1 refactor: extract presentational components
   - Extracted TabsNav, Row, DocIframe, AskInputBar into sibling files
   - No behavior change
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import fallbackLogo from "../assets/logo.png";

// PRESENTATIONAL (local imports)
import TabsNav from "./TabsNav";
import Row from "./Row";
import DocIframe from "./DocIframe";
import AskInputBar from "./AskInputBar";

/* =============================== *
 *  CLIENT-CONTROLLED CSS TOKENS   *
 * =============================== */

const DEFAULT_THEME_VARS = {
  "--banner-bg": "#000000",
  "--banner-fg": "#ffffff",
  "--page-bg": "#e6e6e6",
  "--card-bg": "#ffffff",
  "--shadow-elevation":
    "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",

  // Text roles
  "--message-fg": "#000000",
  "--helper-fg": "#4b5563",
  "--mirror-fg": "#4b5563",

  // Tabs (inactive)
  "--tab-bg": "#303030",
  "--tab-fg": "#ffffff",
  "--tab-active-fg": "#ffffff", // derived at runtime

  // Buttons (explicit types)
  "--demo-button-bg": "#3a4554",
  "--demo-button-fg": "#ffffff",
  "--doc.button.background": "#000000", // legacy mapping guard (no-op)
  "--doc-button-bg": "#000000",
  "--doc-button-fg": "#ffffff",

  // Send icon
  "--send-color": "#000000",

  // Default faint gray border (used only where allowed)
  "--border-default": "#9ca3af",
};

const classNames = (...xs) => xs.filter(Boolean).join(" ");

// compute contrasting active fg based on tab fg
function inverseBW(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
    String(hex || "").trim()
  );
  if (!m) return "#000000";
  const r = parseInt(m[1], 16),
    g = parseInt(m[2], 16),
    b = parseInt(m[3], 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.5 ? "#000000" : "#ffffff";
}

export default function Welcome() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL → alias / bot_id
  const { alias, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const a = (qs.get("alias") || qs.get("alais") || "").trim();
    const b = (qs.get("bot_id") || "").trim();
    return { alias: a, botIdFromUrl: b };
  }, []);

  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");

  // Mode controller (Ask is not a tab)
  const [mode, setMode] = useState("ask"); // 'ask' | 'browse' | 'docs' | 'meeting'

  // Q&A state
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);

  // Recommendations / browse state
  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);

  // Meeting
  const [agent, setAgent] = useState(null);

  // Refs
  const contentRef = useRef(null);
  const inputRef = useRef(null);

  // Visitor/session identity
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Theme & brand
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });
  const liveTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);

  const initialBrandReady = useMemo(
    () => !(botIdFromUrl || alias),
    [botIdFromUrl, alias]
  );
  const [brandReady, setBrandReady] = useState(initialBrandReady);

  // Tabs enabled (from /bot-settings)
  const [tabsEnabled, setTabsEnabled] = useState({ demos: false, docs: false, meeting: false });

  // Helpers to attach identity in requests
  const withIdsBody = (obj) => ({
    ...obj,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(visitorId ? { visitor_id: visitorId } : {}),
  });
  const withIdsHeaders = () => ({
    ...(sessionId ? { "X-Session-Id": sessionId } : {}),
    ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
  });
  const withIdsQS = (url) => {
    const u = new URL(url, window.location.origin);
    if (sessionId) u.searchParams.set("session_id", sessionId);
    if (visitorId) u.searchParams.set("visitor_id", visitorId);
    return u.toString();
  };

  /* ============================= *
   *   Bot resolution & branding   *
   * ============================= */

  // Resolve bot by alias
  useEffect(() => {
    if (botId || !alias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`
        );
        const data = await res.json();
        if (cancel) return;
        const id = data?.ok ? data?.bot?.id : null;

        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

        const b = data?.ok ? data?.bot : null;
        if (b) {
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
          });
        }
        if (id) {
          setBotId(id);
          setFatal("");
        } else if (!res.ok || data?.ok === false) {
          setFatal("Invalid or inactive alias.");
        }
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase, botId]);

  // Try default alias if needed
  useEffect(() => {
    if (botId || alias || !defaultAlias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?alias=${encodeURIComponent(defaultAlias)}`
        );
        const data = await res.json();
        if (cancel) return;

        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

        const b = data?.ok ? data?.bot : null;
        if (b) {
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
          });
        }
        if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [botId, alias, defaultAlias, apiBase]);

  // If we start with bot_id in URL, load settings that way (and init visitor/session)
  useEffect(() => {
    if (!botIdFromUrl) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`
        );
        const data = await res.json();
        if (cancel) return;

        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

        const b = data?.ok ? data?.bot : null;
        if (b) {
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
          });
        }
        if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [botIdFromUrl, apiBase]);

  useEffect(() => {
    if (!botId && !alias && !brandReady) setBrandReady(true);
  }, [botId, alias, brandReady]);

  // Brand: css vars + assets
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`
        );
        const data = await res.json();
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
      } catch {
      } finally {
        if (!cancel) setBrandReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [botId, apiBase]);

  /* ============ *
   *   Ask Flow   *
   * ============ */
  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();

    setMode("ask");
    setLastQuestion(outgoing);
    setInput("");
    setSelected(null);
    setResponseText("");
    setItems([]);
    setLoading(true);

    try {
      const res = await axios.post(
        `${apiBase}/demo-hal`,
        withIdsBody({ bot_id: botId, user_question: outgoing, scope: "standard", debug: true }),
        { timeout: 30000, headers: withIdsHeaders() }
      );
      const data = res?.data || {};
      const text = data?.response_text || "";

      try {
        const src = Array.isArray(data?.items) ? data.items : Array.isArray(data?.buttons) ? data.buttons : [];
        const mapped = src.map((it, idx) => ({
          id: it.id ?? it.value ?? it.url ?? it.title ?? String(idx),
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
        }));
        setItems(mapped.filter(Boolean));
      } catch {}

      setResponseText(text);
      setLoading(false);

      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setLoading(false);
      setResponseText("Sorry—something went wrong.");
      setItems([]);
    }
  }

  /* ============================= *
   *   Demo/Doc browse + viewers   *
   * ============================= */
  async function normalizeAndSelectDemo(item) {
    try {
      const r = await fetch(`${apiBase}/render-video-iframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...withIdsHeaders() },
        body: JSON.stringify(withIdsBody({
          bot_id: botId,
          demo_id: item.id || "",
          title: item.title || "",
          video_url: item.url || "",
        })),
      });
      const j = await r.json();
      const embed = j?.video_url || item.url;
      setSelected({ ...item, url: embed });
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setSelected(item);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    }
  }

  async function openBrowse() {
    if (!botId) return;
    setMode("browse");
    setSelected(null);
    try {
      const url = withIdsQS(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
      const res = await fetch(url, { headers: withIdsHeaders() });
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : [];
      setBrowseItems(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
        }))
      );
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseItems([]);
    }
  }

  async function openBrowseDocs() {
    if (!botId) return;
    setMode("docs");
    setSelected(null);
    try {
      const url = withIdsQS(`${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`);
      const res = await fetch(url, { headers: withIdsHeaders() });
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : [];
      setBrowseDocs(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
        }))
      );
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseDocs([]);
    }
  }

  /* ============================= *
   *   Schedule meeting
   * ============================= */
  const embedDomain = typeof window !== "undefined" ? window.location.hostname : "";
  async function openMeeting() {
    if (!botId) return;
    setMode("meeting");
    try {
      const res = await fetch(`${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const ag = data?.ok ? data.agent : null;
      setAgent(ag);
      if (
        ag &&
        ag.calendar_link_type &&
        String(ag.calendar_link_type).toLowerCase() === "external" &&
        ag.calendar_link
      ) {
        try {
          const base = ag.calendar_link || "";
          const withQS = `${base}${base.includes('?') ? '&' : '?'}session_id=${encodeURIComponent(sessionId||'')}&visitor_id=${encodeURIComponent(visitorId||'')}&bot_id=${encodeURIComponent(botId||'')}`;
          window.open(withQS, "_blank", "noopener,noreferrer");
        } catch {}
      }
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setAgent(null);
    }
  }

  // Listen for Calendly postMessage and forward to backend
  useEffect(() => {
    if (mode !== "meeting" || !botId || !sessionId || !visitorId) return;
    function onCalendlyMessage(e) {
      try {
        const m = e?.data;
        if (!m || typeof m !== "object") return;
        if (m.event !== "calendly.event_scheduled" && m.event !== "calendly.event_canceled") return;
        const p = m.payload || {};
        const payloadOut = {
          event: m.event,
          scheduled_event: p.event || p.scheduled_event || null,
          invitee: {
            uri: p.invitee?.uri ?? null,
            email: p.invitee?.email ?? null,
            name: p.invitee?.full_name ?? p.invitee?.name ?? null,
          },
          questions_and_answers: p.questions_and_answers ?? p.invitee?.questions_and_answers ?? [],
          tracking: p.tracking || {},
        };
        fetch(`${apiBase}/calendly/js-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botId, session_id: sessionId, visitor_id: visitorId, payload: payloadOut }),
        }).catch(() => {});
      } catch {}
    }
    window.addEventListener("message", onCalendlyMessage);
    return () => window.removeEventListener("message", onCalendlyMessage);
  }, [mode, botId, sessionId, visitorId, apiBase]);

  // Autosize ask box
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  /* ============ *
   *   Render     *
   * ============ */

  const tabs = useMemo(() => {
    const out = [];
    if (tabsEnabled.demos) out.push({ key: "demos", label: "Browse Demos", onClick: openBrowse });
    if (tabsEnabled.docs) out.push({ key: "docs", label: "Browse Documents", onClick: openBrowseDocs });
    if (tabsEnabled.meeting) out.push({ key: "meeting", label: "Schedule Meeting", onClick: openMeeting });
    return out;
  }, [tabsEnabled]);

  if (fatal) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-red-600 font-semibold">{fatal}</div>
      </div>
    );
  }
  if (!botId) {
    return (
      <div
        className={classNames(
          "w-screen min-h-[100dvh] flex items-center justify-center bg-[var(--page-bg)] p-4 transition-opacity duration-200",
          brandReady ? "opacity-100" : "opacity-0"
        )}
        style={liveTheme}
      >
        <div className="text-gray-800 text-center space-y-2">
          <div className="text-lg font-semibold">No bot selected</div>
          {alias ? (
            <div className="text-sm text-gray-600">Resolving alias “{alias}”…</div>
          ) : (
            <div className="text-sm text-gray-600">
              Provide a <code>?bot_id=…</code> or <code>?alias=…</code> in the URL
              {defaultAlias ? <> (trying default alias “{defaultAlias}”)</> : null}.
            </div>
          )}
        </div>
      </div>
    );
  }

  const logoSrc =
    brandAssets.logo_url || brandAssets.logo_light_url || brandAssets.logo_dark_url || fallbackLogo;

  const listSource = mode === "browse" ? browseItems : items;
  const visibleUnderVideo = selected ? (mode === "ask" ? items : []) : listSource;

  return (
    <div
      className={classNames(
        "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200",
        brandReady ? "opacity-100" : "opacity-0"
      )}
      style={liveTheme}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-[var(--card-bg)] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)] flex flex-col overflow-hidden transition-all duration-300">
        {/* Header */}
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] border-b border-[var(--border-default)]">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="Brand logo" className="h-10 object-contain" />
            </div>
            <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">
              {selected
                ? selected.title
                : mode === "browse"
                ? "Browse Demos"
                : mode === "docs"
                ? "Browse Documents"
                : mode === "meeting"
                ? "Schedule Meeting"
                : "Ask the Assistant"}
            </div>
          </div>
          {/* Tabs */}
          <TabsNav mode={mode} tabs={tabs} />
        </div>

        {/* BODY */}
        <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
          {mode === "meeting" ? (
            <div className="w-full flex-1 flex flex-col">
              {!agent ? (
                <div className="text-sm text-[var(--helper-fg)]">Loading scheduling…</div>
              ) : agent.calendar_link_type && String(agent.calendar_link_type).toLowerCase() === "embed" && agent.calendar_link ? (
                <iframe
                  title="Schedule a Meeting"
                  src={`${agent.calendar_link}${agent.calendar_link.includes('?') ? '&' : '?'}embed_domain=${typeof window!=="undefined"?window.location.hostname:''}&embed_type=Inline&session_id=${encodeURIComponent(sessionId||'')}&visitor_id=${encodeURIComponent(visitorId||'')}&bot_id=${encodeURIComponent(botId||'')}`}
                  style={{ width: "100%", height: "60vh", maxHeight: "640px", background: "var(--card-bg)" }}
                  className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                />
              ) : agent.calendar_link_type && String(agent.calendar_link_type).toLowerCase() === "external" && agent.calendar_link ? (
                <div className="text-sm text-gray-700">
                  We opened the scheduling page in a new tab. If it didn’t open,&nbsp;
                  <a href={agent.calendar_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">click here to open it</a>.
                </div>
              ) : (
                <div className="text-sm text-[var(--helper-fg)]">No scheduling link is configured.</div>
              )}
            </div>
          ) : selected ? (
            <div className="w-full flex-1 flex flex-col">
              {mode === "docs" ? (
                <DocIframe doc={selected} />
              ) : (
                <div className="bg-[var(--card-bg)] pt-2 pb-2">
                  <iframe
                    style={{ width: "100%", aspectRatio: "471 / 272" }}
                    src={selected.url}
                    title={selected.title}
                    className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              {mode === "ask" && (visibleUnderVideo || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-1 mb-3">
                    <p className="italic text-[var(--helper-fg)]">Recommended demos</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {visibleUnderVideo.map((it) => (
                      <Row key={it.id || it.url || it.title} item={it} onPick={(val) => normalizeAndSelectDemo(val)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : mode === "browse" ? (
            <div className="w-full flex-1 flex flex-col">
              {(browseItems || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-2 mb-3">
                    <p className="italic text-[var(--helper-fg)]">Select a demo to view it</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {browseItems.map((it) => (
                      <Row key={it.id || it.url || it.title} item={it} onPick={(val) => normalizeAndSelectDemo(val)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : mode === "docs" ? (
            <div className="w-full flex-1 flex flex-col">
              {(browseDocs || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-2 mb-3">
                    <p className="italic text-[var(--helper-fg)]">Select a document to view it</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {browseDocs.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        kind="doc"
                        onPick={async (val) => {
                          try {
                            const r = await fetch(`${apiBase}/render-doc-iframe`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(withIdsBody({ bot_id: botId, doc_id: val.id || "", title: val.title || "", url: val.url || "" })),
                            });
                            const j = await r.json();
                            setSelected({ ...val, _iframe_html: j?.iframe_html || null });
                          } catch {
                            setSelected(val);
                          }
                          requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {!lastQuestion && !loading && (
                <div className="space-y-3">
                  <div className="text-base font-bold whitespace-pre-line">{responseText}</div>
                  {showIntroVideo && introVideoUrl ? (
                    <div style={{ position: "relative", paddingTop: "56.25%" }}>
                      <iframe
                        src={introVideoUrl}
                        title="Intro Video"
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {lastQuestion ? (
                <p className="text-base italic text-center mb-2 text-[var(--helper-fg)]">"{lastQuestion}"</p>
              ) : null}
              <div className="text-left mt-2">
                {loading ? (
                  <p className="font-semibold animate-pulse text-[var(--helper-fg)]">Thinking…</p>
                ) : lastQuestion ? (
                  <p className="text-base font-bold whitespace-pre-line">{responseText}</p>
                ) : null}
              </div>

              {(items || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <p className="italic text-[var(--helper-fg)]">Recommended demos</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <Row key={it.id || it.url || it.title} item={it} onPick={(val) => normalizeAndSelectDemo(val)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom Ask Bar */}
        <AskInputBar
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
