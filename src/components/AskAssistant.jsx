// src/components/AskAssistant.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

// UI tokens + small primitives (same values as old file)
import {
  DEFAULT_THEME_VARS,
  TOKEN_TO_CSS,
  SCREEN_ORDER,
  UI,
  inverseBW,
} from "./AskAssistant/AskAssistant.ui";

// Small leaf components (used later but safe to import now)
import DocIframe from "./AskAssistant/DocIframe";
import ColorBox from "./AskAssistant/ColorBox";
import DebugPanel from "./AskAssistant/DebugPanel";

// ---------------------------------------------
// AskAssistant (shell only — same layout/order)
// ---------------------------------------------
export default function AskAssistant() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL → alias / bot_id / themelab (unchanged)
  const { alias, botIdFromUrl, themeLabOn } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const a = (qs.get("alias") || qs.get("alais") || "").trim();
    const b = (qs.get("bot_id") || "").trim();
    const th = (qs.get("themelab") || "").trim();
    return {
      alias: a,
      botIdFromUrl: b,
      themeLabOn: th === "1" || th.toLowerCase() === "true",
    };
  }, []);

  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  // Core state kept from old file
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");
  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [responseText, setResponseText] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
    price: false,
  });

  // Theme + brand
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#ffffff");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);
  const [pickerVars, setPickerVars] = useState({});
  const liveTheme = useMemo(() => ({ ...derivedTheme, ...pickerVars }), [derivedTheme, pickerVars]);

  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });

  // Refs
  const inputRef = useRef(null);

  // -------------------------
  // Autosize ask textarea
  // -------------------------
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // -------------------------
  // Resolve bot by alias
  // -------------------------
  useEffect(() => {
    if (botId) return;
    const useAlias = alias || defaultAlias;
    if (!useAlias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(useAlias)}`);
        const data = await res.json();
        if (cancel) return;
        const b = data?.ok ? data?.bot : null;
        if (b) {
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
            price: !!b.show_price_estimate,
          });
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setBotId(b.id || "");
        } else {
          setFatal("Invalid or inactive alias.");
        }
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => { cancel = true; };
  }, [alias, defaultAlias, apiBase, botId]);

  // -------------------------
  // Brand: css vars + assets
  // -------------------------
  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`);
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
      } catch {}
    })();
    return () => { cancel = true; };
  }, [botId, apiBase]);

  // Tabs list (identical labels/order)
  const tabs = [
    tabsEnabled.demos && { key: "demos", label: "Browse Demos", onClick: () => setMode("demos") },
    tabsEnabled.docs && { key: "docs", label: "Browse Documents", onClick: () => setMode("docs") },
    tabsEnabled.price && { key: "price", label: "Price Estimate", onClick: () => setMode("price") },
    tabsEnabled.meeting && { key: "meeting", label: "Schedule Meeting", onClick: () => setMode("meeting") },
  ].filter(Boolean);

  // Send keybinding (Cmd/Ctrl+Enter)
  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  // Stub send
  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      // (kept as a no-op for now — old behavior preserved visually)
      setInput("");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------
  // RENDER — exact shell order/format as before
  // ---------------------------------------------
  return (
    <div className="min-h-screen" style={liveTheme}>
      {/* Banner WITH tabs inside (exact like old) */}
      <div className="w-full" style={{ background: "var(--banner-bg)", color: "var(--banner-fg)" }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {brandAssets.logo_url ? (
                <img src={brandAssets.logo_url} alt="logo" className="h-8 w-auto" />
              ) : (
                <div className="font-extrabold">DemoHAL</div>
              )}
            </div>
            <div className="text-green-400 font-semibold">Ask the Assistant</div>
          </div>

          {/* Tabs row is INSIDE banner */}
          <div className="flex gap-2 pb-3">
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
      </div>

      {/* Body card (fixed width like old) */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {fatal ? (
          <div className={UI.CARD} style={{ border: "1px solid #ef4444" }}>
            <div className="font-bold text-red-600">Error</div>
            <div>{fatal}</div>
          </div>
        ) : mode === "ask" ? (
          <div className={UI.CARD}>
            {/* Welcome copy */}
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

            {/* Ask box with arrow button INSIDE the field on the right */}
            <div className="mt-3 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask a question (Cmd/Ctrl+Enter to send)"
                className={UI.FIELD + " pr-12"} // room for icon
              />
              <button
                aria-label="Send"
                title={loading ? "Sending..." : "Send"}
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="absolute right-2 bottom-2 disabled:opacity-50"
              >
                <ArrowUpCircleIcon className="h-8 w-8 text-[var(--send-color)]" />
              </button>
            </div>
          </div>
        ) : (
          // Other modes will be re-attached next
          <div className={UI.CARD}>Loading…</div>
        )}
      </div>
    </div>
  );
}
