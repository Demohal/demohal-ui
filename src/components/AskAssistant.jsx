// src/components/AskAssistant.jsx
// Orchestrator using Shared/AppShell + modular hooks/screens.
// Logo comes from the bot record; colors/tokens from /brand.

import React, { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./shared/AppShell";
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

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com";

  // URL params
  const { aliasFromUrl, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      aliasFromUrl: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
    };
  }, []);

  // Bot settings (tabs + welcome + intro video) — includes bot for logo
  const {
    botId,
    fatal,
    tabsEnabled,
    welcomeMessage,
    introVideoUrl,
    showIntroVideo,
    titleFor,
    bot,
  } = useBotState({
    apiBase,
    initialBotId: botIdFromUrl,
    initialAlias: aliasFromUrl,
    defaultAlias: (import.meta.env.VITE_DEFAULT_ALIAS || "demo").trim(),
  });

  // Brand tokens (colors only)
  const { themeVars } = useBrandTokens({
    apiBase,
    botId,
    fallback: DEFAULT_THEME_VARS,
  });

  // Mode & selection
  const [mode, setMode] = useState("ask"); // ask | browse | docs | price | meeting
  const [selected, setSelected] = useState(null);

  // Ask
  const { input, setInput, lastQuestion, responseText, recommendations, loading: askLoading, send } = useAsk({
    apiBase,
    botId,
  });

  // Lists
  const { items: demoItems, loading: demosLoading, error: demosError, load: loadDemos } = useDemos({
    apiBase,
    botId,
    autoLoad: false,
  });
  const { items: docItems, loading: docsLoading, error: docsError, load: loadDocs } = useDocs({
    apiBase,
    botId,
    autoLoad: false,
  });

  // Meeting
  const { agent, loading: agentLoading, error: agentError, refresh: refreshAgent } = useAgent({ apiBase, botId });

  // Pricing
  const {
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
    nextQuestion,
    mirrorLines,
  } = usePricing({ apiBase, botId, autoCompute: true });

  // UI refs
  const contentRef = useRef(null);
  const inputRef = useRef(null);

  // Autosize ask textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Tab handlers
  const openAsk = () => {
    setMode("ask");
    setSelected(null);
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  };
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

  // Tabs for AppShell (Ask is not a tab; ask bar is global)
  const tabs = useMemo(() => {
    const out = [];
    if (tabsEnabled.demos) out.push({ key: "demos", label: "Browse Demos", active: mode === "browse", onClick: openBrowse });
    if (tabsEnabled.docs) out.push({ key: "docs", label: "Browse Documents", active: mode === "docs", onClick: openBrowseDocs });
    if (tabsEnabled.price) out.push({ key: "price", label: "Price Estimate", active: mode === "price", onClick: openPrice });
    if (tabsEnabled.meeting) out.push({ key: "meeting", label: "Schedule Meeting", active: mode === "meeting", onClick: openMeeting });
    return out;
  }, [tabsEnabled, mode]);

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
      <div className="w-screen min-h-[100dvh] flex items-center justify-center" style={DEFAULT_THEME_VARS}>
        <div className="text-gray-800 text-center space-y-2">
          <div className="text-lg font-semibold">Resolving bot…</div>
        </div>
      </div>
    );
  }

  // Logo from bot; fallback to local asset
  const logoUrl = bot?.logo_url || bot?.logo_light_url || bot?.logo_dark_url || fallbackLogo;

  return (
    <AppShell
      title={bannerTitle}
      logoUrl={logoUrl}
      tabs={tabs}
      askValue={input}
      askPlaceholder="Ask your question here"
      onAskChange={(v) => {
        setInput(v);
        const el = inputRef.current;
        if (el) {
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }
      }}
      onAskSend={(text) => {
        // Always route asks through Ask mode
        setMode("ask");
        setSelected(null);
        send(text);
      }}
      themeVars={themeVars}
      askInputRef={inputRef}
      askSendIcon={<ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:text-[var(--send-color-hover)]" />}
    >
      <div ref={contentRef} className="flex-1 flex flex-col space-y-4">
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
    </AppShell>
  );
}
