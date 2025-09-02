// src/components/AskAssistant.jsx
// Orchestrator using Shared/AppShell + modular hooks/screens.
// Adds a minimal, self-contained ThemeLab editor at ?themelab=1
// and a live preview bridge at ?preview=1 (same-origin postMessage).

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

/* --------------------------- ThemeLab (inline) --------------------------- */
// Lightweight editor mounted when URL has ?themelab=1
function ThemeLab({ apiBase }) {
  const qs = new URLSearchParams(window.location.search);
  const alias = (qs.get("alias") || "").trim();
  const botIdFromUrl = (qs.get("bot_id") || "").trim();

  const snakeToKebab = (s) => String(s || "").trim().replace(/_/g, "-");
  const tokenKeyToCssVar = (k) => `--${snakeToKebab(k)}`;

  const [botId, setBotId] = useState(botIdFromUrl);
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]); // rows from brand_tokens_v2
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const iframeRef = useRef(null);

  // Resolve bot id by alias if needed
  useEffect(() => {
    if (botId || !alias) return;
    let stop = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (!stop && data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch {}
    })();
    return () => {
      stop = true;
    };
  }, [alias, botId, apiBase]);

  // Load brand tokens (client-controlled)
  useEffect(() => {
    if (!botId) return;
    let stop = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        // try /brand/tokens then /brand
        const urls = [
          `${apiBase}/brand/tokens?bot_id=${encodeURIComponent(botId)}`,
          `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`
        ];
        let rows = [];
        for (const url of urls) {
          try {
            const r = await fetch(url);
            const j = await r.json();
            const items = j?.items || j?.tokens || j?.rows || [];
            if (Array.isArray(items) && items.length) {
              rows = items;
              break;
            }
          } catch {}
        }
        if (stop) return;
        const filtered = rows.filter((r) => r.client_controlled !== false);
        setTokens(filtered);
        setDraft({});
        // Push current server values into preview on load
        const vars = {};
        for (const t of filtered) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
        iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
      } catch (e) {
        if (!stop) setError("Unable to load tokens.");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [botId, apiBase]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const t of tokens) {
      const g = t.group_key || t.group_label || t.screen_key || "General";
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(t);
    }
    return Array.from(m.entries());
  }, [tokens]);

  const onChangeToken = (t, value) => {
    const key = t.token_key || t.key;
    const cssVar = tokenKeyToCssVar(key);
    setDraft((prev) => ({ ...prev, [key]: value }));
    // live preview
    iframeRef.current?.contentWindow?.postMessage(
      { type: "preview:theme", payload: { vars: { [cssVar]: value } } },
      window.location.origin
    );
    // jump to relevant screen if provided
    const screen = t.screen_key || t.screen;
    if (screen) {
      iframeRef.current?.contentWindow?.postMessage({ type: "preview:go", payload: { screen } }, window.location.origin);
    }
  };

  const onSave = async () => {
    if (!botId || !Object.keys(draft).length) return;
    setSaving(true);
    setError("");
    try {
      const body = { bot_id: botId, tokens: draft, commit_key: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) };
      const res = await fetch(`${apiBase}/brand/update-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Save failed");
      setDraft({});
      iframeRef.current?.contentWindow?.postMessage({ type: "preview:reload" }, window.location.origin);
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    setDraft({});
    const vars = {};
    for (const t of tokens) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
    iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
  };

  const previewSrc = useMemo(() => {
    const q = new URLSearchParams();
    if (alias) q.set("alias", alias);
    if (botId) q.set("bot_id", botId);
    q.set("preview", "1");
    return `${window.location.origin}/?${q.toString()}`;
  }, [alias, botId]);

  return (
    <div className="w-screen h-[100dvh] grid grid-cols-1 md:grid-cols-[300px_1fr]">
      {/* Left control */}
      <div className="border-r border-gray-200 p-4 overflow-y-auto bg-white">
        <div className="text-sm font-semibold mb-2">Theme Editor</div>
        <div className="text-xs text-gray-500 mb-4">
          {botId ? <>bot_id <code>{botId}</code></> : alias ? <>alias <code>{alias}</code> (resolving…)</> : "Provide alias or bot_id in the URL."}
        </div>

        {loading ? <div className="text-xs text-gray-500 mb-4">Loading tokens…</div> : null}
        {error ? <div className="text-xs text-red-600 mb-4">{error}</div> : null}

        {grouped.map(([grp, rows]) => (
          <div key={grp} className="mb-6">
            <div className="text-[0.8rem] font-bold mb-2">{grp}</div>
            <div className="space-y-2">
              {rows.map((t) => {
                const key = t.token_key || t.key;
                const type = (t.input_type || t.token_type || "color").toLowerCase();
                const val = draft[key] ?? t.value ?? "";
                const label = t.label || key;
                const screenKey = t.screen_key || t.screen || null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
                    onClick={() => {
                      if (screenKey) {
                        iframeRef.current?.contentWindow?.postMessage(
                          { type: "preview:go", payload: { screen: screenKey } },
                          window.location.origin
                        );
                      }
                    }}
                  >
                    <div className="text-[0.8rem]">
                      <div className="font-medium">{label}</div>
                      {t.description ? <div className="text-[0.7rem] text-gray-500">{t.description}</div> : null}
                    </div>
                    {type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={String(val) === "1" || String(val).toLowerCase() === "true"}
                        onChange={(e) => onChangeToken(t, e.target.checked ? "1" : "0")}
                      />
                    ) : type === "length" || type === "number" ? (
                      <input
                        type="text"
                        className="w-28 border rounded px-2 py-1 text-sm"
                        value={val}
                        onChange={(e) => onChangeToken(t, e.target.value)}
                        placeholder={type === "length" ? "0.75rem" : "number"}
                      />
                    ) : (
                      <input
                        type="color"
                        className="w-12 h-8 border rounded cursor-pointer"
                        value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val) ? val : "#ffffff"}
                        onChange={(e) => onChangeToken(t, e.target.value)}
                        title={val}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer actions */}
        <div className="sticky bottom-0 pt-3 bg-white border-t border-gray-200 mt-6">
          <button
            className="w-full mb-2 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm"
            onClick={onDiscard}
            disabled={saving || !Object.keys(draft).length}
          >
            Discard
          </button>
          <button
            className="w-full py-2 rounded bg-black text-white hover:opacity-90 text-sm disabled:opacity-50"
            onClick={onSave}
            disabled={saving || !Object.keys(draft).length}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Right live preview */}
      <div className="bg-gray-50">
        <iframe ref={iframeRef} title="Preview" src={previewSrc} className="w-full h-full border-0" />
      </div>
    </div>
  );
}
/* ------------------------ End ThemeLab (inline) ------------------------- */

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
  const { aliasFromUrl, botIdFromUrl, previewEnabled, themeLabEnabled } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      aliasFromUrl: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
      previewEnabled: qs.get("preview") === "1",
      themeLabEnabled: qs.get("themelab") === "1",
    };
  }, []);

  // If ThemeLab requested, render it and exit.
  if (themeLabEnabled) {
    return <ThemeLab apiBase={apiBase} />;
  }

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

  // Preview CSS var overlay (only applied when ?preview=1)
  const [previewVars, setPreviewVars] = useState({});

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

  // Snapshot the latest lists for preview navigation
  const demoItemsRef = useRef([]);
  const docItemsRef = useRef([]);
  useEffect(() => { demoItemsRef.current = demoItems || []; }, [demoItems]);
  useEffect(() => { docItemsRef.current = docItems || []; }, [docItems]);

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

  // --- Preview bridge (minimal) ---
  const goTo = useCallback(async (screen) => {
    switch (String(screen || "")) {
      case "intro":
        setSelected(null);
        setMode("ask");
        break;
      case "ask":
        openAsk();
        break;
      case "browse":
        openBrowse();
        break;
      case "view_demo":
        openBrowse();
        setTimeout(() => setSelected(demoItemsRef.current[0] || null), 0);
        break;
      case "docs":
        openBrowseDocs();
        break;
      case "view_doc":
        openBrowseDocs();
        setTimeout(() => setSelected(docItemsRef.current[0] || null), 0);
        break;
      case "price_questions":
        openPrice();
        break;
      case "price_results":
        openPrice(); // auto-shows results when answers complete
        break;
      case "meeting":
        openMeeting();
        break;
      default:
        break;
    }
  }, []); // open* are stable enough for preview

  useEffect(() => {
    if (!previewEnabled) return;
    function onMsg(e) {
      if (e.origin !== window.location.origin) return; // same-origin guard
      const { type, payload } = e.data || {};
      if (type === "preview:theme") {
        const vars = (payload && payload.vars) || {};
        setPreviewVars((prev) => ({ ...prev, ...vars }));
      } else if (type === "preview:go") {
        if (payload && payload.screen) goTo(payload.screen);
      } else if (type === "preview:reload") {
        window.location.reload();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [previewEnabled, goTo]);

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
        setMode("ask");
        setSelected(null);
        send(text);
      }}
      // Merge live theme with preview overlay (overlay wins)
      themeVars={{ ...themeVars, ...previewVars }}
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
