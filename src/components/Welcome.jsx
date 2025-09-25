/* ================================================================================= *
 *  BEGIN SECTION 1                                                                  *
 * ================================================================================= */

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import fallbackLogo from "../assets/logo.png";

/* =============================== *
 *  CLIENT-CONTROLLED CSS TOKENS   *
 * =============================== */

const DEFAULT_THEME_VARS = {
  "--banner-bg": "#000000",
  "--banner-fg": "#ffffff",
  "--page-bg": "#e6e6e6",
  "--card-bg": "#ffffff",
  "--shadow-elevation":
    "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",

  // Text roles
  "--message-fg": "#000000",
  "--helper-fg": "#4b5563",
  "--mirror-fg": "#4b5563",

  // Tabs (inactive)
  "--tab-bg": "#303030",
  "--tab-fg": "#ffffff",
  "--tab-active-fg": "#ffffff", // derived at runtime

  // Buttons (explicit types)
  "--demo-button-bg": "#3a4554",
  "--demo-button-fg": "#ffffff",
  "--doc.button.background": "#000000", // legacy mapping guard (no-op)
  "--doc-button-bg": "#000000",
  "--doc-button-fg": "#ffffff",
  "--price-button-bg": "#1a1a1a",
  "--price-button-fg": "#ffffff",

  // Send icon
  "--send-color": "#000000",

  // Default faint gray border (used only where allowed)
  "--border-default": "#9ca3af",
};

// Map DB token_key → CSS var used in this app (mirror of server mapping)
const TOKEN_TO_CSS = {
  "banner.background": "--banner-bg",
  "banner.foreground": "--banner-fg",
  "page.background": "--page-bg",
  "content.area.background": "--card-bg",

  "message.text.foreground": "--message-fg",
  "helper.text.foreground": "--helper-fg",
  "mirror.text.foreground": "--mirror-fg",

  "tab.background": "--tab-bg",
  "tab.foreground": "--tab-fg",

  "demo.button.background": "--demo-button-bg",
  "demo.button.foreground": "--demo-button-fg",
  "doc.button.background": "--doc-button-bg",
  "doc.button.foreground": "--doc-button-fg",
  "price.button.background": "--price-button-bg",
  "price.button.foreground": "--price-button-fg",

  "send.button.background": "--send-color",

  "border.default": "--border-default",
};

// Hardcoded screen order/labels for grouping the 16 client-controlled tokens
const SCREEN_ORDER = [
  { key: "welcome", label: "Welcome" },
  { key: "bot_response", label: "Bot Response" },
  { key: "browse_demos", label: "Browse Demos" },
  { key: "browse_docs", label: "Browse Documents" },
  { key: "price", label: "Price Estimate" },
];

const classNames = (...xs) => xs.filter(Boolean).join(" ");
function inverseBW(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
    String(hex || "").trim()
  );
  if (!m) return "#000000";
  const r = parseInt(m[1], 16),
    g = parseInt(m[2], 16),
    b = parseInt(m[3], 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.5 ? "#000000" : "#ffffff";
}

/* ========================== *
 *  UI PRIMITIVES
 * ========================== */

const UI = {
  CARD: "rounded-[0.75rem] p-4 bg-white [box-shadow:var(--shadow-elevation)]",
  BTN_DEMO:
    "w-full text-center rounded-[0.75rem] px-4 py-3 transition " +
    "text-[var(--demo-button-fg)] bg-[var(--demo-button-bg)] hover:brightness-110 active:brightness-95",
  BTN_DOC:
    "w-full text-center rounded-[0.75rem] px-4 py-3 transition " +
    "text-[var(--doc-button-fg)] bg-[var(--doc-button-bg)] hover:brightness-110 active:brightness-95",
  BTN_PRICE:
    "w-full text-center rounded-[0.75rem] px-4 py-3 transition " +
    "text-[var(--price-button-fg)] bg-[var(--price-button-bg)] hover:brightness-110 active:brightness-95",
  FIELD:
    "w-full rounded-[0.75rem] px-4 py-3 text-base bg-[var(--card-bg)] " +
    "border border-[var(--border-default)]",
  TAB_ACTIVE:
    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition rounded-t-[0.75rem] " +
    "[box-shadow:var(--shadow-elevation)]",
  TAB_INACTIVE:
    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition rounded-t-[0.75rem] hover:brightness-110",
};



/* ---------- Options normalizer (accepts many backend shapes) ---------- */
function normalizeOptions(q) {
  const raw = q?.options ?? q?.choices ?? q?.buttons ?? q?.values ?? [];

  return (Array.isArray(raw) ? raw : [])
    .map((o, idx) => {
      if (o == null) return null;
      if (typeof o === "string") {
        return { key: o, label: o, id: String(idx) };
      }
      const key = o.key ?? o.value ?? o.id ?? String(idx);
      const label = o.label ?? o.title ?? o.name ?? String(key);
      const tooltip = o.tooltip ?? o.description ?? o.help ?? undefined;
      return { key, label, tooltip, id: String(o.id ?? key ?? idx) };
    })
    .filter(Boolean);
}

function QuestionBlock({ q, value, onPick }) {
  const opts = normalizeOptions(q);
  const type = String(q?.type || "").toLowerCase();
  const isMulti =
    type === "multi_choice" || type === "multichoice" || type === "multi";

  return (
    <div data-patch="question-block" className={UI.FIELD}>
      <div className="font-bold text-base">{q.prompt}</div>
      {q.help_text ? (
        <div className="text-xs italic mt-1 text-[var(--helper-fg)]">
          {q.help_text}
        </div>
      ) : null}

      {opts.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          {opts.map((opt) => (
            <OptionButton
              key={opt.id}
              opt={opt}
              selected={
                isMulti
                  ? Array.isArray(value) && value.includes(opt.key)
                  : value === opt.key
              }
              onClick={() => onPick(q, opt)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-[var(--helper-fg)]">
          No options available.
        </div>
      )}
    </div>
  );
}

function TabsNav({ mode, tabs }) {
  return (
    <div
      className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-patch="tabs-nav"
    >
      <nav
        className="inline-flex min-w-max items-center gap-0.5 overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
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
              className={active ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}
              style={
                active
                  ? { background: "var(--card-bg)", color: "var(--tab-active-fg)" }
                  : { background: "var(--tab-bg)", color: "var(--tab-fg)" }
              }
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ================================================================================= *
 *  END SECTION 1                                                                    *
 * ================================================================================= */

/* ================================================================================= *
 *  BEGIN SECTION 2                                                                  *
 * ================================================================================= */

/* =================== *
 *  MAIN APP COMPONENT *
 * =================== */

export default function Welcome() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL → alias / bot_id / themelab
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

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");

  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);

  const [helperPhase, setHelperPhase] = useState("hidden");
  const [isAnchored, setIsAnchored] = useState(false);

  const contentRef = useRef(null);
  const inputRef = useRef(null);
  const frameRef = useRef(null); // context card container (for ColorBox placement)

  // NEW: visitor/session identity
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Theme vars (DB → in-memory → derived → live with picker overrides)
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);

  // picker overrides (live preview)
  const [pickerVars, setPickerVars] = useState({});
  const liveTheme = useMemo(
    () => ({ ...derivedTheme, ...pickerVars }),
    [derivedTheme, pickerVars]
  );

  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });

  const initialBrandReady = useMemo(
    () => !(botIdFromUrl || alias),
    [botIdFromUrl, alias]
  );
  const [brandReady, setBrandReady] = useState(initialBrandReady);

  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
    price: false,
  });

  // Pricing state
  const [pricingCopy, setPricingCopy] = useState({
    intro: "",
    outro: "",
    custom_notice: "",
  });
  const [priceQuestions, setPriceQuestions] = useState([]);
  const [priceAnswers, setPriceAnswers] = useState({});
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceErr, setPriceErr] = useState("");
  const [agent, setAgent] = useState(null);
  // Screen-scoped chat context (reset after each answer)
  const [scopePayload, setScopePayload] = useState({ scope: "standard" });


  // Small helpers to always attach identity in requests
  const withIdsQS = (url) => {
    const u = new URL(url, window.location.origin);
    if (sessionId) u.searchParams.set("session_id", sessionId);
    if (visitorId) u.searchParams.set("visitor_id", visitorId);
    return u.toString();
  };
  const withIdsBody = (obj) => ({
    ...obj,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(visitorId ? { visitor_id: visitorId } : {}),
  });
  const withIdsHeaders = () => ({
    ...(sessionId ? { "X-Session-Id": sessionId } : {}),
    ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
  });
  // Update scope when entering Demo/Doc views
  useEffect(() => {
    if (selected && selected.id && mode === "docs") {
      setScopePayload({ scope: "doc", doc_id: String(selected.id) });
    } else if (selected && selected.id && mode !== "docs") {
      setScopePayload({ scope: "demo", demo_id: String(selected.id) });
    } else {
      setScopePayload({ scope: "standard" });
    }
  }, [selected, mode]);


  // Resolve bot by alias
  useEffect(() => {
    if (botId) return;
    if (!alias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`
        );
        const data = await res.json();
        if (cancel) return;
        const id = data?.ok ? data?.bot?.id : null;

        // NEW: capture visitor/session ids
        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

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
          // PRICING COPY from /bot-settings
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
        }
        if (id) {
          setBotId(id);
          setFatal("");
        } else if (!res.ok || data?.ok === false) {
          setFatal("Invalid or inactive alias.");
        }
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase, botId]);

  // Try default alias if needed
  useEffect(() => {
    if (botId || alias || !defaultAlias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?alias=${encodeURIComponent(defaultAlias)}`
        );
        const data = await res.json();
        if (cancel) return;
        const id = data?.ok ? data?.bot?.id : null;

        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

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
          // PRICING COPY from /bot-settings
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
        }
        if (id) setBotId(id);
      } catch { }
    })();
    return () => {
      cancel = true;
    };
  }, [botId, alias, defaultAlias, apiBase]);

  // If we start with bot_id in URL, load settings that way (and init visitor/session)
  useEffect(() => {
    if (!botIdFromUrl) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`
        );
        const data = await res.json();
        if (cancel) return;

        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

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
          // PRICING COPY from /bot-settings
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
        }
        if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch { }
    })();
    return () => {
      cancel = true;
    };
  }, [botIdFromUrl, apiBase]);

  useEffect(() => {
    if (!botId && !alias && !brandReady) setBrandReady(true);
  }, [botId, alias, brandReady]);

  // Brand: css vars + assets
  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`
        );
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
      } catch {
      } finally {
        if (!cancel) setBrandReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [botId, apiBase]);

  // Tab flags (by bot_id)
  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?bot_id=${encodeURIComponent(botId)}`
        );
        const data = await res.json();

        if (cancel) return;

        if (data?.ok) {
          setVisitorId((v) => v || data.visitor_id || "");
          setSessionId((s) => s || data.session_id || "");
        }

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
          // PRICING COPY from /bot-settings
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
        }
      } catch { }
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

  /* ================================================================================= *
   *  END SECTION 2                                                                  *
   * ================================================================================= */

  /* ================================================================================= *
   *  BEGIN SECTION 3                                                                  *
   * ================================================================================= */
  // release sticky when scrolling
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !selected) return;
    const onScroll = () => {
      if (el.scrollTop > 8 && isAnchored) setIsAnchored(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [selected, isAnchored]);

  // Calendly booking listener — send rich payload to backend (no Calendly fetch)
  useEffect(() => {
    if (mode !== "meeting" || !botId || !sessionId || !visitorId) return;

    function onCalendlyMessage(e) {
      try {
        const m = e?.data;
        if (!m || typeof m !== "object") return;

        // We only care about these two events
        if (m.event !== "calendly.event_scheduled" && m.event !== "calendly.event_canceled") return;

        const p = m.payload || {};

        // Build a rich, self-contained payload from the postMessage
        const payloadOut = {
          event: m.event, // e.g., "calendly.event_scheduled"
          scheduled_event: p.event || p.scheduled_event || null, // mirrors what Calendly sends
          invitee: {
            uri: p.invitee?.uri ?? null,
            email: p.invitee?.email ?? null,
            name: p.invitee?.full_name ?? p.invitee?.name ?? null,
          },
          questions_and_answers:
            p.questions_and_answers ??
            p.invitee?.questions_and_answers ??
            [],
          tracking: p.tracking || {}, // utm_* fields if present
        };

        // Forward to backend (no Calendly API calls in the browser)
        fetch(`${apiBase}/calendly/js-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bot_id: botId,
            session_id: sessionId,
            visitor_id: visitorId,
            payload: payloadOut,
          }),
        }).catch(() => { });
      } catch {
        // swallow — non-blocking telemetry
      }
    }

    window.addEventListener("message", onCalendlyMessage);
    return () => window.removeEventListener("message", onCalendlyMessage);
  }, [mode, botId, sessionId, visitorId, apiBase]);

  async function normalizeAndSelectDemo(item) {
    try {
      const r = await fetch(`${apiBase}/render-video-iframe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...withIdsHeaders(),
        },
        body: JSON.stringify(
          withIdsBody({
            bot_id: botId,
            demo_id: item.id || "",
            title: item.title || "",
            video_url: item.url || "",
          })
        ),
      });
      const j = await r.json();
      const embed = j?.video_url || item.url;
      setSelected({ ...item, url: embed });
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setSelected(item);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    }
  }

  async function openMeeting() {
    if (!botId) return;
    setMode("meeting");
    try {
      const res = await fetch(
        `${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`
      );
      const data = await res.json();
      const ag = data?.ok ? data.agent : null;
      setAgent(ag);
      if (
        ag &&
        ag.calendar_link_type &&
        String(ag.calendar_link_type).toLowerCase() === "external" &&
        ag.calendar_link
      ) {
        try {
          {
            const base = ag.calendar_link || "";
            const withQS = `${base}${base.includes('?') ? '&' : '?'}session_id=${encodeURIComponent(sessionId || '')}&visitor_id=${encodeURIComponent(visitorId || '')}&bot_id=${encodeURIComponent(botId || '')}&utm_source=${encodeURIComponent(botId || '')}&utm_medium=${encodeURIComponent(sessionId || '')}&utm_campaign=${encodeURIComponent(visitorId || '')}`;
            window.open(withQS, "_blank", "noopener,noreferrer");

          }
        } catch { }
      }
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setAgent(null);
    }
  }

  async function openBrowse() {
    if (!botId) return;
    setMode("browse");
    setSelected(null);
    try {
      const url = withIdsQS(
        `${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`
      );
      const res = await fetch(url, { headers: withIdsHeaders() });
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : [];
      setBrowseItems(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
          functions_text: it.functions_text ?? it.description ?? "",
        }))
      );
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseItems([]);
    }
  }

  async function openBrowseDocs() {
    if (!botId) return;
    setMode("docs");
    setSelected(null);
    try {
      const url = withIdsQS(
        `${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`
      );
      const res = await fetch(url, { headers: withIdsHeaders() });
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : [];
      setBrowseDocs(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
          functions_text: it.functions_text ?? it.description ?? "",
        }))
      );
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseDocs([]);
    }
  }



  // Pricing loader
  const priceScrollRef = useRef(null);
  useEffect(() => {
    if (mode !== "price" || !botId) return;
    let cancel = false;
    (async () => {
      try {
        setPriceErr("");
        setPriceEstimate(null);
        setPriceAnswers({});
        const res = await fetch(
          `${apiBase}/pricing/questions?bot_id=${encodeURIComponent(botId)}`
        );
        const data = await res.json();
        if (cancel) return;
        if (!data?.ok)
          throw new Error(data?.error || "Failed to load pricing questions");
        // only questions now; copy comes from /bot-settings
        setPriceQuestions(Array.isArray(data.questions) ? data.questions : []);
        requestAnimationFrame(() =>
          priceScrollRef.current?.scrollTo({ top: 0, behavior: "auto" })
        );
      } catch {
        if (!cancel) setPriceErr("Unable to load price estimator.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode, botId, apiBase]);

  // Pricing: compute estimate when inputs ready
  useEffect(() => {
    const haveAll = (() => {
      if (!priceQuestions?.length) return false;
      const req = priceQuestions.filter(
        (q) => (q.group ?? "estimation") === "estimation" && q.required !== false
      );
      if (!req.length) return false;
      return req.every((q) => {
        const v = priceAnswers[q.q_key];
        const isMulti = String(q.type).toLowerCase().includes("multi");
        return isMulti
          ? Array.isArray(v) && v.length > 0
          : !(v === undefined || v === null || v === "");
      });
    })();

    if (mode !== "price" || !botId || !haveAll) {
      setPriceEstimate(null);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        setPriceBusy(true);
        const body = {
          bot_id: botId,
          answers: {
            product_id:
              priceAnswers?.product ||
              priceAnswers?.edition ||
              priceAnswers?.product_id ||
              "",
            tier_id:
              priceAnswers?.tier ||
              priceAnswers?.transactions ||
              priceAnswers?.tier_id ||
              "",
          },
          session_id: sessionId || undefined,
          visitor_id: visitorId || undefined,
        };
        const res = await fetch(`${apiBase}/pricing/estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (cancel) return;
        if (!data?.ok)
          throw new Error(data?.error || "Failed to compute estimate");
        setPriceEstimate(data);
      } catch {
        if (!cancel) setPriceErr("Unable to compute estimate.");
      } finally {
        if (!cancel) setPriceBusy(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [
    mode,
    botId,
    apiBase,
    priceQuestions,
    priceAnswers,
    sessionId,
    visitorId,
  ]);

  // Next unanswered (null when all required answered → show estimate)
  const nextPriceQuestion = useMemo(() => {
    if (!priceQuestions?.length) return null;
    for (const q of priceQuestions) {
      if ((q.group ?? "estimation") !== "estimation" || q.required === false)
        continue;
      const v = priceAnswers[q.q_key];
      const isMulti = String(q.type).toLowerCase().includes("multi");
      const empty = isMulti
        ? !(Array.isArray(v) && v.length > 0)
        : v === undefined || v === null || v === "";
      if (empty) return q;
    }
    return null;
  }, [priceQuestions, priceAnswers]);

  // Mirror lines — prefer estimate.mirror_text; handle arrays with {q_key,text}
  const mirrorLines = useMemo(() => {
    // Helper: get chosen label for a given q_key
    const labelFor = (q_key) => {
      const q = (priceQuestions || []).find((qq) => qq.q_key === q_key);
      if (!q) return "";
      const ans = priceAnswers[q.q_key];
      if (ans == null || ans === "" || (Array.isArray(ans) && ans.length === 0)) return "";
      const opts = normalizeOptions(q);
      if (String(q.type).toLowerCase().includes("multi")) {
        const picked = Array.isArray(ans) ? ans : [];
        return opts.filter((o) => picked.includes(o.key)).map((o) => o.label).join(", ");
      }
      const o = opts.find((o) => o.key === ans);
      return o?.label || String(ans);
    };

    // 1) String mirror from server
    if (typeof priceEstimate?.mirror_text === "string") {
      const t = priceEstimate.mirror_text.trim();
      if (t) return [t];
    }

    // 2) Array of { q_key, text }
    if (Array.isArray(priceEstimate?.mirror_text)) {
      const out = [];
      for (const m of priceEstimate.mirror_text) {
        const raw = String(m?.text || "").trim();
        if (!raw) continue;
        const lbl = labelFor(m?.q_key);
        const replaced = raw
          .replace(/\{\{\s*answer_label_lower\s*\}\}/gi, lbl.toLowerCase())
          .replace(/\{\{\s*answer_label\s*\}\}/gi, lbl);
        out.push(replaced);
      }
      return out.filter(Boolean);
    }

    // 3) Derive from questions/answers as fallback
    if (!priceQuestions?.length) return [];
    const lines = [];
    for (const q of priceQuestions) {
      const ans = priceAnswers[q.q_key];
      if (
        ans === undefined ||
        ans === null ||
        ans === "" ||
        (Array.isArray(ans) && ans.length === 0)
      )
        continue;
      const opts = normalizeOptions(q);
      let label = "";
      if (String(q.type).toLowerCase().includes("multi")) {
        const picked = Array.isArray(ans) ? ans : [];
        label = opts
          .filter((o) => picked.includes(o.key))
          .map((o) => o.label)
          .join(", ");
      } else {
        const o = opts.find((o) => o.key === ans);
        label = o?.label || String(ans);
      }
      if (!label) continue;
      const tmpl = q.mirror_template;
      if (tmpl && typeof tmpl === "string") {
        const replaced = tmpl
          .replace(/\{\{\s*answer_label_lower\s*\}\}/gi, label.toLowerCase())
          .replace(/\{\{\s*answer_label\s*\}\}/gi, label);
        lines.push(replaced);
      } else {
        lines.push(label);
      }
    }
    return lines;
  }, [priceEstimate, priceQuestions, priceAnswers]);

  /* ================================================================================= *
   * END SECTION 3                                                                     *
   * ================================================================================= */

  /* ================================================================================= *
 *  BEGIN SECTION 4                                                                  *
 * ================================================================================= */

  function handlePickOption(q, opt) {
    const isMulti = String(q?.type || "").toLowerCase().includes("multi");
    setPriceAnswers((prev) => {
      if (isMulti) {
        const curr = Array.isArray(prev[q.q_key]) ? prev[q.q_key] : [];
        const exists = curr.includes(opt.key);
        const next = exists ? curr.filter((k) => k !== opt.key) : [...curr, opt.key];
        return { ...prev, [q.q_key]: next };
      }
      return { ...prev, [q.q_key]: opt.key };
    });
  }

  // Ask flow
  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();

    // Capture screen-scoped context synchronously at submit time
    const commitScope = (() => {
      let scope = "standard";
      let demo_id, doc_id;
      if (selected && selected.id && mode === "docs") {
        scope = "doc";
        doc_id = String(selected.id);
      } else if (selected && selected.id && mode !== "docs") {
        scope = "demo";
        demo_id = String(selected.id);
      }
      return { scope, ...(demo_id ? { demo_id } : {}), ...(doc_id ? { doc_id } : {}) };
    })();
    setMode("ask");
    setLastQuestion(outgoing);
    setInput("");
    setSelected(null);
    setResponseText("");
    setHelperPhase("hidden");
    setItems([]);
    setLoading(true);
    try {
      const res = await axios.post(
        `${apiBase}/demo-hal`,
        withIdsBody({ bot_id: botId, user_question: outgoing, ...commitScope, debug: true }),
        { timeout: 30000, headers: withIdsHeaders() }
      );
      const data = res?.data || {};
      setDebugInfo(data?.debug || null);

      const text = data?.response_text || "";
      const recSource = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.buttons)
          ? data.buttons
          : [];

      const recs = (Array.isArray(recSource) ? recSource : [])
        .map((it) => {
          const id = it.id ?? it.button_id ?? it.value ?? it.url ?? it.title;
          const title =
            it.title ??
            it.button_title ??
            (typeof it.label === "string"
              ? it.label.replace(/^Watch the \"|\" demo$/g, "")
              : it.label) ??
            "";
          const url = it.url ?? it.value ?? it.button_value ?? "";
          const description =
            it.description ?? it.summary ?? it.functions_text ?? "";
          const action = it.action ?? it.button_action ?? "demo";
          return {
            id,
            title,
            url,
            description,
            functions_text: it.functions_text ?? description,
            action,
          };
        })
        .filter((b) => {
          const act = (b.action || "").toLowerCase();
          const lbl = (b.title || "").toLowerCase();
          return (
            act !== "continue" &&
            act !== "options" &&
            lbl !== "continue" &&
            lbl !== "show me options"
          );
        });

      setResponseText(text);
      setLoading(false);
      // Reset scope to standard after completing the response
      setScopePayload({ scope: "standard" });

      if (recs.length > 0) {
        setHelperPhase("header");
        setTimeout(() => {
          setItems(recs);
          setHelperPhase("buttons");
        }, 60);
      } else {
        setHelperPhase("hidden");
        setItems([]);
      }

      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setLoading(false);
      setScopePayload({ scope: "standard" });
      setResponseText("Sorry—something went wrong.");
      setHelperPhase("hidden");
      setItems([]);
    }
  }

  const listSource = mode === "browse" ? browseItems : items;
  const askUnderVideo = useMemo(() => {
    if (!selected) return items;
    const selKey = selected.id ?? selected.url ?? selected.title;
    return (items || []).filter(
      (it) => (it.id ?? it.url ?? it.title) !== selKey
    );
  }, [selected, items]);
  const visibleUnderVideo = selected ? (mode === "ask" ? askUnderVideo : []) : listSource;

  const tabs = useMemo(() => {
    const out = [];
    if (tabsEnabled.demos)
      out.push({ key: "demos", label: "Browse Demos", onClick: openBrowse });
    if (tabsEnabled.docs)
      out.push({
        key: "docs",
        label: "Browse Documents",
        onClick: openBrowseDocs,
      });
    if (tabsEnabled.price)
      out.push({
        key: "price",
        label: "Price Estimate",
        onClick: () => {
          setSelected(null);
          setMode("price");
        },
      });
    if (tabsEnabled.meeting)
      out.push({ key: "meeting", label: "Schedule Meeting", onClick: openMeeting });
    return out;
  }, [tabsEnabled]);

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
        className={classNames(
          "w-screen min-h-[100dvh] flex items-center justify-center bg-[var(--page-bg)] p-4 transition-opacity duration-200",
          brandReady ? "opacity-100" : "opacity-0"
        )}
        style={liveTheme}
      >
        <div className="text-gray-800 text-center space-y-2">
          <div className="text-lg font-semibold">No bot selected</div>
          {alias ? (
            <div className="text-sm text-gray-600">
              Resolving alias “{alias}”…
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              Provide a <code>?bot_id=…</code> or <code>?alias=…</code> in the
              URL
              {defaultAlias ? (
                <> (trying default alias “{defaultAlias}”)</>
              ) : null}
              .
            </div>
          )}
        </div>
      </div>
    );
  }

  const showAskBottom = mode !== "price" || !!priceEstimate;
  const embedDomain =
    typeof window !== "undefined" ? window.location.hostname : "";

  const logoSrc =
    brandAssets.logo_url ||
    brandAssets.logo_light_url ||
    brandAssets.logo_dark_url ||
    fallbackLogo;

  return (
    <div
      className={classNames(
        "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200",
        brandReady ? "opacity-100" : "opacity-0"
      )}
      style={liveTheme}
    >
      <div
        ref={frameRef}
        className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-[var(--card-bg)] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)] flex flex-col overflow-hidden transition-all duration-300"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] border-b border-[var(--border-default)]">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="Brand logo" className="h-10 object-contain" />
            </div>
            <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">
              {selected
                ? selected.title
                : mode === "browse"
                  ? "Browse Demos"
                  : mode === "docs"
                    ? "Browse Documents"
                    : mode === "price"
                      ? "Price Estimate"
                      : mode === "meeting"
                        ? "Schedule Meeting"
                        : "Ask the Assistant"}
            </div>
          </div>
          <TabsNav mode={mode} tabs={tabs} />
        </div>

        {/* PRICE MODE */}
        {mode === "price" ? (
          <>
            <div className="px-6 pt-3 pb-2" data-patch="price-intro">
              <PriceMirror lines={mirrorLines.length ? mirrorLines : [""]} />
              {!mirrorLines.length ? (
                <div className="text-base font-bold whitespace-pre-line">
                  {pricingCopy?.intro ||
                    "This tool provides a quick estimate based on your selections. Final pricing may vary by configuration, usage, and implementation."}
                </div>
              ) : null}
            </div>
            <div
              ref={priceScrollRef}
              className="px-6 pt-0 pb-6 flex-1 overflow-y-auto"
            >
              {!priceQuestions?.length ? (
                <div className="text-sm text-[var(--helper-fg)]">
                  Loading questions…
                </div>
              ) : nextPriceQuestion ? (
                <QuestionBlock
                  q={nextPriceQuestion}
                  value={priceAnswers[nextPriceQuestion.q_key]}
                  onPick={handlePickOption}
                />
              ) : priceEstimate && priceEstimate.custom ? (
                <div className="text-base font-bold whitespace-pre-line">
                  {pricingCopy?.custom_notice ||
                    "We’ll follow up with a custom quote tailored to your selection."}
                </div>
              ) : (
                <EstimateCard
                  estimate={priceEstimate}
                  outroText={pricingCopy?.outro || ""}
                />
              )}
              {priceBusy ? (
                <div className="mt-2 text-sm text-[var(--helper-fg)]">
                  Calculating…
                </div>
              ) : null}
              {priceErr ? (
                <div className="mt-2 text-sm text-red-600">{priceErr}</div>
              ) : null}
            </div>
          </>
        ) : (

          /* ================================================================================= *
          * END SECTION 4                                                                     *
          * ================================================================================= */

          /* ================================================================================= *
          *  BEGIN SECTION 5                                                                  *
          * ================================================================================= */

          /* OTHER MODES */
          <div
            ref={contentRef}
            className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto"
          >
            {mode === "meeting" ? (
              <div className="w-full flex-1 flex flex-col" data-patch="meeting-pane">
                <div className="bg-[var(--card-bg)] pt-2 pb-2">
                  {agent?.schedule_header ? (
                    <div className="mb-2 text-sm italic whitespace-pre-line text-[var(--helper-fg)]">
                      {agent.schedule_header}
                    </div>
                  ) : null}

                  {!agent ? (
                    <div className="text-sm text-[var(--helper-fg)]">
                      Loading scheduling…
                    </div>
                  ) : agent.calendar_link_type &&
                    String(agent.calendar_link_type).toLowerCase() === "embed" &&
                    agent.calendar_link ? (
                    <iframe
                      title="Schedule a Meeting"
                      src={`${agent.calendar_link}${agent.calendar_link.includes('?') ? '&' : '?'}embed_domain=${embedDomain}&embed_type=Inline&session_id=${encodeURIComponent(sessionId || '')}&visitor_id=${encodeURIComponent(visitorId || '')}&bot_id=${encodeURIComponent(botId || '')}&utm_source=${encodeURIComponent(botId || '')}&utm_medium=${encodeURIComponent(sessionId || '')}&utm_campaign=${encodeURIComponent(visitorId || '')}`}
                      style={{
                        width: "100%",
                        height: "60vh",
                        maxHeight: "640px",
                        background: "var(--card-bg)",
                      }}
                      className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                    />
                  ) : agent.calendar_link_type &&
                    String(agent.calendar_link_type).toLowerCase() ===
                    "external" &&
                    agent.calendar_link ? (
                    <div className="text-sm text-gray-700">
                      We opened the scheduling page in a new tab. If it didn’t
                      open,&nbsp;
                      <a
                        href={agent.calendar_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        click here to open it
                      </a>
                      .
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--helper-fg)]">
                      No scheduling link is configured.
                    </div>
                  )}
                </div>
              </div>
            ) : selected ? (
              <div className="w-full flex-1 flex flex-col">
                {mode === "docs" ? (
                  <DocIframe
                    apiBase={apiBase}
                    botId={botId}
                    doc={selected}
                    sessionId={sessionId}
                    visitorId={visitorId}
                  />
                ) : (
                  <div className="bg-[var(--card-bg)] pt-2 pb-2">
                    <iframe
                      style={{ width: "100%", aspectRatio: "471 / 272" }}
                      src={selected.url}
                      title={selected.title}
                      className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {mode === "ask" && (visibleUnderVideo || []).length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-1 mb-3">
                      <p className="italic text-[var(--helper-fg)]">
                        Recommended demos
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      {visibleUnderVideo.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          onPick={(val) => normalizeAndSelectDemo(val)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : mode === "browse" ? (
              <div className="w-full flex-1 flex flex-col">
                {(browseItems || []).length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-2 mb-3">
                      <p className="italic text-[var(--helper-fg)]">
                        Select a demo to view it
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      {browseItems.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          onPick={(val) => normalizeAndSelectDemo(val)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : mode === "docs" ? (
              <div className="w-full flex-1 flex flex-col">
                {(browseDocs || []).length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-2 mb-3">
                      <p className="italic text-[var(--helper-fg)]">
                        Select a document to view it
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      {browseDocs.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          kind="doc"
                          onPick={async (val) => {
                            // Call /render-doc-iframe so server can log doc_open
                            try {
                              const r = await fetch(
                                `${apiBase}/render-doc-iframe`,
                                {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(
                                    withIdsBody({
                                      bot_id: botId,
                                      doc_id: val.id || "",
                                      title: val.title || "",
                                      url: val.url || "", // fallback if server needs it
                                    })
                                  ),
                                }
                              );
                              const j = await r.json();
                              setSelected({
                                ...val,
                                _iframe_html: j?.iframe_html || null,
                              });
                            } catch {
                              // Fallback: still show the doc URL
                              setSelected(val);
                            }
                            requestAnimationFrame(() =>
                              contentRef.current?.scrollTo({
                                top: 0,
                                behavior: "auto",
                              })
                            );
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full flex-1 flex flex-col">
                {!lastQuestion && !loading && (
                  <div className="space-y-3">
                    <div className="text-base font-bold whitespace-pre-line">
                      {responseText}
                    </div>
                    <DebugPanel debug={debugInfo} />
                    {showIntroVideo && introVideoUrl ? (
                      <div style={{ position: "relative", paddingTop: "56.25%" }}>
                        <iframe
                          src={introVideoUrl}
                          title="Intro Video"
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                          }}
                          className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                        />
                      </div>
                    ) : null}
                  </div>
                )}
                {lastQuestion ? (
                  <p className="text-base italic text-center mb-2 text-[var(--helper-fg)]">
                    "{lastQuestion}"
                  </p>
                ) : null}
                <div className="text-left mt-2">
                  {loading ? (
                    <p className="font-semibold animate-pulse text-[var(--helper-fg)]">
                      Thinking…
                    </p>
                  ) : lastQuestion ? (
                    <p className="text-base font-bold whitespace-pre-line">
                      {responseText}
                    </p>
                  ) : null}
                </div>
                {helperPhase !== "hidden" && (
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <p className="italic text-[var(--helper-fg)]">
                      Recommended demos
                    </p>
                  </div>
                )}
                {helperPhase === "buttons" && (items || []).length > 0 && (
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => normalizeAndSelectDemo(val)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Ask Bar — divider only */}
        <div
          className="px-4 py-3 border-t border-[var(--border-default)]"
          data-patch="ask-bottom-bar"
        >
          {showAskBottom ? (
            <div className="relative w-full">
              <textarea
                ref={inputRef}
                rows={1}
                className="w-full rounded-[0.75rem] px-4 py-2 pr-14 text-base placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--card-bg)] border border-[var(--border-default)] focus:border-[var(--border-default)] focus:ring-1 focus:ring-[var(--border-default)] outline-none"
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
                    sendMessage();
                  }
                }}
              />
              <button
                aria-label="Send"
                onClick={sendMessage}
                className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95"
              >
                <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:brightness-110" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ThemeLab (enable with ?themelab=1) — ColorBox only */}
      {themeLabOn && botId ? (
        <ColorBox
          apiBase={apiBase}
          botId={botId}
          frameRef={frameRef}
          onVars={(vars) => setPickerVars(vars)}
        />
      ) : null}
    </div>
  );
}

/* ================================================================================= *
 * END SECTION 5                                                                     *
 * ================================================================================= */

/* ================================================================================= *
 *  BEGIN SECTION 6                                                                  *
 * ================================================================================= */

/* =================== *
 *  Doc iframe wrapper *
 * =================== */
function DocIframe({ apiBase, botId, doc, sessionId, visitorId }) {
  // Prefer a stable <iframe src=...> so React doesn't remount on re-renders.
  // If server provided HTML, extract the first src="..." and use it.
  const iframeSrc = React.useMemo(() => {
    const html = doc?._iframe_html || "";
    if (!html) return null;
    const m = html.match(/src="([^"]+)"/i) || html.match(/src='([^']+)'/i);
    return m ? m[1] : null;
  }, [doc?._iframe_html]);

  const src = iframeSrc || doc?.url || "";

  return (
    <div className="bg-[var(--card-bg)] pt-2 pb-2">
      <iframe
        className="w-full h-[65vh] md:h-[78vh] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
        src={src}
        title={doc?.title || "Document"}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="fullscreen"
      />
    </div>
  );
}

/* =================== *
 *  ColorBox component *
 * =================== */
function ColorBox({ apiBase, botId, frameRef, onVars }) {
  const [rows, setRows] = useState([]); // [{token_key,label,value,screen_key}]
  const [values, setValues] = useState({}); // token_key -> value
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // auth state for ThemeLab
  const [authState, setAuthState] = useState("checking"); // 'checking' | 'ok' | 'need_password' | 'disabled' | 'error'
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // position near the left edge of the context card
  const [pos, setPos] = useState({ left: 16, top: 16, width: 460 });
  useEffect(() => {
    function updatePos() {
      const rect = frameRef.current?.getBoundingClientRect();
      const width = 460;
      const gap = 12;
      if (!rect) {
        setPos({ left: 16, top: 16, width });
        return;
      }
      const left = Math.max(8, rect.left - width - gap);
      const top = Math.max(8, rect.top + 8);
      setPos({ left, top, width });
    }
    updatePos();
    const h = () => updatePos();
    window.addEventListener("resize", h);
    window.addEventListener("scroll", h, { passive: true });
    return () => {
      window.removeEventListener("resize", h);
      window.removeEventListener("scroll", h);
    };
  }, [frameRef]);

  // status check then load
  async function checkStatusAndMaybeLoad() {
    try {
      setAuthError("");
      setAuthState("checking");
      // NOTE: no credentials here so we can read 401/403 cross-site
      const res = await fetch(
        `${apiBase}/themelab/status?bot_id=${encodeURIComponent(botId)}`
      );
      if (res.status === 200) {
        setAuthState("ok");
        await load();
      } else if (res.status === 401) {
        setAuthState("need_password"); // show password modal
      } else if (res.status === 403) {
        setAuthState("disabled"); // themelab disabled for this bot
      } else {
        setAuthState("error");
      }
    } catch {
      setAuthState("error");
    }
  }

  useEffect(() => {
    checkStatusAndMaybeLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, botId]);

  // fetch the 16 client-controlled tokens
  async function load() {
    const res = await fetch(
      `${apiBase}/brand/client-tokens?bot_id=${encodeURIComponent(botId)}`,
      {
        credentials: "include",
      }
    );
    const data = await res.json();
    const toks = (data?.ok ? data.tokens : []) || [];
    setRows(toks);
    const v = {};
    toks.forEach((t) => {
      v[t.token_key] = t.value || "#000000";
    });
    setValues(v);
    // apply to live CSS vars
    const css = {};
    toks.forEach((t) => {
      const cssVar = TOKEN_TO_CSS[t.token_key];
      if (cssVar) css[cssVar] = v[t.token_key];
    });
    onVars(css);
  }

  function updateToken(tk, value) {
    const v = value || "";
    setValues((prev) => ({ ...prev, [tk]: v }));
    const cssVar = TOKEN_TO_CSS[tk];
    if (cssVar) onVars((prev) => ({ ...prev, [cssVar]: v }));
  }

  async function doSave() {
    try {
      setBusy(true);
      const updates = Object.entries(values).map(([token_key, value]) => ({
        token_key,
        value,
      }));
      const res = await fetch(`${apiBase}/brand/client-tokens/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bot_id: botId, updates }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "save_failed");
      setMsg(`Saved ${data.updated} token(s).`);
      setTimeout(() => setMsg(""), 1800);
    } catch {
      setMsg("Save failed.");
      setTimeout(() => setMsg(""), 2000);
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    await load();
    setMsg("Colors restored from database.");
    setTimeout(() => setMsg(""), 1800);
  }

  async function doLogin(e) {
    e?.preventDefault();
    try {
      setAuthError("");
      const res = await fetch(`${apiBase}/themelab/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bot_id: botId, password }),
      });
      const data = await res.json();
      if (res.status === 200 && data?.ok) {
        setAuthState("ok");
        setPassword("");
        await load();
      } else if (res.status === 403) {
        setAuthState("disabled");
      } else {
        setAuthError("Invalid password.");
      }
    } catch {
      setAuthError("Login failed.");
    }
  }

  // group by screen in the required order
  const groups = useMemo(() => {
    const byScreen = new Map();
    for (const r of rows) {
      const key = r.screen_key || "welcome";
      if (!byScreen.has(key)) byScreen.set(key, []);
      byScreen.get(key).push(r);
    }
    SCREEN_ORDER.forEach(({ key }) => {
      if (byScreen.has(key)) {
        byScreen
          .get(key)
          .sort((a, b) =>
            String(a.label || "").localeCompare(String(b.label || ""))
          );
      }
    });
    return byScreen;
  }, [rows]);

  return (
    <div
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: pos.width,
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.2)", // 1px border
        borderRadius: "0.75rem", // .75rem radius
        padding: 12,
        zIndex: 50,
      }}
    >
      <div className="text-2xl font-extrabold mb-2">Colors</div>

      {authState === "checking" && (
        <div className="text-sm text-gray-600">Checking access…</div>
      )}

      {authState === "disabled" && (
        <div className="text-sm text-gray-600">
          ThemeLab is disabled for this bot.
        </div>
      )}

      {authState === "need_password" && (
        <form onSubmit={doLogin} className="flex items-center gap-2">
          <input
            type="password"
            placeholder="Enter ThemeLab password"
            className="flex-1 rounded-[0.75rem] border border-black/20 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-[0.75rem] bg-black text-white hover:brightness-110"
          >
            Unlock
          </button>
          {authError ? (
            <div className="text-xs text-red-600 ml-2">{authError}</div>
          ) : null}
        </form>
      )}

      {authState === "ok" && (
        <>
          {SCREEN_ORDER.map(({ key, label }) => (
            <div key={key} className="mb-2">
              <div className="text-sm font-bold mb-1">{label}</div>
              <div className="space-y-1 pl-1">
                {(groups.get(key) || []).map((t) => (
                  <div
                    key={t.token_key}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="text-xs">{t.label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={values[t.token_key] || "#000000"}
                        onChange={(e) => updateToken(t.token_key, e.target.value)}
                        style={{
                          width: 32,
                          height: 24,
                          borderRadius: 6,
                          border: "1px solid rgba(0,0,0,0.2)",
                        }}
                        title={t.token_key}
                      />
                      <code className="text-[11px] opacity-70">
                        {values[t.token_key] || ""}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">{msg}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={doReset}
                disabled={busy}
                className="px-3 py-1 rounded-[0.75rem] border border-black/20 bg-white hover:brightness-105"
              >
                Reset
              </button>
              <button
                onClick={doSave}
                disabled={busy}
                className="px-3 py-1 rounded-[0.75rem] bg-black text-white hover:brightness-110"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}

      {authState === "error" && (
        <div className="text-sm text-red-600">Unable to verify access.</div>
      )}
    </div>
  );
}


/* =================== *
 *      Debug Panel    *
 * =================== */
function DebugPanel({ debug }) {
  if (!debug) return null;
  const ac = debug.active_context || {};
  return (
    <div className="mt-3 p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-default)] text-xs whitespace-pre-wrap">
      <div className="font-bold mb-1">Debug</div>
      <div><b>Scope:</b> {String(debug.request_scope || "")}</div>
      <div><b>Non-specific:</b> {String(debug.nonspecific)}</div>
      <div><b>Demo ID:</b> {debug.demo_id || "—"} <b>Doc ID:</b> {debug.doc_id || "—"}</div>
      <div className="mt-2"><b>Active Context Enabled:</b> {String(ac.enabled)}</div>
      {ac.text ? (
        <details className="mt-1">
          <summary className="cursor-pointer">Active Context</summary>
          <pre className="mt-1">{ac.text}</pre>
        </details>
      ) : null}
      {debug.system_preview ? (
        <details className="mt-2">
          <summary className="cursor-pointer">System Preview</summary>
          <pre className="mt-1">{debug.system_preview}</pre>
        </details>
      ) : null}
    </div>
  );
}
/* ================================================================================= *
 * END SECTION 6                                                                     *
 * ================================================================================= */
