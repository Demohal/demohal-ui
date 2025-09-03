// Updated AskAssistant.jsx with working live branding logic

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AppShell from "./shared/AppShell";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

import useBotState from "../hooks/useBotState";
import useAsk from "../hooks/useAsk";
import usePricing from "../hooks/usePricing";
import useDemos from "../hooks/useDemos";
import useDocs from "../hooks/useDocs";
import useAgent from "../hooks/useAgent";

import AskView from "./screens/AskView";
import BrowseDemos from "./screens/BrowseDemos";
import ViewDemo from "./screens/ViewDemo";
import BrowseDocs from "./screens/BrowseDocs";
import ViewDoc from "./screens/ViewDoc";
import PriceEstimate from "./screens/PriceEstimate";
import ScheduleMeeting from "./screens/ScheduleMeeting";

import fallbackLogo from "../assets/logo.png";

const DEFAULT_THEME_VARS = {
  "--banner-bg": "#0b1015",
  "--banner-fg": "#ffffff",
  "--page-bg": "#EFF2F5",
  "--card-bg": "#FFFFFF",
  "--card-border": "#E5E7EB",
  "--radius-card": "1rem",
  "--shadow-card":
    "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",
  "--field-bg": "#FFFFFF",
  "--field-border": "#9CA3AF",
  "--send-color": "#EA4335",
  "--send-color-hover": "#C03327",
};

export default function AskAssistant() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com";

  const { aliasFromUrl, botIdFromUrl } = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      aliasFromUrl: (search.get("alias") || search.get("alais") || "").trim(),
      botIdFromUrl: (search.get("bot_id") || "").trim(),
    };
  }, []);

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

  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const [brandDraft, setBrandDraft] = useState({ dirty: false, vars: {} });

  // Update CSS var both in state and draft
  const updateCssVar = useCallback((name, value) => {
    setThemeVars((prev) => ({ ...prev, [name]: value }));
    setBrandDraft((prev) => ({
      ...prev,
      dirty: true,
      vars: { ...prev.vars, [name]: value },
    }));
  }, []);

  const publishDraft = useCallback(() => {
    if (!brandDraft.dirty) return;
    // TODO: POST to /brand/update-tokens
    setBrandDraft({ dirty: false, vars: {} });
  }, [brandDraft]);

  const discardDraft = useCallback(() => {
    if (!brandDraft.dirty) return;
    setThemeVars((prev) => ({ ...prev, ...DEFAULT_THEME_VARS }));
    setBrandDraft({ dirty: false, vars: {} });
  }, [brandDraft]);

  const {
    input,
    setInput,
    lastQuestion,
    responseText,
    recommendations,
    loading: askLoading,
    send,
  } = useAsk({ apiBase, botId });

  const {
    items: demoItems,
    loading: demosLoading,
    error: demosError,
    load: loadDemos,
  } = useDemos({ apiBase, botId, autoLoad: false });

  const {
    items: docItems,
    loading: docsLoading,
    error: docsError,
    load: loadDocs,
  } = useDocs({ apiBase, botId, autoLoad: false });

  const {
    agent,
    loading: agentLoading,
    error: agentError,
    refresh: refreshAgent,
  } = useAgent({ apiBase, botId });

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

  const contentRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const openAsk = () => {
    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  };

  const bannerTitle = titleFor("ask", null);

  const logoUrl =
    bot?.logo_url || bot?.logo_light_url || bot?.logo_dark_url || fallbackLogo;

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
        className="w-screen min-h-[100dvh] flex items-center justify-center"
        style={themeVars}
      >
        <div className="text-gray-800 text-center space-y-2">
          <div className="text-lg font-semibold">Resolving bot…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={themeVars} className="w-screen h-[100dvh]">
      <AppShell
        title={bannerTitle}
        logoUrl={logoUrl}
        tabs={[]}
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
          send(text);
        }}
        themeVars={themeVars}
        askInputRef={inputRef}
        askSendIcon={
          <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:text-[var(--send-color-hover)]" />
        }
      >
        <div ref={contentRef} className="flex-1 flex flex-col space-y-4">
          <AskView
            welcomeMessage={welcomeMessage}
            showIntroVideo={showIntroVideo}
            introVideoUrl={introVideoUrl}
            lastQuestion={lastQuestion}
            loading={askLoading}
            responseText={responseText}
            recommendations={recommendations}
            onPick={() => {}}
          />
        </div>

        {/* Example color pickers for demo */}
        <div className="p-4 border-t">
          <label className="block text-sm">Banner BG</label>
          <input
            type="color"
            value={themeVars["--banner-bg"]}
            onChange={(e) => updateCssVar("--banner-bg", e.target.value)}
          />
        </div>
      </AppShell>
    </div>
  );
}
