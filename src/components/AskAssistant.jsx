import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_THEME_VARS, inverseBW, UI, TabsNav } from "./AskAssistant/AskAssistant.ui";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // Debug
  const [stage, setStage] = useState("boot");

  // URL args
  const { alias, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      alias: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
    };
  }, []);
  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  // Shell state
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");
  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [responseText, setResponseText] = useState(""); // welcome text lives here
  const [loading, setLoading] = useState(false);

  // Intro video
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // Refs
  const inputRef = useRef(null);

  // Identity
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const idHeaders = useMemo(
    () => ({
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
    }),
    [sessionId, visitorId]
  );

  // Theme
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);

  // Brand
  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });

  // ---- Resolve bot (alias or bot_id) ----
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
      setResponseText(b.welcome_message || "");
      setIntroVideoUrl(b.intro_video_url || "");
      setShowIntroVideo(!!b.show_intro_video);

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

    return () => {
      cancel = true;
    };
  }, [apiBase, alias, botIdFromUrl, defaultAlias]);

  // ---- Brand (CSS vars + assets) ----
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

  // Tabs: Ask only (other tabs later)
  const tabs = useMemo(() => [{ key: "ask", label: "Ask", onClick: () => setMode("ask") }], []);

  // Send (simple)
  async function sendMessage() {
    const q = (input || "").trim();
    if (!q) return;
    if (!botId) {
      setFatal("Invalid or inactive alias.");
      return;
    }

    setLoading(true);
    setStage("ask:posting");
    try {
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idHeaders },
        body: JSON.stringify({ bot_id: botId, user_question: q, debug: false, scope: "standard" }),
      });
      const data = await res.json().catch(() => ({}));
      const text =
        data?.response_text ||
        data?.answer?.text ||
        data?.message ||
        data?.text ||
        data?.error ||
        "OK.";
      setResponseText(String(text || "").trim());
      setStage(res.ok ? "ask:ok" : "ask:error");
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

  return (
    <div className="min-h-screen" style={derivedTheme}>
      {/* Stage pill */}
      <div
        style={{
          position: "fixed",
          right: 8,
          top: 8,
          zIndex: 9999,
          background: "#000",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
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

      {/* Body: Welcome + optional video + Ask box */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {fatal ? (
          <div className={UI.CARD} style={{ border: "1px solid #ef4444" }}>
            <div className="font-bold text-red-600">Error</div>
            <div>{fatal}</div>
          </div>
        ) : (
          <div className={UI.CARD}>
            {/* Welcome text */}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
