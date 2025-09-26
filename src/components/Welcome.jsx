/* Welcome.jsx — trimmed to init app, paint shell, welcome, Q&A only */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import fallbackLogo from "../assets/logo.png";

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
    "--message-fg": "#000000",
    "--helper-fg": "#4b5563",
    "--mirror-fg": "#4b5563",
    "--tab-bg": "#303030",
    "--tab-fg": "#ffffff",
    "--tab-active-fg": "#ffffff",
    "--demo-button-bg": "#3a4554",
    "--demo-button-fg": "#ffffff",
    "--doc.button.background": "#000000",
    "--doc-button-bg": "#000000",
    "--doc-button-fg": "#ffffff",
    "--price-button-bg": "#1a1a1a",
    "--price-button-fg": "#ffffff",
    "--send-color": "#000000",
    "--border-default": "#9ca3af",
};

const classNames = (...xs) => xs.filter(Boolean).join(" ");

// [PATCH 2]: Dumb UI components (tabs + list pane) inserted above component export
function TabBar({ tabs, active, onChange }) {
    return (
        <div className="px-4 sm:px-6 border-b border-[var(--border-default)] bg-[var(--card-bg)]">
            <div className="flex gap-2 py-2">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => onChange(t.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm ${active === t.key ? "bg-[var(--tab-bg)] text-[var(--tab-fg)]" : "hover:bg-black/5"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

const VARIANT_TOKENS = {
    demos: { "--btn-bg": "var(--demo-button-bg)", "--btn-fg": "var(--demo-button-fg)" },
    docs:  { "--btn-bg": "var(--doc-button-bg)",  "--btn-fg": "var(--doc-button-fg)"  },
    recs:  { "--btn-bg": "var(--tab-bg)",         "--btn-fg": "var(--tab-fg)"         },
};

function ChoiceListPane({ title, variant, items }) {
    const tokens = VARIANT_TOKENS[variant] || {};
    return (
        <section className="flex-1 flex flex-col gap-4" style={tokens}>
            {title ? <div className="text-sm text-[var(--helper-fg)]">{title}</div> : null}
            <div className="flex flex-col gap-3">
                {items.map((it) => (
                    <button
                        key={it.id}
                        onClick={it.action}
                        className="w-full text-left rounded-xl border border-[var(--border-default)] px-4 py-3 bg-[var(--btn-bg)] text-[var(--btn-fg)] hover:opacity-95"
                    >
                        <div className="font-semibold">{it.label}</div>
                        {it.description ? <div className="text-sm opacity-90">{it.description}</div> : null}
                    </button>
                ))}
            </div>
        </section>
    );
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

    // Q&A state
    const [input, setInput] = useState("");
    const [lastQuestion, setLastQuestion] = useState("");
    const [responseText, setResponseText] = useState("");
    const [loading, setLoading] = useState(false);

    // [PATCH 4]: Unified list data + tiny view controller
    const [demoItems, setDemoItems] = useState([]);
    const [docItems, setDocItems] = useState([]);
    const [recs, setRecs] = useState(null);

    const [view, setView] = useState("ask"); // 'ask' | 'recs' | 'demos' | 'docs'
    const setViewSafe = useCallback((next) => {
        if (next === "ask") requestAnimationFrame(() => inputRef.current?.focus());
        setView(next);
    }, []);

    // Welcome media
    const [introVideoUrl, setIntroVideoUrl] = useState("");
    const [showIntroVideo, setShowIntroVideo] = useState(false);

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

    // [PATCH 3]: Feature flags (from /bot-settings)
    const [featureFlags, setFeatureFlags] = useState({
        show_browse_demos: false,
        show_browse_docs: false,
    });


    const initialBrandReady = useMemo(
        () => !(botIdFromUrl || alias),
        [botIdFromUrl, alias]
    );
    const [brandReady, setBrandReady] = useState(initialBrandReady);

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
            // [PATCH 5]: capture feature flags for tabs
            setFeatureFlags({
                show_browse_demos: !!b.show_browse_demos,
                show_browse_docs: !!b.show_browse_docs,
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
            // [PATCH 5]: capture feature flags for tabs
            setFeatureFlags({
                show_browse_demos: !!b.show_browse_demos,
                show_browse_docs: !!b.show_browse_docs,
            });
                }
                if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
            } catch { }
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
            // [PATCH 5]: capture feature flags for tabs
            setFeatureFlags({
                show_browse_demos: !!b.show_browse_demos,
                show_browse_docs: !!b.show_browse_docs,
            });
                }
                if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
            } catch { }
        })();
        return () => {
            cancel = true;
        };
    }, [botIdFromUrl, apiBase]);

    useEffect(() => {
        if (!botId && !alias && !brandReady) setBrandReady(true);
    }, [botId, alias, brandReady]);

    // Brand: css vars + assets
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

    // [PATCH 6]: Load demos when enabled
useEffect(() => {
    if (!botId || !featureFlags.show_browse_demos) return;
    let cancel = false;
    (async () => {
        try {
            const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
            const data = await res.json();
            if (cancel) return;
            const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.demos) ? data.demos : []);
            setDemoItems(
                arr.map((d, i) => ({
                    id: d.id || `demo-${i}`,
                    label: d.title || d.label || "Demo",
                    description: d.description || "",
                    action: () => {
                        const url = d.url || `${apiBase}/render-video-iframe?bot_id=${encodeURIComponent(botId)}&demo_id=${encodeURIComponent(d.id || "")}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                    },
                }))
            );
        } catch {}
    })();
    return () => { cancel = true; };
}, [botId, featureFlags.show_browse_demos, apiBase]);

// [PATCH 7]: Load docs when enabled
useEffect(() => {
    if (!botId || !featureFlags.show_browse_docs) return;
    let cancel = false;
    (async () => {
        try {
            const res = await fetch(`${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`);
            const data = await res.json();
            if (cancel) return;
            const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.documents) ? data.documents : []);
            setDocItems(
                arr.map((doc, i) => ({
                    id: doc.id || `doc-${i}`,
                    label: doc.title || doc.label || "Document",
                    description: doc.description || "",
                    action: () => {
                        const url = doc.url || `${apiBase}/render-doc-iframe?bot_id=${encodeURIComponent(botId)}&doc_id=${encodeURIComponent(doc.id || "")}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                    },
                }))
            );
        } catch {}
    })();
    return () => { cancel = true; };
}, [botId, featureFlags.show_browse_docs, apiBase]);

    // Autosize ask box
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [input]);

    /* ============ *
     *   Ask Flow   *
     * ============ */
    async function sendMessage() {
        if (!input.trim() || !botId) return;
        const outgoing = input.trim();

        setLastQuestion(outgoing);
        setInput("");
        setResponseText("");
        setLoading(true);

        try {
            const res = await axios.post(
                `${apiBase}/demo-hal`,
                withIdsBody({
                    bot_id: botId,
                    user_question: outgoing,
                    scope: "standard",
                    debug: true,
                }),
                { timeout: 30000, headers: withIdsHeaders() }
            );
            const data = res?.data || {};
            const text = data?.response_text || "";

            
// [PATCH 11]: Map optional recommendations from ask/answer
try {
    const recsRaw = Array.isArray(data?.recommendations) ? data.recommendations : [];
    const mapped = recsRaw.map((r, idx) => ({
        id: `${r.type || (r.url?.includes('/doc') ? 'doc' : 'demo')}:${r.id ?? idx}`,
        label: r.title || r.label || 'Recommended',
        description: r.description || r.reason || '',
        action: () => {
            if ((r.type === 'doc') || r.url?.includes('/doc')) {
                const url = r.url || `${apiBase}/render-doc-iframe?bot_id=${encodeURIComponent(botId)}&doc_id=${encodeURIComponent(r.id || '')}`;
                window.open(url, "_blank", "noopener,noreferrer");
            } else {
                const url = r.url || `${apiBase}/render-video-iframe?bot_id=${encodeURIComponent(botId)}&demo_id=${encodeURIComponent(r.id || '')}`;
                window.open(url, "_blank", "noopener,noreferrer");
            }
        },
    }));
    setRecs(mapped.length ? mapped : null);
} catch {}
setResponseText(text);
            setLoading(false);

            requestAnimationFrame(() =>
                contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
            );
        } catch {
            setLoading(false);
            setResponseText("Sorry—something went wrong.");
        }
    }

    /* ============ *
     *   Render     *
     * ============ */
// [PATCH 8]: Data-driven tabs model
const tabs = useMemo(() => [
    { key: "ask",   label: "Ask" },
    { key: "recs",  label: "Recommendations", hidden: !(recs && recs.length) },
    { key: "demos", label: "Demos",     hidden: !featureFlags.show_browse_demos },
    { key: "docs",  label: "Documents", hidden: !featureFlags.show_browse_docs },
].filter(t => !t.hidden), [recs, featureFlags]);



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
                style={themeVars}
            >
                <div className="text-gray-800 text-center space-y-2">
                    <div className="text-lg font-semibold">No bot selected</div>
                    {alias ? (
                        <div className="text-sm text-gray-600">
                            Resolving alias “{alias}”…
                        </div>
                    ) : (
                        <div className="text-sm text-gray-600">
                            Provide a <code>?bot_id=…</code> or <code>?alias=…</code> in the
                            URL
                            {defaultAlias ? <> (trying default alias “{defaultAlias}”)</> : null}.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const logoSrc =
        brandAssets.logo_url ||
        brandAssets.logo_light_url ||
        brandAssets.logo_dark_url ||
        fallbackLogo;

    return (
        <div
            className={classNames(
                "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200",
                brandReady ? "opacity-100" : "opacity-0"
            )}
            style={themeVars}
        >
            <div
                className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-[var(--card-bg)] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)] flex flex-col overflow-hidden transition-all duration-300"
            >
                {/* Header */}
                <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] border-b border-[var(--border-default)]">
                    <div className="flex items-center justify-between w-full py-3">
                        <div className="flex items-center gap-3">
                            <img src={logoSrc} alt="Brand logo" className="h-10 object-contain" />
                        </div>
                        <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">
                            Ask the Assistant
                        </div>
                    </div>
                </div>

                {/* Tabs [PATCH 9] */}
                <TabBar tabs={tabs} active={view} onChange={setViewSafe} />

                {/* Content [PATCH 10]: view switch */}
{view === 'ask' && (
  <div
    ref={contentRef}
    className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto"
  >
    {!lastQuestion && !loading && (
      <div className="space-y-3">
        <div className="text-base font-bold whitespace-pre-line">
          {responseText}
        </div>
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
  </div>
)}
{view === 'recs' && (
  <div className="px-6 pt-3 pb-6 flex-1 flex flex-col overflow-y-auto">
    <ChoiceListPane title="Recommended next steps" variant="recs" items={recs || []} />
  </div>
)}
{view === 'demos' && (
  <div className="px-6 pt-3 pb-6 flex-1 flex flex-col overflow-y-auto">
    <ChoiceListPane title="Pick a demo" variant="demos" items={demoItems} />
  </div>
)}
{view === 'docs' && (
  <div className="px-6 pt-3 pb-6 flex-1 flex flex-col overflow-y-auto">
    <ChoiceListPane title="Browse documents" variant="docs" items={docItems} />
  </div>
)}

                {/* Bottom Ask Bar */}
                <div
                    className="px-4 py-3 border-t border-[var(--border-default)]"
                    data-patch="ask-bottom-bar"
                >
                    <div className="relative w-full">
                        <textarea
                            ref={inputRef}
                            rows={1}
                            className="w-full rounded-[0.75rem] px-4 py-2 pr-14 text-base placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--card-bg)] border border-[var(--border-default)] focus:border-[var(--border-default)] focus:ring-1 focus:ring-[var(--border-default)] outline-none"
                            placeholder="Ask your question here"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onInput={(e) => {
                                e.currentTarget.style.height = "auto";
                                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                        />
                        <button
                            aria-label="Send"
                            onClick={sendMessage}
                            className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95"
                        >
                            <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:brightness-110" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
