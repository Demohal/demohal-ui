// File: src/components/ControlShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function ControlShell() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL → alias / bot_id / themelab
  const { alias, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      alias: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
    };
  }, []);
  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  // Core shell state
  const [mode, setMode] = useState("welcome"); // welcome | bot_response | demos | docs | price | meeting
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [resolved, setResolved] = useState(false);
  const [fatal, setFatal] = useState("");

  // Branding
  const [cssVars, setCssVars] = useState({});
  const [brandLogo, setBrandLogo] = useState(null);

  // Ask box
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    const lineH = 22; const max = lineH * 3;
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
      setBotId(data.bot.id);
      setResolved(true);
    }
    (async () => {
      try {
        if (botIdFromUrl) return loadBy(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`);
        const useAlias = alias || defaultAlias; if (!useAlias) { setResolved(false); return; }
        return loadBy(`${apiBase}/bot-settings?alias=${encodeURIComponent(useAlias)}`);
      } catch { setResolved(false); }
    })();
  }, [alias, defaultAlias, botIdFromUrl, apiBase]);

  // Load brand tokens → apply to card root only
  const cardRef = useRef(null);
  useEffect(() => {
    if (!resolved || !botId) return;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json().catch(() => ({}));
        const vars = (data?.ok && data?.css_vars && typeof data.css_vars === "object") ? data.css_vars : {};
        setCssVars(vars);
        if (data?.ok && data?.assets?.logo_url) setBrandLogo(data.assets.logo_url);
        // Apply directly to the card element to avoid global overrides
        const el = cardRef.current; if (el && vars) {
          for (const k of Object.keys(vars)) el.style.setProperty(k, vars[k]);
        }
      } catch {}
    })();
  }, [resolved, botId, apiBase]);

  // Fixed card metrics
  const CARD_W = "48rem";
  const CARD_H = "44rem";

  // Content Outlet (simple switch for now)
  const ContentOutlet = () => {
    switch (mode) {
      case "welcome":
        return (
          <div className="text-[var(--message-fg,#111827)]">
            <div className="font-semibold mb-2">Welcome</div>
            <p>Content area is locked inside the frame. Try switching tabs or asking a question.</p>
          </div>
        );
      case "bot_response":
        return (
          <div>
            <div className="font-semibold mb-2">Bot Response</div>
            <p>This is where answers will render.</p>
          </div>
        );
      default:
        return (
          <div>
            <div className="font-semibold mb-2">{mode}</div>
            <p>Stub view inside the content area.</p>
          </div>
        );
    }
  };

  // Gate: show nothing until bot is resolved
  if (!resolved) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-1">No bot selected</div>
          <div className="text-sm">Provide a <code>?bot_id=…</code> or <code>?alias=…</code> in the URL.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div
        ref={cardRef}
        className="mx-auto mt-8 mb-10 rounded-2xl overflow-hidden"
        style={{ width: CARD_W, height: CARD_H, boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}
      >
        {/* Banner inside card */}
        <div className="bg-black text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {brandLogo ? (
                <img src={brandLogo} alt="logo" className="h-8 w-auto" />
              ) : (
                <div className="font-extrabold">DemoHAL</div>
              )}
            </div>
            <div className="text-sm font-semibold" style={{ color: "#22c55e" }}>Ask the Assistant</div>
          </div>
          {/* Tabs centered */}
          <div className="flex justify-center gap-2 pt-3">
            {[
              { key: "welcome", label: "Welcome" },
              { key: "bot_response", label: "Bot Response" },
              { key: "demos", label: "Browse Demos" },
              { key: "docs", label: "Browse Documents" },
              { key: "price", label: "Price Estimate" },
              { key: "meeting", label: "Schedule Meeting" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                className={
                  (mode === t.key
                    ? "bg-[var(--tab-active-bg,#111827)] text-[var(--tab-active-fg,#ffffff)]"
                    : "bg-[var(--tab-bg,#111827)] text-[var(--tab-fg,#9ca3af)] hover:text-white)") +
                  " px-3 py-1 rounded-full text-sm"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body: scroll within fixed card */}
        <div className="px-4 pb-4 overflow-auto" style={{ height: `calc(${CARD_H} - 6.5rem)` }}>
          <div className="bg-[var(--card-bg,#ffffff)] text-[var(--message-fg,#111827)] rounded-xl p-3 shadow-sm">
            <ContentOutlet />
            {/* Footer divider + ask box */}
            <div className="mt-3 pt-3 border-t border-[var(--border-color,#e5e7eb)] relative">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your question here"
                className="w-full resize-none rounded-lg border border-[var(--border-color,#e5e7eb)] bg-white/50 p-3 pr-12 focus:outline-none"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[var(--send-color,#ef4444)] text-white grid place-items-center"
                aria-label="Send"
                title="Send"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 2l5 20-5-3-5 3 5-20z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
