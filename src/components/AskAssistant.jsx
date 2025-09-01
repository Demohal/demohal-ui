// src/components/AskAssistant.jsx
// Modular orchestrator that uses the new hooks + screen components.
// Layout: banner with tabs (pinned), content area, and an ask bar that's always visible.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

// Hooks
import useBotState from "../hooks/useBotState";
import useBrandTokens from "../hooks/useBrandTokens";
import useAsk from "../hooks/useAsk";
import usePricing from "../hooks/usePricing";
import useDemos from "../hooks/useDemos";
import useDocs from "../hooks/useDocs";
import useAgent from "../hooks/useAgent";

// Screens
import AskView from "./screens/AskView";
import BrowseDemos from "./screens/BrowseDemos";
import ViewDemo from "./screens/ViewDemo";
import BrowseDocs from "./screens/BrowseDocs";
import ViewDoc from "./screens/ViewDoc";
import PriceEstimate from "./screens/PriceEstimate";
import ScheduleMeeting from "./screens/ScheduleMeeting";

// Assets
import fallbackLogo from "../assets/logo.png";

/* ------------------ Theme defaults (used until /brand arrives) ------------------ */
const DEFAULT_THEME_VARS = {
  "--banner-bg": "#0b1015",
  "--banner-fg": "#ffffff",
  "--page-bg": "#EFF2F5",
  "--card-bg": "#FFFFFF",
  "--card-border": "#E5E7EB",
  "--radius-card": "1rem",
  "--shadow-card": "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",
  "--field-bg": "#FFFFFF",
  "--field-border": "#9CA3AF",
  "--send-color": "#EA4335",
  "--send-color-hover": "#C03327",
};

const classNames = (...xs) => xs.filter(Boolean).join(" ");

/* -------------------------------- Tabs UI -------------------------------- */
function TabsNav({ mode, tabs }) {
  return (
    <div className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav className="inline-flex min-w-max items-center gap-0.5 overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {tabs.map((t) => {
          const active =
            (mode === "browse" && t.key === "demos") ||
            (mode === "docs" && t.key === "docs") ||
            (mode === "price" && t.key === "price") ||
            (mode === "meeting" && t.key === "meeting");
          return (
            <button
              key={t.key}
              onClick={t.onClick}
              role="tab"
              aria-selected={active}
              className={
                active
                  ? "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 bg-white text-black -mb-px shadow-[0_2px_0_rgba(0,0,0,.15)]"
                  : "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 text-white border-gray-600 bg-gradient-to-b from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]"
              }
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ------------------------------ Main component ------------------------------ */
export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com";

  // Extract URL params
  const { aliasFromUrl, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      aliasFromUrl: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
    };
  }, []);

  // Resolve bot + flags/content
  const {
    botId,
    loading: botLoading,
    fatal,
    tabsEnabled,
    welcomeMessage,
    introVideoUrl,
    showIntroVideo,
    titleFor,
  } = useBotState({
    apiBase,
    initialBotId: botIdFromUrl,
    initialAlias: aliasFromUrl,
    defaultAlias: (import.meta.env.VITE_DEFAULT_ALIAS || "demo").trim(),
  });

  // Theme + logo
  const { themeVars, assets: brandAssets } = useBrandTokens({
    apiBase,
    botId,
    fallback: DEFAULT_THEME_VARS,
  });

  // Modes: ask | browse | docs | price | meeting
  const [mode, setMode] = useState("ask");
  const [selected, setSelected] = useState(null); // selected demo/doc

  // Ask flow
  const {
    input,
    setInput,
    lastQuestion,
    responseText,
    recommendations,
    loading: askLoading,
    send,
    clear: clearAsk,
  } = useAsk({ apiBase, botId });

  // Demos/docs lists
  const { items: demoItems, loading: demosLoading, error: demosError, load: loadDemos } = useDemos({ apiBase, botId, autoLoad: false });
  const { items: docItems, loading: docsLoading, error: docsError, load: loadDocs } = useDocs({ apiBase, botId, autoLoad: false });

  // Meeting agent
  const { agent, loading: agentLoading, error: agentError, refresh: refreshAgent } = useAgent({ apiBase, botId });

  // Pricing
  const {
    questions,
    uiCopy,
    answers,
    estimate,
    loadingQuestions,
    estimating,
    errorQuestions,
    errorEstimate,
    loadQuestions,
    setAnswer,
    toggleMulti,
    haveAllRequired,
    nextQuestion,
    mirrorLines,
  } = usePricing({ apiBase, botId, autoCompute: true });

  // UI refs
  const contentRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-size textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Tab actions
  const openBrowse = () => {
    setMode("browse");
    setSelected(null);
    loadDemos();
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  };
  const openBrowseDocs = () => {
    setMode("docs");
    setSelected(null);
    loadDocs();
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  };
  const openPrice = () => {
    setMode("price");
    setSelected(null);
    loadQuestions();
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  };
  const openMeeting = () => {
    setMode("meeting");
    setSelected(null);
    refreshAgent();
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  };

  // Normalize/iframe demos
  async function onPickDemo(item) {
    try {
      const r = await fetch(`${apiBase}/render-video-iframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: item.url }),
      });
      const j = await r.json();
      const embed = j?.video_url || item.url;
      setSelected({ ...item, url: embed });
    } catch {
      setSelected(item);
    }
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  }

  // Tabs list (from bot flags)
  const tabs = useMemo(() => {
    const out = [];
    if (tabsEnabled.demos) out.push({ key: "demos", label: "Browse Demos", onClick: openBrowse });
    if (tabsEnabled.docs) out.push({ key: "docs", label: "Browse Documents", onClick: openBrowseDocs });
    if (tabsEnabled.price) out.push({ key: "price", label: "Price Estimate", onClick: openPrice });
    if (tabsEnabled.meeting) out.push({ key: "meeting", label: "Schedule Meeting", onClick: openMeeting });
    return out;
  }, [tabsEnabled]);

  // Banner title
  const bannerTitle = selected?.title || titleFor(mode, selected);

  // Price handlers
  function onPickPriceOption(q, opt) {
    if (!q) return;
    if (q.type === "multi_choice") toggleMulti(q.q_key, opt.key);
    else setAnswer(q.q_key, opt.key);
  }
  const nextQAugmented = nextQuestion ? { ...nextQuestion, _value: answers[nextQuestion.q_key] } : null;

  // Early exits
  if (fatal) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-red-600 font-semibold">{fatal}</div>
      </div>
    );
  }
  if (!botId) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-[var(--page-bg)] p-4" style={DEFAULT_THEME_VARS}>
        <div className="text-gray-800 text-center space-y-2">
          <div className="text-lg font-semibold">Resolving bot…</div>
        </div>
      </div>
    );
  }

  const logoSrc = brandAssets.logo_url || brandAssets.logo_light_url || brandAssets.logo_dark_url || fallbackLogo;

  return (
    <div
      className={classNames(
        "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200"
      )}
      style={themeVars}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] bg-[var(--card-bg)] border border-[var(--card-border)] md:rounded-[var(--radius-card)] [box-shadow:var(--shadow-card)] flex flex-col overflow-hidden">
        {/* Banner */}
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] relative pb-10">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="Brand logo" className="h-10 object-contain" />
            </div>
            <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">{bannerTitle}</div>
          </div>
          <div className="absolute left-0 right-0 bottom-0">
            <TabsNav mode={mode} tabs={tabs} />
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
          {mode === "ask" && !selected && (
            <AskView
              welcomeMessage={welcomeMessage}
              showIntroVideo={showIntroVideo}
              introVideoUrl={introVideoUrl}
              lastQuestion={lastQuestion}
              loading={askLoading}
              responseText={responseText}
              recommendations={recommendations}
              onPick={(it) => onPickDemo(it)}
            />
          )}

          {mode === "ask" && selected && <ViewDemo title={selected.title} url={selected.url} />}

          {mode === "browse" && !selected && (
            <BrowseDemos items={demoItems} loading={demosLoading} error={demosError} onPick={(it) => onPickDemo(it)} />
          )}
          {mode === "browse" && selected && <ViewDemo title={selected.title} url={selected.url} />}

          {mode === "docs" && !selected && (
            <BrowseDocs
              items={docItems}
              loading={docsLoading}
              error={docsError}
              onPick={(it) => {
                setSelected(it);
                requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
              }}
            />
          )}
          {mode === "docs" && selected && <ViewDoc title={selected.title} url={selected.url} />}

          {mode === "price" && (
            <PriceEstimate
              mirrorLines={mirrorLines}
              uiCopy={uiCopy}
              nextQuestion={nextQAugmented}
              estimate={estimate}
              estimating={estimating}
              errorQuestions={errorQuestions || (loadingQuestions ? "Loading questions…" : "")}
              errorEstimate={errorEstimate}
              onPickOption={onPickPriceOption}
            />
          )}

          {mode === "meeting" && (
            <ScheduleMeeting agent={agent} loading={agentLoading} error={agentError} onRefresh={refreshAgent} />
          )}
        </div>

        {/* Ask Bar — always visible */}
        <div className="px-4 py-3 border-t border-gray-200 relative z-10 bg-[var(--card-bg)]">
          <div className="relative w-full">
            <textarea
              ref={inputRef}
              rows={1}
              className="w-full border border-[var(--field-border)] rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--field-bg)]"
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
                  send();
                }
              }}
            />
            <button aria-label="Send" onClick={() => send()} className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95">
              <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:text-[var(--send-color-hover)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
