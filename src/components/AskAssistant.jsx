import React, { useEffect, useMemo, useState } from "react";
import AppShell from "./shared/AppShell";

// Default CSS tokens to match legacy look (no image fallbacks; logo shown only if URL provided)
const DEFAULT_VARS = {
  "--page-bg": "#f3f4f6",
  "--card-bg": "#ffffff",
  "--card-border": "#e5e7eb",
  "--radius-card": "14px",
  "--shadow-card": "0 10px 25px rgba(0,0,0,0.08)",

  "--banner-bg": "#0f1417",
  "--banner-fg": "#ffffff",

  "--tab-active-bg": "#2c3e50",
  "--tab-active-fg": "#ffffff",
  "--tab-active-border": "rgba(255,255,255,0.22)",
  "--tab-active-shadow": "inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 0 rgba(0,0,0,0.15)",

  "--tab-inactive-fg": "#e5e7eb",
  "--tab-inactive-border": "rgba(255,255,255,0.18)",
  "--tab-inactive-grad-from": "rgba(255,255,255,0.10)",
  "--tab-inactive-grad-to": "rgba(255,255,255,0.00)",
  "--tab-inactive-hover-from": "rgba(255,255,255,0.16)",
  "--tab-inactive-hover-to": "rgba(255,255,255,0.04)",

  "--field-bg": "#ffffff",
  "--field-border": "#e5e7eb",
  "--send-color": "#d22e2e",
  "--send-color-hover": "#e84a4a",
};

function qp(name) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function AskAssistant() {
  const [themeVars, setThemeVars] = useState(DEFAULT_VARS);
  const [logoUrl, setLogoUrl] = useState(null);          // no fallback image
  const [introUrl, setIntroUrl] = useState("");          // if empty, video area is omitted
  const [input, setInput] = useState("");
  const [active, setActive] = useState("ask");

  // Fetch brand config (logo/css vars/intro video) from backend using alias or bot_id
  useEffect(() => {
    const alias = qp("alias");
    const botId = qp("bot_id");
    const base = "/api";

    const fetchBrand = async () => {
      try {
        const qs = botId ? `bot_id=${encodeURIComponent(botId)}` :
                 alias ? `alias=${encodeURIComponent(alias)}` : "";
        if (!qs) return; // render with defaults, no logo

        const res = await fetch(`${base}/brand?${qs}`);
        const data = await res.json();

        if (data?.ok) {
          if (data.css_vars && typeof data.css_vars === "object") {
            setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
          }
          // only trust logo coming from bot/brand record; do not synthesize
          const lu =
            data.logo_url ||
            data.logo_light_url ||
            data.logo_dark_url ||
            null;
          setLogoUrl(lu || null);

          if (data.intro_video_url) setIntroUrl(String(data.intro_video_url));
          if (data.agent?.intro_video_url) setIntroUrl(String(data.agent.intro_video_url));
        }
      } catch {
        // no fallbacks beyond defaults; leave as-is for easy debugging
      }
    };

    fetchBrand();
  }, []);

  const tabs = useMemo(
    () => [
      { key: "ask", label: "Ask", active: active === "ask", onClick: () => setActive("ask") },
      { key: "browse", label: "Browse Demos", active: active === "browse", onClick: () => setActive("browse") },
      { key: "docs", label: "Browse Documents", active: active === "docs", onClick: () => setActive("docs") },
      { key: "price", label: "Price Estimate", active: active === "price", onClick: () => setActive("price") },
      { key: "meeting", label: "Schedule Meeting", active: active === "meeting", onClick: () => setActive("meeting") },
    ],
    [active]
  );

  const handleSend = (text) => {
    // Wire up to your message pipeline later
    // For now, keep UX responsive
    console.log("SEND:", text);
    setInput("");
  };

  return (
    <AppShell
      title="Ask the Assistant"
      logoUrl={logoUrl}
      tabs={tabs}
      askValue={input}
      askPlaceholder="Ask your question here"
      onAskChange={setInput}
      onAskSend={handleSend}
      themeVars={themeVars}
    >
      {/* Center content area — welcome + (optional) intro video */}
      {active === "ask" && (
        <div className="space-y-3">
          <div className="text-black text-base font-bold">
            Welcome to DemoHAL where you can Let Your Product Sell Itself. From here you can ask
            technical or business related questions, watch short video demos based on your interest,
            review the document library for technical specifications, case studies, and other
            materials, book a meeting, or even get a price quote. You can get started by watching
            this short video, or simply by asking your first question.
          </div>

          {!!introUrl && (
            <div className="bg-white pt-2 pb-2">
              <div style={{ position: "relative", paddingTop: "56.25%" }}>
                <iframe
                  src={introUrl}
                  title="Intro Video"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                  className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
