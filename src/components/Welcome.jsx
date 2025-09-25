/* Welcome.jsx — trimmed to init app, paint shell, welcome, Q&A only */

import React, { useEffect, useMemo, useRef, useState } from "react";
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

                {/* Content */}
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
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            height: "100%",
                                        }}
                                        className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                                    />
                                </div>
                            ) : null}
                        </div>
                    )}

                    {lastQuestion ? (
                        <p className="text-base italic text-center mb-2 text-[var(--helper-fg)]">
                            "{lastQuestion}"
                        </p>
                    ) : null}

                    <div className="text-left mt-2">
                        {loading ? (
                            <p className="font-semibold animate-pulse text-[var(--helper-fg)]">
                                Thinking…
                            </p>
                        ) : lastQuestion ? (
                            <p className="text-base font-bold whitespace-pre-line">
                                {responseText}
                            </p>
                        ) : null}
                    </div>
                </div>

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
