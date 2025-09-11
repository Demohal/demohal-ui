/* src/components/AskAssistant.jsx — full file */

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

function Row({ item, onPick, kind = "demo" }) {
  const btnClass =
    kind === "doc"
      ? UI.BTN_DOC
      : kind === "price"
      ? UI.BTN_PRICE
      : UI.BTN_DEMO;
  return (
    <button
      data-patch="row-button"
      onClick={() => onPick(item)}
      className={btnClass}
      title={item.description || ""}
    >
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.description ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {item.description}
        </div>
      ) : item.functions_text ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {item.functions_text}
        </div>
      ) : null}
    </button>
  );
}

function OptionButton({ opt, selected, onClick }) {
  return (
    <button
      data-patch="option-button"
      onClick={() => onClick(opt)}
      className={classNames(UI.BTN_PRICE, selected && "ring-2 ring-black/20")}
      title={opt.tooltip || ""}
    >
      <div className="font-extrabold text-xs sm:text-sm">{opt.label}</div>
      {opt.tooltip ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {opt.tooltip}
        </div>
      ) : null}
    </button>
  );
}

function PriceMirror({ lines }) {
  if (!lines?.length) return null;
  return (
    <div data-patch="price-mirror" className="mb-3">
      {lines.map((ln, i) => (
        <div
          key={i}
          className="text-base italic whitespace-pre-line text-[var(--mirror-fg)]"
        >
          {ln}
        </div>
      ))}
    </div>
  );
}

function EstimateCard({ estimate, outroText }) {
  if (!estimate) return null;
  return (
    <div data-patch="estimate-card">
      <div className={UI.CARD}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-lg">Your Estimate</div>
          <div className="font-bold text-lg">
            {estimate.currency_code}{" "}
            {Number(estimate.total_min).toLocaleString()} –{" "}
            {estimate.currency_code}{" "}
            {Number(estimate.total_max).toLocaleString()}
          </div>
        </div>
        <div className="space-y-3">
          {(estimate.line_items || []).map((li) => (
            <div key={li.product.id} className="rounded-[0.75rem] p-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="font-bold">{li.product.name}</div>
                <div className="font-bold text-lg">
                  {li.currency_code} {Number(li.price_min).toLocaleString()} –{" "}
                  {li.currency_code} {Number(li.price_max).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {outroText ? (
        <div className="mt-3 text-base font-bold whitespace-pre-line">
          {outroText}
        </div>
      ) : null}
    </div>
  );
}

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

/* =================== *
 *  MAIN APP COMPONENT *
 * =================== */

export default function AskAssistant() {
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
  const [priceUiCopy, setPriceUiCopy] = useState({});
  const [priceQuestions, setPriceQuestions] = useState([]);
  const [priceAnswers, setPriceAnswers] = useState({});
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceErr, setPriceErr] = useState("");

  const [agent, setAgent] = useState(null);

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
        }
        if (id) setBotId(id);
      } catch {}
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
        }
        if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch {}
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
        }
      } catch {}
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

  // Calendly -> fetch full Invitee via public Booking API, then forward to backend
  useEffect(() => {
    if (mode !== "meeting" || !botId || !sessionId || !visitorId) return;
  
    async function onCalendlyMessage(e) {
      try {
        const d = e?.data;
        if (!d || typeof d !== "object") return;
  
        // Expect: { event: "calendly.event_scheduled", payload: { invitee: { uri }, scheduled_event, tracking } }
        const ev = String(d.event || "").toLowerCase();
        if (ev !== "calendly.event_scheduled" && ev !== "calendly.event_canceled") return;
  
        const inviteeUri = d?.payload?.invitee?.uri;
        if (!inviteeUri) return;
  
        // Calendly's public Booking API returns the FULL invitee (no access token required)
        // We POST a small JSON with the 'uri' we received from postMessage.
        let fullInvitee = null;
        try {
          const calRes = await fetch("https://calendly.com/api/booking/invitees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uri: inviteeUri }),
          });
          if (calRes.ok) {
            fullInvitee = await calRes.json(); // includes email, full_name, questions_and_answers, tracking, event, etc.
          }
        } catch {
          // ignore; we'll still send the lightweight payload if Booking API fails
        }
  
        // Build payload we forward to backend. Prefer the fully-hydrated invitee if we have it.
        const payload = {
          event: d.event,
          invitee: fullInvitee || d.payload?.invitee || { uri: inviteeUri },
          scheduled_event: d.payload?.scheduled_event,
          tracking: d.payload?.tracking,
        };
  
        // Forward to your JS logging endpoint (no Calendly auth required)
        await fetch(`${apiBase}/calendly/js-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bot_id: botId,
            session_id: sessionId,
            visitor_id: visitorId,
            payload,
          }),
        });
      } catch {
        // telemetry is best-effort; swallow errors
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
    setSelected(null);
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
            const withQS = `${base}${base.includes('?') ? '&' : '?'}session_id=${encodeURIComponent(sessionId||'')}&visitor_id=${encodeURIComponent(visitorId||'')}&bot_id=${encodeURIComponent(botId||'')}&utm_source=${encodeURIComponent(botId||'')}&utm_medium=${encodeURIComponent(sessionId||'')}&utm_campaign=${encodeURIComponent(visitorId||'')}`;
            window.open(withQS, "_blank", "noopener,noreferrer");

          }
        } catch {}
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

// Calendly booking listener — forward to backend only (no Calendly API calls from browser)
useEffect(() => {
  if (mode !== "meeting" || !botId || !sessionId || !visitorId) return;

  function onCalendlyMessage(e) {
    try {
      const d = e?.data;
      if (!d || typeof d !== "object") return;

      const ev = String(d.event || "").toLowerCase();
      if (ev !== "calendly.event_scheduled" && ev !== "calendly.event_canceled") return;

      // Forward minimal payload to backend (no CORS issues, no tokens needed)
      fetch(`${apiBase}/calendly/js-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          session_id: sessionId,
          visitor_id: visitorId,
          payload: {
            event: d.event,
            invitee: d.payload?.invitee,            // contains .uri
            scheduled_event: d.payload?.scheduled_event,
            tracking: d.payload?.tracking
          }
        })
      }).catch(() => {});
    } catch {
      // ignore
    }
  }

  window.addEventListener("message", onCalendlyMessage);
  return () => window.removeEventListener("message", onCalendlyMessage);
}, [mode, botId, sessionId, visitorId, apiBase]);
  
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
        setPriceUiCopy(data.ui_copy || {});
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

  // Mirror lines — apply full template around {{answer_label}} / {{answer_label_lower}}
  const mirrorLines = useMemo(() => {
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
          .replace(
            /\{\{\s*answer_label_lower\s*\}\}|\{\s*answer_label_lower\s*\}/gi,
            label.toLowerCase()
          )
          .replace(
            /\{\{\s*answer_label\s*\}\}|\{\s*answer_label\s*\}/gi,
            label
          );
        lines.push(replaced);
      } else {
        lines.push(label);
      }
    }
    return lines;
  }, [priceQuestions, priceAnswers]);

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
        withIdsBody({ bot_id: botId, user_question: outgoing }),
        { timeout: 30000, headers: withIdsHeaders() }
      );
      const data = res?.data || {};

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
              Resolving alias “{alias}”...
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
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)]">
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
              <PriceMirror lines={mirrorLines.length ? mirrorLines : null} />
              {!mirrorLines.length ? (
                <div className="text-base font-bold whitespace-pre-line">
                  {((priceUiCopy?.intro?.heading || "").trim()
                    ? `${priceUiCopy.intro.heading.trim()}\n\n`
                    : "") +
                    (priceUiCopy?.intro?.body ||
                      "This tool provides a quick estimate based on your selections. Final pricing may vary by configuration, usage, and implementation.")}
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
              ) : (
                <EstimateCard
                  estimate={priceEstimate}
                  outroText={
                    ((priceUiCopy?.outro?.heading || "").trim()
                      ? `${priceUiCopy.outro.heading.trim()}\n\n`
                      : "") + (priceUiCopy?.outro?.body || "")
                  }
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
                      src={`${agent.calendar_link}${agent.calendar_link.includes('?') ? '&' : '?'}embed_domain=${embedDomain}&embed_type=Inline&session_id=${encodeURIComponent(sessionId||'')}&visitor_id=${encodeURIComponent(visitorId||'')}&bot_id=${encodeURIComponent(botId||'')}&utm_source=${encodeURIComponent(botId||'')}&utm_medium=${encodeURIComponent(sessionId||'')}&utm_campaign=${encodeURIComponent(visitorId||'')}`}
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

/* =================== *
 *  Doc iframe wrapper *
 * =================== */
function DocIframe({ apiBase, botId, doc, sessionId, visitorId }) {
  // If we have server-rendered HTML, use it; else fall back to raw URL
  if (doc?._iframe_html) {
    return (
      <div
        className="bg-[var(--card-bg)] pt-2 pb-2"
        dangerouslySetInnerHTML={{ __html: doc._iframe_html }}
      />
    );
  }
  return (
    <div className="bg-[var(--card-bg)] pt-2 pb-2">
      <iframe
        className="w-full h-[65vh] md:h-[78vh] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
        src={doc.url}
        title={doc.title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
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
