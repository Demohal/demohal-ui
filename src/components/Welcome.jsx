

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

// ================== ThemeLabInline (embedded) ==================
function ThemeLabInline({ apiBase, botId, frameRef, onVars }) {
  // token -> CSS var map (matches brand_tokens_v2 keys)
  const TOKEN_TO_CSS = {
    "color.background": "--background",
    "color.foreground": "--foreground",
    "color.muted": "--muted",
    "color.mutedForeground": "--muted-foreground",
    "color.accent": "--accent",
    "color.accentForeground": "--accent-foreground",
    "color.border": "--border",
    "color.card": "--card",
    "color.cardForeground": "--card-foreground",
    "color.primary": "--primary",
    "color.primaryForeground": "--primary-foreground",
    "color.secondary": "--secondary",
    "color.secondaryForeground": "--secondary-foreground",
  };

  const SCREEN_ORDER = [
    { key: "welcome", label: "Welcome" },
    { key: "ask", label: "Ask" },
    { key: "demos", label: "Demos" },
    { key: "docs", label: "Docs" },
    { key: "pricing", label: "Pricing" },
    { key: "meeting", label: "Schedule" },
  ];

  const [rows, setRows] = useState([]);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [authState, setAuthState] = useState("checking"); // checking | need_password | disabled | ok | error
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Float box near the main content area
  const [pos, setPos] = useState({ left: 16, top: 16, width: 460 });
  useEffect(() => {
    function updatePos() {
      const r = frameRef?.current?.getBoundingClientRect?.();
      const width = 460, gap = 12;
      if (!r) return setPos({ left: 16, top: 16, width });
      setPos({
        left: Math.max(8, r.left - width - gap),
        top: Math.max(8, r.top + 8),
        width,
      });
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

  // --- Auth gate & initial load ---
  async function checkStatusAndMaybeLoad() {
    try {
      setAuthError(""); setAuthState("checking");
      const res = await fetch(
        `${apiBase}/themelab/status?bot_id=${encodeURIComponent(botId)}`,
        { credentials: "include" }
      );
      if (res.status === 200) { setAuthState("ok"); await load(); }
      else if (res.status === 401) setAuthState("need_password");
      else if (res.status === 403) setAuthState("disabled");
      else setAuthState("error");
    } catch {
      setAuthState("error");
    }
  }
  useEffect(() => {
    if (apiBase && botId) checkStatusAndMaybeLoad();
  }, [apiBase, botId]); // eslint-disable-line

  // --- Load tokens from DB ---
  async function load() {
    const res = await fetch(
      `${apiBase}/brand/client-tokens?bot_id=${encodeURIComponent(botId)}`,
      { credentials: "include" }
    );
    const data = await res.json();
    const toks = (data?.ok ? data.tokens : []) || [];
    setRows(toks);

    // build values + live-apply to page
    const v = {};
    toks.forEach(t => { v[t.token_key] = t.value || "#000000"; });
    setValues(v);

    const cssPatch = {};
    toks.forEach(t => {
      const cssVar = TOKEN_TO_CSS[t.token_key];
      if (cssVar) cssPatch[cssVar] = v[t.token_key];
    });
    onVars && onVars(cssPatch);
  }

  // --- Local edit -> live preview ---
  function updateToken(tokenKey, value) {
    const v = value || "";
    setValues(prev => ({ ...prev, [tokenKey]: v }));

    const cssVar = TOKEN_TO_CSS[tokenKey];
    if (cssVar && onVars) {
      // send only the delta so Welcome can merge
      onVars({ [cssVar]: v });
    }
  }

  // --- Save / Reset / Login ---
  async function doSave() {
    try {
      setBusy(true);
      const updates = Object.entries(values).map(([token_key, value]) => ({ token_key, value }));
      const res = await fetch(`${apiBase}/brand/client-tokens/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bot_id: botId, updates }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error();
      setMsg(`Saved ${data.updated} token(s).`); setTimeout(() => setMsg(""), 1600);
    } catch {
      setMsg("Save failed."); setTimeout(() => setMsg(""), 1800);
    } finally {
      setBusy(false);
    }
  }
  async function doReset() { await load(); setMsg("Restored from database."); setTimeout(() => setMsg(""), 1400); }
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
      if (res.status === 200 && data?.ok) { setAuthState("ok"); setPassword(""); await load(); }
      else if (res.status === 403) setAuthState("disabled");
      else setAuthError("Invalid password.");
    } catch {
      setAuthError("Login failed.");
    }
  }

  const groups = useMemo(() => {
    const by = new Map();
    for (const r of rows) {
      const k = r.screen_key || "welcome";
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(r);
    }
    // Stable order + label sort per screen
    SCREEN_ORDER.forEach(({ key }) => {
      if (by.has(key)) by.get(key).sort((a,b) => String(a.label||"").localeCompare(String(b.label||"")));
    });
    return by;
  }, [rows]);

  // --- UI ---
  return (
    <div style={{
      position: "fixed", left: pos.left, top: pos.top, width: pos.width,
      background: "#fff", border: "1px solid rgba(0,0,0,0.2)",
      borderRadius: "12px", padding: 12, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.08)"
    }}>
      <div className="text-base font-bold mb-2">ThemeLab</div>

      {authState === "checking" && <div className="text-sm text-gray-600">Checking access…</div>}
      {authState === "disabled" && <div className="text-sm text-gray-600">ThemeLab is disabled for this bot.</div>}

      {authState === "need_password" && (
        <form onSubmit={doLogin} className="flex items-center gap-2">
          <input
            type="password"
            placeholder="Enter ThemeLab password"
            className="flex-1 rounded-[12px] border border-black/20 px-3 py-2"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />
          <button type="submit" className="px-3 py-2 rounded-[12px] bg-black text-white">Unlock</button>
          {authError ? <div className="text-xs text-red-600 ml-2">{authError}</div> : null}
        </form>
      )}

      {authState === "ok" && (
        <>
          {SCREEN_ORDER.map(({ key, label }) => (
            <div key={key} className="mb-2">
              <div className="text-sm font-semibold mb-1">{label}</div>
              <div className="space-y-1 pl-1">
                {(groups.get(key) || []).map(t => (
                  <div key={t.token_key} className="flex items-center justify-between gap-3">
                    <div className="text-xs">{t.label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={values[t.token_key] || "#000000"}
                        onChange={(e)=>updateToken(t.token_key, e.target.value)}
                        style={{ width: 32, height: 24, borderRadius: 6, border: "1px solid rgba(0,0,0,0.2)" }}
                        title={t.token_key}
                      />
                      <code className="text-[11px] opacity-70">{values[t.token_key] || ""}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">{msg}</div>
            <div className="flex items-center gap-2">
              <button onClick={doReset} disabled={busy} className="px-3 py-1 rounded-[12px] border border-black/20 bg-white">Reset</button>
              <button onClick={doSave} disabled={busy} className="px-3 py-1 rounded-[12px] bg-black text-white">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </>
      )}

      {authState === "error" && <div className="text-sm text-red-600">Unable to verify access.</div>}
    </div>
  );
}
// ================== /ThemeLabInline ==================


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

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");

  // Modes: 'ask' | 'browse' | 'docs' | 'meeting' | 'formfill'
  const [mode, setMode] = useState("ask");

  // Q&A state
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);

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

  const themeLabEnabled = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("themelab") === "1";
  }, []);
   
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
        "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200",
        brandReady ? "opacity-100" : "opacity-0"
      )}
      style={liveTheme}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-[var(--card-bg)] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)] flex flex-col overflow-hidden transition-all duration-300">
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
                : mode === "meeting"
                ? "Schedule Meeting"
                : mode === "formfill"
                ? "Tell us about yourself"
                : "Ask the Assistant"}
            </div>
          </div>
          {/* Tabs */}
          <TabsNav mode={mode} tabs={tabs} />
        </div>

        {/* BODY */}
        <div
          ref={contentRef}
          className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto"
        >
          {mode === "formfill" ? (
            <div className="space-y-4">
              <div className="text-base font-semibold">
                Before we get started, please take a minute to tell us a little
                about yourself so that we can give you the best experience
                possible.
              </div>
              <FormFillCard
                fields={activeFormFields}
                defaults={formDefaults}
                onSubmit={async (vals) => {
                  // persist to visitor profile
                  try {
                    await fetch(`${apiBase}/visitor-formfill`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        visitor_id: visitorId,
                        values: vals,
                      }),
                    });
                  } catch {}
                  // mark session complete & continue pending action
                  try {
                    sessionStorage.setItem(FORM_KEY, "1");
                  } catch {}
                  setFormCompleted(true);
                  const p = pending;
                  setPending(null);
                  if (p?.type === "ask" && p.payload?.text)
                    await doSend(p.payload.text);
                  else if (p?.type === "demos") await _openBrowse();
                  else if (p?.type === "docs") await _openBrowseDocs();
                  else if (p?.type === "meeting") await _openMeeting();
                  else setMode("ask");
                }}
              />
            </div>
          ) : mode === "meeting" ? (
            <div className="w-full flex-1 flex flex-col">
              {!agent ? (
                <div className="text-sm text-[var(--helper-fg)]">
                  Loading scheduling…
                </div>
              ) : agent.calendar_link_type &&
                String(agent.calendar_link_type).toLowerCase() === "embed" &&
                agent.calendar_link ? (
                <iframe
                  title="Schedule a Meeting"
                  src={`${agent.calendar_link}${
                    agent.calendar_link.includes("?") ? "&" : "?"
                  }embed_domain=${embedDomain}&embed_type=Inline&session_id=${encodeURIComponent(
                    sessionId || ""
                  )}&visitor_id=${encodeURIComponent(
                    visitorId || ""
                  )}&bot_id=${encodeURIComponent(botId || "")}`}
                  style={{
                    width: "100%",
                    height: "60vh",
                    maxHeight: "640px",
                    background: "var(--card-bg)",
                  }}
                  className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                />
              ) : agent.calendar_link_type &&
                String(agent.calendar_link_type).toLowerCase() === "external" &&
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
          ) : selected ? (
            <div className="w-full flex-1 flex flex-col">
              {mode === "docs" ? (
                <DocIframe doc={selected} />
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
                                    url: val.url || "",
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
              {(items || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <p className="italic text-[var(--helper-fg)]">
                      Recommended demos
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
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
          )}
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
         {/* ThemeLab (only when ?themelab=1) */}
         {themeLabEnabled && botId ? (
           <ThemeLabInline
             apiBase={apiBase}
             botId={botId}
             frameRef={contentRef}
             // merge patches so defaults aren’t lost
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
