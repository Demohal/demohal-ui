// src/components/AskAssistant.jsx
// Orchestrator using Shared/AppShell + modular hooks/screens.
// Includes:
//  - Preview bridge via usePreviewBridge (/?preview=1)
//  - Visitor Capture (one-time Name/Email gate; DB-driven optional fields)
//  - ThemeLab preview (/?themelab)

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import AppShell from "./shared/AppShell";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

import usePreviewBridge from "../hooks/usePreviewBridge";

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

// NOTE: Do NOT statically import ThemeLab. We lazy-load it below with `@vite-ignore`
// so builds succeed even if src/components/ThemeLab.jsx is not present.

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
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com";

  // URL params
  const { aliasFromUrl, botIdFromUrl, previewEnabled, themelabEnabled } =
    useMemo(() => {
      const qs = new URLSearchParams(window.location.search);
      const hasThemeLab = qs.has("themelab");
      const v = (qs.get("themelab") || "").trim().toLowerCase();
      const themeFlag =
        hasThemeLab && (v === "" || v === "1" || v === "true");
      return {
        aliasFromUrl: (qs.get("alias") || qs.get("alais") || "").trim(),
        botIdFromUrl: (qs.get("bot_id") || "").trim(),
        previewEnabled: qs.get("preview") === "1",
        themelabEnabled: themeFlag,
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

  // ---------------- Visitor Capture (config/state) ----------------
  const [vcConfig, setVcConfig] = useState({
    show_flag: false,
    message: "",
    skip_param: "dh_skip_capture",
  });
  const [vcFields, setVcFields] = useState([]);
  const [vcLoaded, setVcLoaded] = useState(false);
  const [vcOpen, setVcOpen] = useState(false);
  const [vcSubmitting, setVcSubmitting] = useState(false);
  const [vcErr, setVcErr] = useState("");
  const [vcName, setVcName] = useState("");
  const [vcEmail, setVcEmail] = useState("");
  const [vcExtras, setVcExtras] = useState({});
  const [deferredAction, setDeferredAction] = useState(null);

  // ---------------- Mode & selections ----------------
  const [mode, setMode] = useState("ask"); // ask | browse | docs | price | meeting
  const [selected, setSelected] = useState(null);

  // Ask
  const {
    input,
    setInput,
    lastQuestion,
    responseText,
    recommendations,
    loading: askLoading,
    send,
  } = useAsk({
    apiBase,
    botId,
  });

  // Lists
  const {
    items: demoItems,
    loading: demosLoading,
    error: demosError,
    load: loadDemos,
  } = useDemos({
    apiBase,
    botId,
    autoLoad: false,
  });
  const {
    items: docItems,
    loading: docsLoading,
    error: docsError,
    load: loadDocs,
  } = useDocs({
    apiBase,
    botId,
    autoLoad: false,
  });

  // Snapshot the latest lists for preview navigation
  const demoItemsRef = useRef([]);
  const docItemsRef = useRef([]);
  useEffect(() => {
    demoItemsRef.current = demoItems || [];
  }, [demoItems]);
  useEffect(() => {
    docItemsRef.current = docItems || [];
  }, [docItems]);

  // Meeting
  const {
    agent,
    loading: agentLoading,
    error: agentError,
    refresh: refreshAgent,
  } = useAgent({ apiBase, botId });

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

  // ---- Visitor Capture: load config + UTM skip ----
  const vcKey = useMemo(
    () => (botId ? `vc::${botId}::done` : ""),
    [botId]
  );

  useEffect(() => {
    let stop = false;
    async function loadVC() {
      if (!botId) return;
      try {
        const url = new URL(`${apiBase}/visitor-capture/config`);
        url.searchParams.set("bot_id", botId);
        const r = await fetch(url.toString());
        const j = await r.json();
        const cfg = j?.config || {};
        const fields = Array.isArray(j?.fields) ? j.fields : [];

        if (stop) return;
        setVcConfig({
          show_flag: !!cfg.show_flag,
          message: cfg.message || "",
          skip_param: (cfg.skip_param || "dh_skip_capture").trim(),
        });
        setVcFields(fields);

        // UTM skip
        const qs = new URLSearchParams(window.location.search);
        const hasSkip =
          (cfg.skip_param || "dh_skip_capture") &&
          (qs.get(cfg.skip_param) || "").toLowerCase() === "1";
        if (hasSkip && vcKey) localStorage.setItem(vcKey, "1");
      } catch {
        // ignore
      } finally {
        if (!stop) setVcLoaded(true);
      }
    }
    loadVC();
    return () => {
      stop = true;
    };
  }, [apiBase, botId, vcKey]);

  const vcCompleted = useMemo(
    () => (vcKey ? localStorage.getItem(vcKey) === "1" : true),
    [vcKey]
  );
  const gatingActive = useMemo(
    () => vcLoaded && vcConfig.show_flag && !vcCompleted,
    [vcLoaded, vcConfig.show_flag, vcCompleted]
  );

  const validEmail = (s) => {
    const str = String(s || "").trim();
    return str.includes("@") && str.split("@")[1]?.includes(".");
  };

  const openVC = useCallback((after) => {
    setDeferredAction(() => (typeof after === "function" ? after : null));
    setVcOpen(true);
    setVcErr("");
  }, []);
  const finishVC = useCallback(() => {
    if (vcKey) localStorage.setItem(vcKey, "1");
    setVcOpen(false);
    const run = deferredAction;
    setDeferredAction(null);
    if (typeof run === "function") run();
  }, [deferredAction, vcKey]);

  const submitVC = useCallback(async () => {
    setVcErr("");
    const name = (vcName || "").trim();
    const email = (vcEmail || "").trim();
    if (!name) return setVcErr("Please enter your name.");
    if (!validEmail(email)) return setVcErr("Please enter a valid email address.");
    setVcSubmitting(true);
    try {
      const sidKey = botId ? `sid::${botId}` : "sid::generic";
      let session_id = sessionStorage.getItem(sidKey);
      if (!session_id && window.crypto && crypto.randomUUID) {
        session_id = crypto.randomUUID();
        sessionStorage.setItem(sidKey, session_id);
      }
      const body = {
        bot_id: botId,
        session_id,
        name,
        email,
        extras: vcExtras,
        landing_path: window.location.pathname + window.location.search,
      };
      const r = await fetch(`${apiBase}/visitor-capture/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Failed to save");
      finishVC();
    } catch (e) {
      setVcErr(e.message || "Something went wrong. Please try again.");
    } finally {
      setVcSubmitting(false);
    }
  }, [apiBase, botId, vcName, vcEmail, vcExtras, finishVC]);

  const requireCaptureOr = useCallback(
    (fn) => {
      if (gatingActive) openVC(fn);
      else fn();
    },
    [gatingActive, openVC]
  );

  // ---------------- Tab handlers (intercepted) ----------------
  const openAsk = () => {
    setMode("ask");
    setSelected(null);
    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  };
  const openBrowse = () => {
    setMode("browse");
    setSelected null;
    loadDemos();
    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  };
  const openBrowseDocs = () => {
    setMode("docs");
    setSelected(null);
    loadDocs();
    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  };
  const openPrice = () => {
    setMode("price");
    setSelected(null);
    loadQuestions();
    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  };
  const openMeeting = () => {
    setMode("meeting");
    setSelected(null);
    refreshAgent();
    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  };

  // Banner title
  const bannerTitle = selected?.title || titleFor(mode, selected);

  // Price handlers
  function onPickPriceOption(q, opt) {
    if (!q) return;
    if (q.type === "multi_choice") toggleMulti(q.q_key, opt.key);
    else setAnswer(q.q_key, opt.key);
  }
  const nextQAugmented = nextQuestion
    ? { ...nextQuestion, _value: answers[nextQuestion.q_key] }
    : null;

  // --- Preview navigation callback (consumed by usePreviewBridge) ---
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
        openPrice();
        break;
      case "meeting":
        openMeeting();
        break;
      default:
        break;
    }
  }, []);

  // Hook: preview message bridge (replaces inline listener)
  const { previewVars } = usePreviewBridge({
    enabled: previewEnabled,
    onGo: goTo,
  });

  // Tabs for AppShell (Ask is not a tab; ask bar is global)
  const tabs = useMemo(() => {
    const out = [];
    if (tabsEnabled.demos)
      out.push({
        key: "demos",
        label: "Browse Demos",
        active: mode === "browse",
        onClick: () => requireCaptureOr(openBrowse),
      });
    if (tabsEnabled.docs)
      out.push({
        key: "docs",
        label: "Browse Documents",
        active: mode === "docs",
        onClick: () => requireCaptureOr(openBrowseDocs),
      });
    if (tabsEnabled.price)
      out.push({
        key: "price",
        label: "Price Estimate",
        active: mode === "price",
        onClick: () => requireCaptureOr(openPrice),
      });
    if (tabsEnabled.meeting)
      out.push({
        key: "meeting",
        label: "Schedule Meeting",
        active: mode === "meeting",
        onClick: () => requireCaptureOr(openMeeting),
      });
    return out;
  }, [tabsEnabled, mode, requireCaptureOr]);

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
    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  }

  // ------------- ThemeLab override (render ASAP; lazy import with @vite-ignore) -------------
  if (themelabEnabled) {
    const ThemeLabLazy = useMemo(
      () =>
        lazy(() => {
          const path = "./ThemeLab"; // kept separate so Vite won't resolve statically
          // @ts-ignore
          return import(/* @vite-ignore */ path)
            .then((m) => ({ default: m.default || m }))
            .catch(() => ({
              default: () => (
                <div className="p-4 text-sm text-gray-700">
                  ThemeLab isn’t installed in this build. Remove{" "}
                  <code>?themelab</code> or add{" "}
                  <code>src/components/ThemeLab.jsx</code>.
                </div>
              ),
            }));
        }),
      []
    );
    const resolvedBotId = botId || bot?.id || botIdFromUrl || "";
    return (
      <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading ThemeLab…</div>}>
        <ThemeLabLazy
          botId={resolvedBotId}
          apiBase={apiBase}
          themeVars={{ ...themeVars, ...previewVars }}
        />
      </Suspense>
    );
  }

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
      <div
        className="w-screen min-h-[100dvh] flex items-center justify-center"
        style={DEFAULT_THEME_VARS}
      >
        <div className="text-gray-800 text-center space-y-2">
          <div className="text-lg font-semibold">Resolving bot…</div>
        </div>
      </div>
    );
  }

  // Logo from bot; fallback to local asset
  const logoUrl =
    bot?.logo_url || bot?.logo_light_url || bot?.logo_dark_url || fallbackLogo;

  return (
    <>
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
        onAskSend={(text) =>
          requireCaptureOr(() => {
            setMode("ask");
            setSelected(null);
            send(text);
          })
        }
        // Merge live theme with preview overlay (overlay wins)
        themeVars={{ ...themeVars, ...previewVars }}
        askInputRef={inputRef}
        askSendIcon={
          <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:text-[var(--send-color-hover)]" />
        }
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

          {mode === "ask" && selected && (
            <ViewDemo title={selected.title} url={selected.url} />
          )}

          {mode === "browse" && !selected && (
            <BrowseDemos
              items={demoItems}
              loading={demosLoading}
              error={demosError}
              onPick={(it) => onPickDemo(it)}
            />
          )}
          {mode === "browse" && selected && (
            <ViewDemo title={selected.title} url={selected.url} />
          )}

          {mode === "docs" && !selected && (
            <BrowseDocs
              items={docItems}
              loading={docsLoading}
              error={docsError}
              onPick={(it) => {
                setSelected(it);
                requestAnimationFrame(() =>
                  contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
                );
              }}
            />
          )}
          {mode === "docs" && selected && (
            <ViewDoc title={selected.title} url={selected.url} />
          )}

          {mode === "price" && (
            <PriceEstimate
              mirrorLines={mirrorLines}
              uiCopy={uiCopy}
              nextQuestion={nextQAugmented}
              estimate={estimate}
              estimating={estimating}
              errorQuestions={
                errorQuestions || (loadingQuestions ? "Loading questions…" : "")
              }
              errorEstimate={errorEstimate}
              onPickOption={onPickPriceOption}
            />
          )}

          {mode === "meeting" && (
            <ScheduleMeeting
              agent={agent}
              loading={agentLoading}
              error={agentError}
              onRefresh={refreshAgent}
            />
          )}
        </div>
      </AppShell>

      {/* -------------------- Visitor Capture Modal -------------------- */}
      {vcOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="w-[92vw] max-w-xl rounded-2xl bg-white shadow-xl border border-gray-200">
            <div className="p-5 border-b border-gray-200">
              <div className="text-xl font-semibold text-gray-900">
                Before we get started
              </div>
              <div className="mt-1 text-sm text-gray-700">
                {vcConfig.message ||
                  "Tell us a little about yourself so we can better answer your questions."}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Name
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-gray-300"
                  value={vcName}
                  onChange={(e) => setVcName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Email
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-gray-300"
                  value={vcEmail}
                  onChange={(e) => setVcEmail(e.target.value)}
                  placeholder="jane@company.com"
                />
              </div>

              {/* Optional fields (DB-driven) */}
              {vcFields?.length ? (
                <div className="pt-2 space-y-4">
                  {vcFields.map((f) => {
                    const key = f.field_key || f.key;
                    const type = (f.input_type || "text").toLowerCase();
                    const val = vcExtras[key] ?? "";
                    const onChange = (v) =>
                      setVcExtras((prev) => ({ ...prev, [key]: v }));
                    if (type === "select") {
                      const opts = Array.isArray(f.options)
                        ? f.options
                        : Array.isArray(f.options?.items)
                        ? f.options.items
                        : [];
                      return (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-900">
                            {f.label || key}
                          </label>
                          <select
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                            value={String(val)}
                            onChange={(e) => onChange(e.target.value)}
                          >
                            <option value="">
                              {f.placeholder || "Select…"}
                            </option>
                            {opts.map((o, idx) => (
                              <option
                                key={idx}
                                value={o.value ?? o.key ?? o.id ?? o}
                              >
                                {o.label ?? o.name ?? String(o)}
                              </option>
                            ))}
                          </select>
                          {f.help_text ? (
                            <div className="mt-1 text-xs text-gray-600">
                              {f.help_text}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                    if (type === "textarea") {
                      return (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-900">
                            {f.label || key}
                          </label>
                          <textarea
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                            rows={3}
                            value={String(val)}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={f.placeholder || ""}
                          />
                          {f.help_text ? (
                            <div className="mt-1 text-xs text-gray-600">
                              {f.help_text}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                    if (type === "checkbox") {
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!val}
                            onChange={(e) => onChange(e.target.checked)}
                            className="h-4 w-4"
                          />
                          <label className="text-sm text-gray-900">
                            {f.label || key}
                          </label>
                        </div>
                      );
                    }
                    if (type === "radio") {
                      const opts = Array.isArray(f.options)
                        ? f.options
                        : Array.isArray(f.options?.items)
                        ? f.options.items
                        : [];
                      return (
                        <div key={key}>
                          <div className="block text-sm font-medium text-gray-900">
                            {f.label || key}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3">
                            {opts.map((o, idx) => {
                              const v =
                                o.value ?? o.key ?? o.id ?? o;
                              const l =
                                o.label ?? o.name ?? String(o);
                              return (
                                <label
                                  key={idx}
                                  className="inline-flex items-center gap-2 text-sm text-gray-900"
                                >
                                  <input
                                    type="radio"
                                    name={`vc-${key}`}
                                    checked={String(val) === String(v)}
                                    onChange={() => onChange(v)}
                                  />
                                  {l}
                                </label>
                              );
                            })}
                          </div>
                          {f.help_text ? (
                            <div className="mt-1 text-xs text-gray-600">
                              {f.help_text}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                    // default: text/email/number/tel/url
                    return (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-900">
                          {f.label || key}
                        </label>
                        <input
                          type={
                            ["email", "number", "tel", "url"].includes(type)
                              ? type
                              : "text"
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                          value={String(val)}
                          onChange={(e) => onChange(e.target.value)}
                          placeholder={f.placeholder || ""}
                        />
                        {f.help_text ? (
                          <div className="mt-1 text-xs text-gray-600">
                            {f.help_text}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {vcErr ? (
                <div className="text-sm text-red-600">{vcErr}</div>
              ) : null}
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={submitVC}
                disabled={vcSubmitting}
                className="inline-flex items-center justify-center rounded-md bg.black px-4 py-2 text-white text-sm hover:opacity-90 disabled:opacity-50 bg-black"
              >
                {vcSubmitting ? "Saving…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ------------------ End Visitor Capture Modal ------------------ */}
    </>
  );
}

/*
REV: 2025-09-02 T13:55 EDT
- ThemeLab: lazy import with /* @vite-ignore *\/ to prevent build-time resolution
- Accept ?themelab, ?themelab=1, ?themelab=true
- Render ThemeLab before guards; graceful fallback UI if file absent
*/
