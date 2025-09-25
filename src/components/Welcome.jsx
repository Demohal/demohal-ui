import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import { DEFAULT_THEME_VARS, inverseBW, UI } from "./AskAssistant/AskAssistant.ui";

export default function AskAssistant() {
    const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

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

    const [botId, setBotId] = useState(botIdFromUrl || "");
    const [resolved, setResolved] = useState(false);
    const [mode, setMode] = useState("welcome");

    const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
    const derivedTheme = useMemo(() => {
        const activeFg = inverseBW(themeVars["--tab-fg"] || "#000");
        return { ...themeVars, "--tab-active-fg": activeFg };
    }, [themeVars]);

    const [brandAssets, setBrandAssets] = useState({ logo_url: null });
    const [welcomeText, setWelcomeText] = useState("");
    const [introVideoUrl, setIntroVideoUrl] = useState("");
    const [showIntroVideo, setShowIntroVideo] = useState(false);

    const [tabsEnabled, setTabsEnabled] = useState({
        demos: false,
        docs: false,
        meeting: false,
        price: false,
    });

    const [input, setInput] = useState("");
    const inputRef = useRef(null);
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        const lineH = 22,
            max = lineH * 3;
        el.style.height = "auto";
        el.style.maxHeight = `${max}px`;
        el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
        el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    }, [input]);

    useEffect(() => {
        async function loadBy(url) {
            const res = await fetch(url);
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.ok === false || !data?.bot?.id) {
                setResolved(false);
                return;
            }
            const b = data.bot;
            setTabsEnabled({
                demos: !!b.show_browse_demos,
                docs: !!b.show_browse_docs,
                meeting: !!b.show_schedule_meeting,
                price: !!b.show_price_estimate,
            });
            setWelcomeText(b.welcome_message || "");
            setIntroVideoUrl(b.intro_video_url || "");
            setShowIntroVideo(!!b.show_intro_video);
            setBotId(b.id);
            setResolved(true);
        }
        (async () => {
            try {
                if (botIdFromUrl)
                    return loadBy(
                        `${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`
                    );
                const useAlias = alias || defaultAlias;
                if (!useAlias) {
                    setResolved(false);
                    return;
                }
                return loadBy(
                    `${apiBase}/bot-settings?alias=${encodeURIComponent(useAlias)}`
                );
            } catch {
                setResolved(false);
            }
        })();
    }, [alias, defaultAlias, botIdFromUrl, apiBase]);

    useEffect(() => {
        if (!resolved || !botId) return;
        (async () => {
            try {
                const res = await fetch(
                    `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`
                );
                const data = await res.json().catch(() => ({}));
                if (data?.ok && data?.css_vars && typeof data.css_vars === "object") {
                    const root = document.documentElement;
                    for (const k of Object.keys(data.css_vars))
                        root.style.setProperty(k, data.css_vars[k]);
                    setThemeVars((p) => ({ ...p, ...data.css_vars }));
                }
                if (data?.ok && data?.assets?.logo_url)
                    setBrandAssets({ logo_url: data.assets.logo_url });
            } catch { }
        })();
    }, [resolved, botId, apiBase]);

    const tabs = [
        tabsEnabled.demos && {
            key: "demos",
            label: "Browse Demos",
            onClick: () => setMode("demos"),
        },
        tabsEnabled.docs && {
            key: "docs",
            label: "Browse Documents",
            onClick: () => setMode("docs"),
        },
        tabsEnabled.price && {
            key: "price",
            label: "Price Estimate",
            onClick: () => setMode("price"),
        },
        tabsEnabled.meeting && {
            key: "meeting",
            label: "Schedule Meeting",
            onClick: () => setMode("meeting"),
        },
    ].filter(Boolean);

    const CARD_W = "48rem";
    const CARD_H = "44rem";

    if (!resolved) {
        return (
            <div
                className="min-h-screen flex items-center justify-center text-gray-500"
                style={derivedTheme}
            >
                <div className="text-center">
                    <div className="text-2xl font-semibold mb-1">No bot selected</div>
                    <div className="text-sm">
                        Provide a <code>?bot_id=…</code> or <code>?alias=…</code> in the URL.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={derivedTheme}>
            <div
                className="mx-auto mt-8 mb-10 rounded-2xl overflow-hidden"
                style={{
                    width: CARD_W,
                    height: CARD_H,
                    boxShadow: "var(--shadow-elevation, 0 10px 30px rgba(0,0,0,.08))",
                }}
            >
                {/* Banner */}
                <div className="bg-black text-white px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {brandAssets.logo_url ? (
                                <img src={brandAssets.logo_url} alt="logo" className="h-12 w-auto" />
                            ) : (
                                <div className="font-extrabold text-xl">DemoHAL</div>
                            )}
                        </div>
                        <div className="text-2xl font-semibold" style={{ color: "#22c55e" }}>
                            Ask the Assistant
                        </div>
                    </div>
                    <div className="flex justify-center gap-2 pt-3">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={t.onClick}
                                className={mode === t.key ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div
                    className="px-4 pb-4 overflow-auto"
                    style={{ height: `calc(${CARD_H} - 6.5rem)` }}
                >
                    <div className={UI.CARD}>
                        {welcomeText ? (
                            <div className="text-base font-semibold whitespace-pre-line text-[var(--message-fg)]">
                                {welcomeText}
                            </div>
                        ) : null}
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

                        {/* Footer ask box */}
                        <div className="mt-3 pt-3 border-t border-[var(--border-color,#e5e7eb)] relative">
                            <textarea
                                ref={inputRef}
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask your question here"
                                className={UI.FIELD + " pr-12"}
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2"
                                aria-label="Send"
                                title="Send"
                            >
                                <ArrowUpCircleIcon className="h-8 w-8 text-[var(--send-color,#22c55e)]" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
