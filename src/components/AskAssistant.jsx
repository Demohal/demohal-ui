import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import {
  DEFAULT_THEME_VARS,
  inverseBW,
  UI,
} from "./AskAssistant/AskAssistant.ui";
import DocIframe from "./AskAssistant/DocIframe";
import ColorBox from "./AskAssistant/widgets/ColorBox";
import DebugPanel from "./AskAssistant/DebugPanel";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL → alias / bot_id / themelab
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

  // Core state
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");
  const [resolved, setResolved] = useState(false); // nothing renders until true

  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [responseText, setResponseText] = useState("");

  // Theme / brand
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);
  const [brandAssets, setBrandAssets] = useState({ logo_url: null });

  // Intro video
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // Tabs enable flags
  const [tabsEnabled, setTabsEnabled] = useState({ demos: false, docs: false, meeting: false, price: false });

  // Ask box autosize
  const inputRef = useRef(null);
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    const lineH = 24; // close to UI.FIELD line-height
    const max = lineH * 3; // up to 3 lines
    el.style.height = "auto";
    el.style.maxHeight = `${max}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [input]);

  // Resolve bot
  useEffect(() => {
    async function loadBy(url) {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false || !data?.bot?.id) {
        setFatal("Invalid or inactive alias.");
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
      setResponseText(b.welcome_message || "");
      setIntroVideoUrl(b.intro_video_url || "");
      setShowIntroVideo(!!b.show_intro_video);
      setBotId(b.id);
      setResolved(true);
    }
    (async () => {
      try {
        if (botIdFromUrl) return loadBy(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`);
        const useAlias = alias || defaultAlias;
        if (!useAlias) { setResolved(false); return; }
        return loadBy(`${apiBase}/bot-settings?alias=${encodeURIComponent(useAlias)}`);
      } catch {
        setResolved(false);
      }
    })();
  }, [alias, defaultAlias, botIdFromUrl, apiBase]);

  // Load brand after bot resolves
  useEffect(() => {
    if (!resolved || !botId) return;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json().catch(() => ({}));
        if (data?.ok && data?.css_vars && typeof data.css_vars === "object") {
          setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
        }
        if (data?.ok && data?.assets?.logo_url) setBrandAssets({ logo_url: data.assets.logo_url });
      } catch {}
    })();
  }, [resolved, botId, apiBase]);

  // Tabs list
  const tabs = [
    tabsEnabled.demos && { key: "demos", label: "Browse Demos" },
    tabsEnabled.docs && { key: "docs", label: "Browse Documents" },
    tabsEnabled.price && { key: "price", label: "Price Estimate" },
    tabsEnabled.meeting && { key: "meeting", label: "Schedule Meeting" },
  ].filter(Boolean);

  // Send
  const send = () => {};

  // Gate: nothing until alias/bot resolved
  const noBot = !resolved;

  return (
    <div className="min-h-screen" style={derivedTheme}>
      {noBot ? (
        <div className="w-full h-[60vh] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-2xl font-semibold mb-1">No bot selected</div>
            <div className="text-sm">Provide a <code>?bot_id=…</code> or <code>?alias=…</code> in the URL.</div>
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-8 mb-10 rounded-2xl overflow-hidden" style={{ width: "56rem", boxShadow: "var(--shadow-elevation, 0 10px 30px rgba(0,0,0,.08))" }}>
          {/* Banner INSIDE card */}
          <div className="bg-black text-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {brandAssets.logo_url ? (
                  <img src={brandAssets.logo_url} alt="logo" className="h-8 w-auto" />
                ) : (
                  <div className="font-extrabold">DemoHAL</div>
                )}
              </div>
              <div className="text-sm font-semibold" style={{ color: "#22c55e" }}>Ask the Assistant</div>
            </div>
            {/* Centered tabs */}
            <div className="flex justify-center gap-2 pt-3">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setMode(t.key)} className={mode === t.key ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="px-4 pb-4">
            <div className={UI.CARD}>
              {responseText ? (
                <div className="text-base whitespace-pre-line text-[var(--message-fg)]">{responseText}</div>
              ) : null}
              {showIntroVideo && introVideoUrl ? (
                <div className="mt-3">
                  <iframe title="intro" src={introVideoUrl} className="w-full aspect-video rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                </div>
              ) : null}

              {/* Footer divider + ask box (1→3 lines) */}
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
                  onClick={send}
                  className="absolute right-2 bottom-2"
                  aria-label="Send"
                  title="Send"
                >
                  <ArrowUpCircleIcon className="h-8 w-8 text-[var(--send-color,#22c55e)]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ThemeLab floating panel (unchanged) */}
      {themeLabOn && botId ? (
        <ColorBox apiBase={apiBase} botId={botId} frameRef={null} onVars={(vars) => setThemeVars((prev) => ({ ...prev, ...vars }))} />
      ) : null}

      <DebugPanel debug={{ active_context: { scope: mode } }} />
    </div>
  );
}
