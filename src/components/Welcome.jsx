/* Welcome.jsx — FULL FILE (patched)
   - Tabs (Demos, Docs, Meeting); Ask is not a tab
   - Dynamic FormFill fetched from backend (/formfill-config)
     * Honors bots_v2.show_formfill and bots_v2.formfill_fields
     * Prefills from visitors_v2.formfill_fields and URL params (field_key)
     * Shows once on first Ask/Tab click; hidden after submit for the session
     * Bypasses entirely when disabled or no collectable fields
   - Demo (video) & Doc iframe viewers preserved
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import fallbackLogo from "../assets/logo.png";

import TabsNav from "./TabsNav";
import Row from "./Row";
import DocIframe from "./DocIframe";
import AskInputBar from "./AskInputBar";
import FormFillCard from "./FormFillCard";
import ColorBox from "./ThemeLab";

/* =============================== *
 *  CLIENT-CONTROLLED CSS TOKENS   *
 * =============================== */

const DEFAULT_THEME_VARS = {
  "--banner-bg": "#000000",
  "--banner-fg": "#ffffff",
  "--page-bg": "#e6e6e6",
  "--card-bg": "#ffffff",
  "--shadow-elevation": "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",
  // Text roles
  "--message-fg": "#000000",
  "--helper-fg": "#4b5563",
  "--mirror-fg": "#4b5563",
  // Tabs (inactive)
  "--tab-bg": "#303030",
  "--tab-fg": "#ffffff",
  "--tab-active-fg": "#ffffff", // computed at runtime
  // Buttons
  "--demo-button-bg": "#3a4554",
  "--demo-button-fg": "#ffffff",
  "--doc.button.background": "#000000", // legacy no-op
  "--doc-button-bg": "#000000",
  "--doc-button-fg": "#ffffff",
  // Send icon
  "--send-color": "#000000",
  // Borders
  "--border-default": "#9ca3af",
};

const classNames = (...xs) => xs.filter(Boolean).join(" ");
function inverseBW(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || "").trim());
  if (!m) return "#000000";
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.5 ? "#000000" : "#ffffff";
}

export default function Welcome() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL → alias / bot_id
  const { alias, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const a = (qs.get("alias") || qs.get("alais") || "").trim();
    const b = (qs.get("bot_id") || "").trim();
    return { alias: a, botIdFromUrl: b };
  }, []);

  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  // URL params (used to prefill form fields by field_key)
  const urlParams = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    const o = {};
    q.forEach((v, k) => {
      o[k] = v;
    });
    return o;
  }, []);

  // URL flag to enable ThemeLab editor
  const themeLabEnabled = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("themelab") === "1";
  }, []);
   
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");

  // Modes: 'ask' | 'browse' | 'docs' | 'meeting' | 'formfill'
  const [mode, setMode] = useState("ask");

  // Q&A state
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const priceBusy = loading;
  const appBusy = loading; 

  // Recommendations / browse state
  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);

  // Meeting
  const [agent, setAgent] = useState(null);

  // Refs
  const contentRef = useRef(null);
  const inputRef = useRef(null);

  // Visitor/session identity
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Theme & brand
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });
  const liveTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);

  const initialBrandReady = useMemo(
    () => !(botIdFromUrl || alias),
    [botIdFromUrl, alias]
  );
  const [brandReady, setBrandReady] = useState(initialBrandReady);

  // Tabs enabled (from /bot-settings)
  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
  });

  // --- FormFill server-driven config/state ---
  const [showFormfill, setShowFormfill] = useState(true); // server can disable per-bot
  const [formFields, setFormFields] = useState([]); // bots_v2.formfill_fields
  const [visitorDefaults, setVisitorDefaults] = useState({}); // visitors_v2.formfill_fields map


  // === Mocked FormFill session flags ===
  const [formShown, setFormShown] = useState(false); // first interaction opens it
  const [formCompleted, setFormCompleted] = useState(false); // never show again after submit
  const [pending, setPending] = useState(null); // { type: 'ask'|'demos'|'docs'|'meeting', payload? }

  // Session persistence key so we never reshow after submit (per bot)
  const FORM_KEY = useMemo(
    () => `formfill_completed:${botId || alias || "_"}`,
    [botId, alias]
  );

  useEffect(() => {
    try {
      const done = sessionStorage.getItem(FORM_KEY);
      if (done === "1") setFormCompleted(true);
    } catch {}
  }, [FORM_KEY]);

  // Helpers to attach identity in requests
  const withIdsBody = (obj) => ({
    ...obj,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(visitorId ? { visitor_id: visitorId } : {}),
  });
  const withIdsHeaders = () => ({
    ...(sessionId ? { "X-Session-Id": sessionId } : {}),
    ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
  });
  const withIdsQS = (url) => {
    const u = new URL(url, window.location.origin);
    if (sessionId) u.searchParams.set("session_id", sessionId);
    if (visitorId) u.searchParams.set("visitor_id", visitorId);
    return u.toString();
  };

  /* ============================= *
   *   Bot resolution & branding   *
   * ============================= */

  // Resolve bot by alias
  useEffect(() => {
    if (botId || !alias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`
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
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
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

        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

        const b = data?.ok ? data?.bot : null;
        if (b) {
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
          });
        }
        if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [botId, alias, defaultAlias, apiBase]);

  // If we start with bot_id in URL
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
          setResponseText(b.welcome_message || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
          });
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

  // Brand assets + css vars
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);
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
      } catch {}
      finally {
        if (!cancel) setBrandReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [botId, apiBase]);

  /* ============================= *
   *   FormFill config fetcher     *
   * ============================= */
  async function fetchFormfillConfigBy(botIdArg, aliasArg) {
    try {
      const params = new URLSearchParams();
      if (botIdArg) params.set("bot_id", botIdArg);
      else if (aliasArg) params.set("alias", aliasArg);
      if (visitorId) params.set("visitor_id", visitorId);
      if ([...params.keys()].length === 0) return;
      const res = await fetch(
        `${apiBase}/formfill-config?${params.toString()}`
      );
      const data = await res.json();
      if (data?.ok) {
        setShowFormfill(!!data.show_formfill);
        setFormFields(Array.isArray(data.fields) ? data.fields : []);
        if (data.visitor_values && typeof data.visitor_values === "object") {
          setVisitorDefaults(data.visitor_values);
        }
      }
    } catch {}
  }

  // Fetch when botId resolves
  useEffect(() => {
    if (botId) fetchFormfillConfigBy(botId, null);
  }, [botId]);

  // If operating by alias before botId exists
  useEffect(() => {
    if (!botId && alias) fetchFormfillConfigBy(null, alias);
  }, [alias, botId]);

  // When visitorId appears, refresh to include visitor defaults
  useEffect(() => {
    if (botId && visitorId) fetchFormfillConfigBy(botId, null);
  }, [visitorId]);

  // Filter to collectable fields (is_standard overrides is_collected)
  const activeFormFields = useMemo(() => {
    const arr = Array.isArray(formFields) ? formFields : [];
    return arr.filter((f) => f && (f.is_standard || f.is_collected));
  }, [formFields]);

  // Defaults: visitor values merged with URL overrides (URL wins)
  const formDefaults = useMemo(() => {
    const o = { ...(visitorDefaults || {}) };
    activeFormFields.forEach((f) => {
      const k = f.field_key;
      const urlV = urlParams[k];
      if (typeof urlV === "string" && urlV.length) o[k] = urlV;
    });
    return o;
  }, [activeFormFields, visitorDefaults, urlParams]);

  /* ============ *
   *   Ask Flow   *
   * ============ */
 // --- PATCH: Welcome.jsx — replace entire doSend to use demo_buttons only ---
async function doSend(outgoing) {
  setMode("ask");
  setLastQuestion(outgoing);
  setInput("");
  setSelected(null);
  setResponseText("");
  setItems([]);
  setLoading(true);
  try {
    const res = await axios.post(
      `${apiBase}/demo-hal`,
      withIdsBody({ bot_id: botId, user_question: outgoing, scope: "standard", debug: true }),
      { timeout: 30000, headers: withIdsHeaders() }
    );

    const data = res?.data || {};
    const text = data?.response_text || "";

    // NEW: map only demo recommendations (no docs, no fallbacks)
    const src = Array.isArray(data?.demo_buttons) ? data.demo_buttons : [];
    const mapped = src.map((it, idx) => ({
      id: it.id ?? it.value ?? it.url ?? it.title ?? String(idx),
      title: it.title ?? it.button_title ?? it.label ?? "",
      url: it.url ?? it.value ?? it.button_value ?? "",
      description: it.description ?? it.summary ?? it.functions_text ?? "",
    }));
    setItems(mapped.filter(Boolean));

    setResponseText(text);
    setLoading(false);
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  } catch (err) {
    setLoading(false);
    setResponseText("Sorry—something went wrong.");
    setItems([]);
  }
}
// --- END PATCH ---

  // Show-once helper (also consult sessionStorage defensively)
  function maybeOpenForm(next) {
    // Bypass if backend disabled or nothing to collect
    if (!showFormfill || activeFormFields.length === 0) {
      return false;
    }

    // Prevent re-trigger if already completed this session
    try {
      if (sessionStorage.getItem(FORM_KEY) === "1") {
        if (!formCompleted) setFormCompleted(true);
        return false;
      }
    } catch {}
    if (!formCompleted && !formShown) {
      setFormShown(true);
      setPending(next);
      setMode("formfill"); // clear content area per spec
      return true;
    }
    return false;
  }

  async function onSendClick() {
    const outgoing = input.trim();
    if (!outgoing || !botId) return;
    if (maybeOpenForm({ type: "ask", payload: { text: outgoing } })) return;
    await doSend(outgoing);
  }

  /* ============================= *
   *   Demo/Doc browse + viewers   *
   * ============================= */
  async function normalizeAndSelectDemo(item) {
    try {
      const r = await fetch(`${apiBase}/render-video-iframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...withIdsHeaders() },
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

  async function _openBrowse() {
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
        }))
      );
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseItems([]);
    }
  }
  async function openBrowse() {
    if (maybeOpenForm({ type: "demos" })) return;
    await _openBrowse();
  }

  async function _openBrowseDocs() {
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
        }))
      );
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseDocs([]);
    }
  }
  async function openBrowseDocs() {
    if (maybeOpenForm({ type: "docs" })) return;
    await _openBrowseDocs();
  }

  const embedDomain = typeof window !== "undefined" ? window.location.hostname : "";

  async function _openMeeting() {
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
          const base = ag.calendar_link || "";
          const withQS = `${base}${base.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(
            sessionId || ""
          )}&visitor_id=${encodeURIComponent(
            visitorId || ""
          )}&bot_id=${encodeURIComponent(botId || "")}`;
          window.open(withQS, "_blank", "noopener,noreferrer");
        } catch {}
      }
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setAgent(null);
    }
  }
  async function openMeeting() {
    if (maybeOpenForm({ type: "meeting" })) return;
    await _openMeeting();
  }

  // Calendly JS event relay (optional)
  useEffect(() => {
    if (mode !== "meeting" || !botId || !sessionId || !visitorId) return;
    function onCalendlyMessage(e) {
      try {
        const m = e?.data;
        if (!m || typeof m !== "object") return;
        if (
          m.event !== "calendly.event_scheduled" &&
          m.event !== "calendly.event_canceled"
        )
          return;
        const p = m.payload || {};
        const payloadOut = {
          event: m.event,
          scheduled_event: p.event || p.scheduled_event || null,
          invitee: {
            uri: p.invitee?.uri ?? null,
            email: p.invitee?.email ?? null,
            name: p.invitee?.full_name ?? p.invitee?.name ?? null,
          },
          questions_and_answers:
            p.questions_and_answers ?? p.invitee?.questions_and_answers ?? [],
          tracking: p.tracking || {},
        };
        fetch(`${apiBase}/calendly/js-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bot_id: botId,
            session_id: sessionId,
            visitor_id: visitorId,
            payload: payloadOut,
          }),
        }).catch(() => {});
      } catch {}
    }
    window.addEventListener("message", onCalendlyMessage);
    return () => window.removeEventListener("message", onCalendlyMessage);
  }, [mode, botId, sessionId, visitorId, apiBase]);

  // Autosize ask box
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  /* ============ *
   *   Render     *
   * ============ */
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
    if (tabsEnabled.meeting)
      out.push({
        key: "meeting",
        label: "Schedule Meeting",
        onClick: openMeeting,
      });
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

   // Compose a safe "bot" view so JSX like bot?.logo_url never throws
   const bot = {
     logo_url:
       (brandAssets && (brandAssets.logo_url || brandAssets.logo_light_url || brandAssets.logo_dark_url)) ||
       null,
     company_name: (brandAssets && brandAssets.company_name) || null,
     description: (brandAssets && brandAssets.description) || null,
     intro_video_url: introVideoUrl || null,
     show_intro_video: !!showIntroVideo,
     show_browse_demos: !!(tabsEnabled && tabsEnabled.demos),
     show_browse_docs: !!(tabsEnabled && tabsEnabled.docs),
     show_schedule_meeting: !!(tabsEnabled && tabsEnabled.meeting),
     // pricing text if you have it in state; otherwise null is fine
     pricing_intro: null,
     pricing_outro: null,
     welcome_message: responseText || null,
   };
 
   
   const logoSrc =
    brandAssets.logo_url ||
    brandAssets.logo_light_url ||
    brandAssets.logo_dark_url ||
    fallbackLogo;

  const listSource = mode === "browse" ? browseItems : items;
  const visibleUnderVideo = selected ? (mode === "ask" ? items : []) : listSource;

  return (
    <div
      className={classNames(
        "min-h-screen w-full bg-background text-foreground",
        priceBusy ? "pointer-events-none select-none opacity-70" : "opacity-100",
      )}
      style={liveTheme}
      ref={contentRef}
    >
      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-background/65 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-3">
            <img
              src={bot?.logo_url || fallbackLogo}
              className="h-8 w-8 rounded"
              alt={bot?.company_name || "Brand"}
            />
            <div className="leading-tight">
              <div className="font-semibold">
                {bot?.company_name || client?.name || "Welcome"}
              </div>
              {bot?.description ? (
                <div className="text-sm text-muted-foreground">
                  {bot.description}
                </div>
              ) : null}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Quick actions */}
            {bot?.show_schedule_meeting ? (
              <button
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
                onClick={() => setMode("meeting")}
              >
                Schedule
              </button>
            ) : null}
            {bot?.show_price_estimate ? (
              <button
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
                onClick={() => setMode("pricing")}
              >
                Estimate
              </button>
            ) : null}
            {bot?.show_browse_demos ? (
              <button
                className={classNames(
                  "px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent",
                  mode === "demos" && "bg-accent",
                )}
                onClick={() => setMode("demos")}
              >
                Demos
              </button>
            ) : null}
            {bot?.show_browse_docs ? (
              <button
                className={classNames(
                  "px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent",
                  mode === "docs" && "bg-accent",
                )}
                onClick={() => setMode("docs")}
              >
                Docs
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — primary content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Intro Video */}
          {showIntroVideo && bot?.intro_video_url && mode === "home" && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="aspect-video bg-muted/40">
                <iframe
                  className="w-full h-full"
                  src={bot.intro_video_url}
                  title="Intro Video"
                  allow="autoplay; fullscreen; picture-in-picture"
                />
              </div>
            </div>
          )}

          {/* Welcome message */}
          {bot?.welcome_message && mode === "home" && (
            <div className="rounded-xl border border-border p-6">
              <p className="text-base whitespace-pre-wrap">
                {bot.welcome_message}
              </p>
            </div>
          )}

          {/* Meeting Scheduler */}
          {mode === "meeting" && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold">Schedule a meeting</h2>
                {agent?.schedule_header ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    {agent.schedule_header}
                  </p>
                ) : null}
              </div>
              <div className="h-[720px]">
                <iframe
                  src={agent?.calendar_link}
                  className="w-full h-full"
                  title="Schedule"
                />
              </div>
            </div>
          )}

          {/* Pricing */}
          {mode === "pricing" && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold">Price Estimate</h2>
                {bot?.pricing_intro ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    {bot.pricing_intro}
                  </p>
                ) : null}
              </div>

              <div className="p-4">
                {/* Price questions */}
                {priceQuestions.length ? (
                  <div className="flex flex-col gap-4">
                    {priceQuestions.map((q) => (
                      <PriceQuestion
                        key={q.id}
                        question={q}
                        value={priceAnswers[q.id]}
                        onChange={(val) => onPriceAnswer(q.id, val)}
                      />
                    ))}
                    <div className="flex justify-end">
                      <button
                        className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
                        onClick={calculatePrice}
                        disabled={priceBusy}
                      >
                        {priceBusy ? "Calculating…" : "Get estimate"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No pricing questions configured.
                  </div>
                )}

                {/* Price results */}
                {priceBands?.length ? (
                  <div className="mt-6">
                    <h3 className="font-medium mb-2">Estimated range</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {priceBands.map((b) => (
                        <div
                          key={b.id}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="text-sm text-muted-foreground">
                            {b.label}
                          </div>
                          <div className="text-xl font-semibold">
                            {formatCurrency(b.min)} – {formatCurrency(b.max)}
                          </div>
                          {b.notes ? (
                            <div className="text-sm mt-1">{b.notes}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {bot?.pricing_outro ? (
                      <p className="text-sm text-muted-foreground mt-3">
                        {bot.pricing_outro}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Demos */}
          {mode === "demos" && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Product demos</h2>
                  <p className="text-sm text-muted-foreground">
                    Browse and launch demos.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
                    placeholder="Filter demos…"
                    value={demoFilter}
                    onChange={(e) => setDemoFilter(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-4">
                {filteredDemos.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredDemos.map((d) => (
                      <DemoCard
                        key={d.id}
                        demo={d}
                        onOpen={() => openDemo(d)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No demos match your filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Docs */}
          {mode === "docs" && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Documents</h2>
                  <p className="text-sm text-muted-foreground">
                    Explore documents and resources.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
                    placeholder="Filter docs…"
                    value={docFilter}
                    onChange={(e) => setDocFilter(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-4">
                {filteredDocs.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredDocs.map((d) => (
                      <DocCard
                        key={d.id}
                        doc={d}
                        onOpen={() => openDoc(d)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No documents match your filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Iframes for viewers */}
          {activeDemo ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{activeDemo.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Demo viewer
                  </p>
                </div>
                <button
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
                  onClick={() => setActiveDemo(null)}
                >
                  Close
                </button>
              </div>
              <div className="h-[720px] bg-muted/40">
                <iframe
                  className="w-full h-full"
                  src={activeDemo.url}
                  title={activeDemo.title}
                />
              </div>
            </div>
          ) : null}

          {activeDoc ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{activeDoc.title}</h2>
                  <p className="text-sm text-muted-foreground">Doc viewer</p>
                </div>
                <button
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
                  onClick={() => setActiveDoc(null)}
                >
                  Close
                </button>
              </div>
              <div className="h-[720px] bg-muted/40">
                <iframe
                  className="w-full h-full"
                  src={activeDoc.url}
                  title={activeDoc.title}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Right column — Ask + FormFill */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* FormFill (first interaction) */}
          {mode === "formfill" && formVisible && (
            <div className="rounded-xl border border-border p-4">
              <h2 className="font-semibold mb-2">
                Tell us a little about you
              </h2>
              <FormFillCard
                botId={botId}
                apiBase={apiBase}
                onSaved={() => {
                  setFormVisible(false);
                  if (formTrigger === "first_interaction") {
                    setMode("ask");
                  }
                }}
              />
            </div>
          )}

          {/* Ask */}
          {mode !== "formfill" && (
            <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
              <h2 className="font-semibold">Ask anything</h2>
              <p className="text-sm text-muted-foreground">
                I can answer questions, launch demos, and more.
              </p>

              <div className="flex flex-col gap-2">
                <AskExamples onPick={(t) => setInput(t)} />
                <div className="rounded-lg border border-border">
                  <ChatWindow
                    messages={messages}
                    onRetry={onRetry}
                    busy={false}
                  />
                </div>
              </div>

              {/* Bottom Ask Bar — hide while formfill is active */}
              {mode !== "formfill" && (
                <AskInputBar
                  value={input}
                  onChange={setInput}
                  onSend={onSendClick}
                  inputRef={inputRef}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ThemeLab floating color editor (password-gated, only via ?themelab=1) */}
      {themeLabEnabled && botId ? (
        <ColorBox
          apiBase={apiBase}
          botId={botId}
          frameRef={contentRef}
          // IMPORTANT: merge, don't replace, so defaults stay intact
          onVars={(patch) =>
            setThemeVars((prev) => ({
              ...prev,
              ...(typeof patch === "function" ? patch(prev) : patch),
            }))
          }
        />
      ) : null}
    </div>
  );
}
