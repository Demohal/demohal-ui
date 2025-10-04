import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import fallbackLogo from "../assets/logo.png";

/* Externalized small components (full replacements provided separately) */
import TabsNav from "./TabsNav";
import Row from "./Row";
import DocIframe from "./DocIframe";
import AskInputBar from "./AskInputBar";
import FormFillCard from "./FormFillCard";

/* ============================================================
 *  CONSTANTS & HELPERS
 * ============================================================ */
const DEFAULT_THEME_VARS = {
  "--banner-bg": "#000000",
  "--banner-fg": "#ffffff",
  "--page-bg": "#e6e6e6",
  "--card-bg": "#ffffff",
  "--shadow-elevation":
    "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",
  "--message-fg": "#000000",
  "--helper-fg": "#4b5563",
  "--mirror-fg": "#4b5563",
  "--tab-bg": "#303030",
  "--tab-fg": "#ffffff",
  "--tab-active-fg": "#ffffff",
  "--demo-button-bg": "#3a4554",
  "--demo-button-fg": "#ffffff",
  "--doc-button-bg": "#000000",
  "--doc-button-fg": "#ffffff",
  "--price-button-bg": "#1a1a1a",
  "--price-button-fg": "#ffffff",
  "--send-color": "#000000",
  "--border-default": "#9ca3af",
};

const PERSPECTIVE_OPTIONS = [
  { key: "general", label: "General" },
  { key: "financial", label: "Financial" },
  { key: "operational", label: "Operational" },
  { key: "executive", label: "Owner / Executive" },
  { key: "technical", label: "Technical / IT" },
  { key: "user", label: "User / Functional" },
  { key: "customer", label: "Customer / Market" },
  { key: "compliance", label: "Governance / Compliance" },
];

const FIELD_SYNONYMS = { fname: "first_name", lname: "last_name" };
const CANON_LABELS = { first_name: "First Name", last_name: "Last Name" };

/* Demo recommendation pruning heuristics */
const DEMO_PRUNE_MAX = 6;
const DEMO_STRONG_THRESHOLD = 2;
const DEMO_STRONG_RATIO = 2.2;
const DEMO_SECONDARY_KEEP = 2;

function scoreDemo(question, demo) {
  const qTokens = new Set(
    (question || "").toLowerCase().match(/[a-z0-9]{3,}/g) || []
  );
  const textTokens =
    (
      (demo.title || "") +
      " " +
      (demo.description || "") +
      " " +
      (demo.functions_text || "")
    )
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) || [];
  const dTokens = new Set(textTokens);
  let overlap = 0;
  qTokens.forEach((t) => {
    if (dTokens.has(t)) overlap++;
  });
  return overlap;
}

function pruneDemoButtons(q, buttons) {
  if (!Array.isArray(buttons) || buttons.length <= 2) return buttons;
  const scored = buttons
    .map((b) => ({ b, s: scoreDemo(q, b) }))
    .sort((a, b) => b.s - a.s);
  const top = scored[0].s;
  const second = scored[1]?.s ?? 0;
  if (top < DEMO_STRONG_THRESHOLD) {
    return scored
      .slice(0, Math.min(DEMO_PRUNE_MAX, buttons.length))
      .map((x) => x.b);
  }
  if (second === 0 || top >= second * DEMO_STRONG_RATIO) {
    return [scored[0].b];
  }
  const cap = Math.min(
    Math.max(DEMO_SECONDARY_KEEP, 2),
    DEMO_PRUNE_MAX,
    scored.length
  );
  return scored.slice(0, cap).map((x) => x.b);
}

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

function normalizeOptions(q) {
  const raw = q?.options ?? q?.choices ?? q?.buttons ?? q?.values ?? [];
  return (Array.isArray(raw) ? raw : [])
    .map((o, idx) => {
      if (o == null) return null;
      if (typeof o === "string") return { key: o, label: o, id: String(idx) };
      const key = o.key ?? o.value ?? o.id ?? String(idx);
      const label = o.label ?? o.title ?? o.name ?? String(key);
      const tooltip = o.tooltip ?? o.description ?? o.help ?? undefined;
      return { key, label, tooltip, id: String(o.id ?? key ?? idx) };
    })
    .filter(Boolean);
}

/* ============================================================
 *  PRICING SUB-COMPONENTS (local; kept inside to avoid extra files)
 * ============================================================ */
function OptionButton({ opt, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(opt)}
      className={[
        "w-full text-center rounded-[0.75rem] px-4 py-3 transition",
        "text-[var(--price-button-fg)] bg-[var(--price-button-bg)] hover:brightness-110 active:brightness-95",
        selected ? "ring-2 ring-black/20" : "",
      ].join(" ")}
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

function QuestionBlock({ q, value, onPick }) {
  const opts = normalizeOptions(q);
  const type = String(q?.type || "").toLowerCase();
  const isMulti =
    type === "multi_choice" || type === "multichoice" || type === "multi";
  return (
    <div className="w-full rounded-[0.75rem] px-4 py-3 text-base bg-[var(--card-bg)] border border-[var(--border-default)]">
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
              onClick={(o) => onPick(q, o)}
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

function PriceMirror({ lines }) {
  if (!lines?.length) return null;
  return (
    <div className="mb-3">
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
  const items = Array.isArray(estimate.line_items)
    ? estimate.line_items
    : [];
  const fmtAmount = (c, v) => `${c} ${Number(v).toLocaleString()}`;
  const fmtRange = (c, min, max) =>
    Number(min) === Number(max)
      ? fmtAmount(c, max)
      : `${fmtAmount(c, min)} – ${fmtAmount(c, max)}`;
  const totalText = fmtRange(
    estimate.currency_code,
    estimate.total_min,
    estimate.total_max
  );
  return (
    <div>
      <div className="rounded-[0.75rem] p-4 bg-white [box-shadow:var(--shadow-elevation)]">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-lg">Your Estimate</div>
          <div className="font-bold text-lg text-right [font-variant-numeric:tabular-nums]">
            {totalText}
          </div>
        </div>
        <div className="space-y-3">
          {items.map((li, idx) => {
            const name = li?.product?.name ?? li?.label ?? "Item";
            const key = li?.product?.id ?? `${name}-${idx}`;
            const ccy =
              li?.currency_code || estimate.currency_code || "";
            const lineText = fmtRange(
              ccy,
              li?.price_min,
              li?.price_max
            );
            return (
              <div key={key} className="rounded-[0.75rem] p-3 bg-white">
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <div className="font-bold">{name}</div>
                  <div className="font-bold text-lg text-right [font-variant-numeric:tabular-nums]">
                    {lineText}
                  </div>
                </div>
              </div>
            );
          })}
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

/* ============================================================
 *  MAIN COMPONENT
 * ============================================================ */
export default function Welcome() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // Query params
  const {
    alias,
    botIdFromUrl,
    themeLabOn,
    pidParam,
    agentAlias,
    urlParams,
  } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      alias: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
      themeLabOn: (() => {
        const v = (qs.get("themelab") || "").toLowerCase();
        return v === "1" || v === "true";
      })(),
      pidParam: (qs.get("pid") || "").trim(),
      agentAlias: (qs.get("agent") || "").trim(),
      urlParams: (() => {
        const o = {};
        qs.forEach((v, k) => (o[k] = v));
        return o;
      })(),
    };
  }, []);

  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  /* Core state */
  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");
  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]); // recommendations under ask
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [agent, setAgent] = useState(null);
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [promptOverride, setPromptOverride] = useState("");
  const [lastError, setLastError] = useState(null);

  /* Theme & branding */
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(
    () => ({
      ...themeVars,
      "--tab-active-fg": inverseBW(themeVars["--tab-fg"] || "#000000"),
    }),
    [themeVars]
  );
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

  /* Tabs & gating */
  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
    price: false,
  });

  /* Form fill (personalization) */
  const [showFormfill, setShowFormfill] = useState(true);
  const [formFields, setFormFields] = useState([]);
  const [visitorDefaults, setVisitorDefaults] = useState({});
  const [formFillIntro, setFormFillIntro] = useState("");
  const [formShown, setFormShown] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);
  const [pending, setPending] = useState(null);
  const FORM_KEY = useMemo(
    () => `formfill_completed:${botId || alias || "_"}`,
    [botId, alias]
  );
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FORM_KEY) === "1")
        setFormCompleted(true);
    } catch {}
  }, [FORM_KEY]);

  /* Pricing */
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

  const contentRef = useRef(null);
  const inputRef = useRef(null);

  const embedDomain =
    typeof window !== "undefined" ? window.location.hostname : "";

  /* Utility: add session + visitor */
  const withIdsHeaders = () => ({
    ...(sessionId ? { "X-Session-Id": sessionId } : {}),
    ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
  });
  const withIdsBody = (obj) => ({
    ...obj,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(visitorId ? { visitor_id: visitorId } : {}),
  });
  const withIdsQS = (url) => {
    const u = new URL(url, window.location.origin);
    if (sessionId) u.searchParams.set("session_id", sessionId);
    if (visitorId) u.searchParams.set("visitor_id", visitorId);
    if (pidParam) u.searchParams.set("pid", pidParam);
    return u.toString();
  };

  function updateLocalVisitorValues(vals) {
    if (!vals || typeof vals !== "object") return;
    setVisitorDefaults((prev) => {
      const m = { ...(prev || {}) };
      Object.entries(vals).forEach(([k, v]) => {
        if (k === "perspective") {
          if (typeof v === "string" && v.trim()) {
            m.perspective = v.toLowerCase();
          } else if (v == null || v === "") {
            m.perspective = null;
          }
        } else if (typeof v === "string") {
          m[k] = v;
        }
      });
      return m;
    });
  }

  async function refetchVisitorValues() {
    if (!visitorId) return;
    try {
      const r = await fetch(
        `${apiBase}/visitor-formfill?visitor_id=${encodeURIComponent(
          visitorId
        )}`
      );
      if (!r.ok) return;
      const j = await r.json();
      if (j?.ok && j.values) updateLocalVisitorValues(j.values);
    } catch {}
  }

  function maybePrefillFirstQuestion(q) {
    if (!q) return;
    setInput((curr) => {
      if (curr.trim().length === 0) return q;
      return curr;
    });
  }

  /* =========================
   * BOT / ALIAS RESOLUTION
   * ========================= */
  useEffect(() => {
    if (botId || !alias) return;
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(
          withIdsQS(
            `${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`
          )
        );
        const j = await r.json();
        if (cancel) return;
        const id = j?.ok ? j?.bot?.id : null;
        if (j?.ok) {
          setVisitorId(j.visitor_id || "");
          setSessionId(j.session_id || "");
          applyBotSettings(j.bot);
        } else setFatal("Invalid or inactive alias.");
        if (id) setBotId(id);
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alias, apiBase, botId]);

  useEffect(() => {
    if (botId || alias || !defaultAlias) return;
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(
          withIdsQS(
            `${apiBase}/bot-settings?alias=${encodeURIComponent(
              defaultAlias
            )}`
          )
        );
        const j = await r.json();
        if (cancel) return;
        if (j?.ok) {
            setVisitorId(j.visitor_id || "");
          setSessionId(j.session_id || "");
          applyBotSettings(j.bot);
          setBotId(j.bot.id);
        }
      } catch {}
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, alias, defaultAlias, apiBase]);

  function applyBotSettings(bot) {
    if (!bot) return;
    setPromptOverride(bot.prompt_override || "");
    setResponseText(bot.welcome_message || "");
    maybePrefillFirstQuestion(bot.first_question || "");
    setIntroVideoUrl(bot.intro_video_url || "");
    setShowIntroVideo(!!bot.show_intro_video);
    setFormFillIntro(bot.formfill_intro || "");
    setTabsEnabled({
      demos: !!bot.show_browse_demos,
      docs: !!bot.show_browse_docs,
      meeting: !!bot.show_schedule_meeting,
      price: !!bot.show_price_estimate,
    });
    setPricingCopy({
      intro: bot.pricing_intro || "",
      outro: bot.pricing_outro || "",
      custom_notice: bot.pricing_custom_notice || "",
    });
  }

  useEffect(() => {
    if (!botId && !alias && !brandReady) setBrandReady(true);
  }, [botId, alias, brandReady]);

  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(
          `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`
        );
        const j = await r.json();
        if (cancel) return;
        if (j?.ok && j?.css_vars)
          setThemeVars((p) => ({ ...p, ...j.css_vars }));
        if (j?.ok && j?.assets) {
          setBrandAssets({
            logo_url: j.assets.logo_url || null,
            logo_light_url: j.assets.logo_light_url || null,
            logo_dark_url: j.assets.logo_dark_url || null,
          });
        }
      } catch {
      } finally {
        if (!cancel) setBrandReady(true);
      }
    })();
    return () => (cancel = true);
  }, [botId, apiBase]);

  /* =========================
   * FORM FILL CONFIG
   * ========================= */
  function patchCanonicalFields(rawFields) {
    const map = new Map();
    (rawFields || []).forEach((f) => {
      if (!f?.field_key) return;
      const canonical = FIELD_SYNONYMS[f.field_key] || f.field_key;
      const base = {
        ...f,
        field_key: canonical,
        label:
          CANON_LABELS[canonical] ||
          f.label ||
          canonical
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
      };
      const existing = map.get(canonical);
      if (!existing) {
        map.set(canonical, base);
      } else {
        existing.is_collected =
          existing.is_collected || base.is_collected;
        existing.is_required =
          existing.is_required || base.is_required;
        if (!existing.tooltip && base.tooltip) existing.tooltip = base.tooltip;
        if (!existing.placeholder && base.placeholder)
          existing.placeholder = base.placeholder;
        if (!existing.field_type && base.field_type)
          existing.field_type = base.field_type;
        if (!existing.options && base.options)
          existing.options = base.options;
      }
    });
    return [...map.values()];
  }

  async function fetchFormfillConfig(botIdArg, aliasArg) {
    try {
      const params = new URLSearchParams();
      if (botIdArg) params.set("bot_id", botIdArg);
      else if (aliasArg) params.set("alias", aliasArg);
      if (visitorId) params.set("visitor_id", visitorId);
      if (!params.toString()) return;
      const r = await fetch(
        `${apiBase}/formfill-config?${params.toString()}`
      );
      const j = await r.json();
      if (j?.ok) {
        const raw = Array.isArray(j.fields) ? j.fields : [];
        const visitorVals =
          (j.visitor_values &&
            typeof j.visitor_values === "object" &&
            j.visitor_values) ||
          {};
        if (visitorVals.perspective === "general")
          visitorVals.perspective = null;
        const patched = patchCanonicalFields(raw);
        setShowFormfill(!!j.show_formfill);
        setFormFields(
          patched.map((f) =>
            f.field_key === "perspective"
              ? {
                  ...f,
                  field_type: "single_select",
                  options:
                    f.options && f.options.length
                      ? f.options
                      : PERSPECTIVE_OPTIONS,
                }
              : f
          )
        );
        setVisitorDefaults(visitorVals);
      }
    } catch {}
  }

  useEffect(() => {
    if (botId) fetchFormfillConfig(botId, null);
  }, [botId]);
  useEffect(() => {
    if (!botId && alias) fetchFormfillConfig(null, alias);
  }, [alias, botId]);
  useEffect(() => {
    if (botId && visitorId) fetchFormfillConfig(botId, null);
  }, [visitorId, botId]);
  useEffect(() => {
    if (
      (mode === "formfill" || mode === "personalize") &&
      visitorId &&
      botId
    )
      refetchVisitorValues();
  }, [mode, visitorId, botId]);

  /* Derived form defaults (URL overrides) */
  const activeFormFields = useMemo(
    () =>
      (formFields || []).map((f) =>
        f.field_key === "perspective"
          ? {
              ...f,
              field_type: "single_select",
              options:
                f.options && f.options.length
                  ? f.options
                  : PERSPECTIVE_OPTIONS,
            }
          : f
      ),
    [formFields]
  );

  const formDefaults = useMemo(() => {
    const o = { ...(visitorDefaults || {}) };
    activeFormFields.forEach((f) => {
      const k = f.field_key;
      const urlVal = urlParams[k];
      if (typeof urlVal === "string" && urlVal.length) {
        o[k] = urlVal;
      }
    });
    if (o.perspective === undefined) o.perspective = null;
    if (typeof o.perspective === "string")
      o.perspective = o.perspective.toLowerCase();
    return o;
  }, [activeFormFields, visitorDefaults, urlParams]);

  /* =========================
   * ASK FLOW
   * ========================= */
  async function doSend(outgoing) {
    if (!outgoing || !botId) return;
    setMode("ask");
    setLastQuestion(outgoing);
    setInput("");
    setSelected(null);
    setResponseText("");
    setItems([]);
    setLoading(true);
    setLastError(null);

    const perspectiveForCall = visitorDefaults.perspective
      ? visitorDefaults.perspective.toLowerCase()
      : "general";

    const payload = withIdsBody({
      bot_id: botId,
      user_question: outgoing,
      scope: "standard",
      debug: true,
      perspective: perspectiveForCall,
      prompt_override: promptOverride || "",
    });

    try {
      const res = await axios.post(
        `${apiBase}/demo-hal`,
        payload,
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
            ...withIdsHeaders(),
          },
          validateStatus: () => true,
        }
      );
      const status = res.status;
      const data = res.data || {};
      const ok =
        data.ok !== false &&
        status >= 200 &&
        status < 300 &&
        typeof data.response_text === "string";
      if (!ok) {
        const msg =
          data.response_text ||
          data.message ||
          (status === 500
            ? "Internal server error"
            : `Request failed (${status})`);
        setResponseText(
          msg || "Sorry—something went wrong."
        );
        setLoading(false);
        setLastError({ status, data, payloadSent: payload });
        return;
      }
      const text = data.response_text || "";

      // NEW unified recommendation source:
      const demoBtns = Array.isArray(data.demo_buttons)
        ? data.demo_buttons
        : [];
      const docBtns = Array.isArray(data.doc_buttons)
        ? data.doc_buttons
        : [];
      const legacyItems = Array.isArray(data.items) ? data.items : [];
      const legacyButtons = Array.isArray(data.buttons)
        ? data.buttons
        : [];
      const combined =
        legacyItems.length > 0
          ? legacyItems
          : legacyButtons.length > 0
          ? legacyButtons
          : [...demoBtns, ...docBtns];

      let mapped = combined.map((it, idx) => ({
        id:
          it.id ??
          it.value ??
          it.url ??
          it.button_value ??
          it.button_id ??
          it.title ??
          String(idx),
        title:
          it.title ??
          it.button_title ??
          (typeof it.label === "string"
            ? it.label.replace(/^Watch the "(.+)" demo$/, "$1")
            : it.label) ??
          "",
        url:
          it.url ??
          it.value ??
          it.button_value ??
          "",
        description:
          it.description ??
          it.summary ??
          it.functions_text ??
          "",
        functions_text:
          it.functions_text ??
          it.description ??
          it.summary ??
          "",
        action: it.action ?? it.button_action ?? "demo",
      }));

      mapped = mapped.filter(Boolean);
      mapped = pruneDemoButtons(outgoing, mapped);

      // Perspective echo
      if (typeof data.perspective === "string" && data.perspective) {
        if (
          visitorDefaults.perspective !== null &&
          visitorDefaults.perspective !== undefined
        ) {
          updateLocalVisitorValues({
            perspective: data.perspective.toLowerCase(),
          });
        }
      }

      setItems(mapped);
      setResponseText(text);
      setLoading(false);

      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const fallback =
        data?.response_text ||
        data?.message ||
        (status
          ? `Request failed (HTTP ${status})`
          : "Network error");
      setResponseText(
        fallback.startsWith("Request failed")
          ? "Sorry—something went wrong."
          : fallback
      );
      setLastError({
        status,
        data,
        message: err.message,
        stack: err.stack,
        payloadSent: payload,
      });
      setItems([]);
      setLoading(false);
    }
  }

  function maybeOpenForm(next) {
    if (!showFormfill || activeFormFields.length === 0) return false;
    try {
      if (sessionStorage.getItem(FORM_KEY) === "1") {
        if (!formCompleted) setFormCompleted(true);
        return false;
      }
    } catch {}
    if (!formCompleted && !formShown) {
      setFormShown(true);
      setPending(next);
      setMode("formfill");
      return true;
    }
    return false;
  }

  async function onSendClick() {
    const outgoing = input.trim();
    if (!outgoing || !botId) return;
    if (maybeOpenForm({ type: "ask", payload: { text: outgoing } }))
      return;
    await doSend(outgoing);
  }

  function openPersonalize() {
    refetchVisitorValues();
    setPending(null);
    setMode("formfill");
    setFormShown(true);
  }

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

  async function _openBrowse() {
    if (!botId) return;
    setMode("browse");
    setSelected(null);
    try {
      const url = withIdsQS(
        `${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`
      );
      const r = await fetch(url, { headers: withIdsHeaders() });
      const j = await r.json();
      const src = Array.isArray(j?.items) ? j.items : [];
      setBrowseItems(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title:
            it.title ??
            it.button_title ??
            it.label ??
            "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description:
            it.description ??
            it.summary ??
            it.functions_text ??
            "",
          functions_text:
            it.functions_text ??
            it.description ??
            it.summary ??
            "",
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
      const r = await fetch(url, { headers: withIdsHeaders() });
      const j = await r.json();
      const src = Array.isArray(j?.items) ? j.items : [];
      setBrowseDocs(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title:
            it.title ??
            it.button_title ??
            it.label ??
            "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description:
            it.description ??
            it.summary ??
            it.functions_text ??
            "",
          functions_text:
            it.functions_text ??
            it.description ??
            it.summary ??
            "",
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

  async function _openMeeting() {
    if (!botId) return;
    setMode("meeting");
    try {
      const url =
        `${apiBase}/agent?bot_id=${encodeURIComponent(botId)}` +
        (agentAlias
          ? `&agent=${encodeURIComponent(agentAlias)}`
          : "");
      const r = await fetch(url);
      const j = await r.json();
      const ag = j?.ok ? j.agent : null;
      setAgent(ag);
      if (
        ag &&
        ag.calendar_link_type &&
        String(ag.calendar_link_type).toLowerCase() === "external" &&
        ag.calendar_link
      ) {
        try {
          const base = ag.calendar_link || "";
          const withQS =
            `${base}${base.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(
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

  function _openPrice() {
    if (!botId) return;
    setMode("price");
    setSelected(null);
  }
  function openPrice() {
    if (maybeOpenForm({ type: "price" })) return;
    _openPrice();
  }

  /* Calendly message listener */
  useEffect(() => {
    if (mode !== "meeting" || !botId || !sessionId || !visitorId)
      return;
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
            name:
              p.invitee?.full_name ??
              p.invitee?.name ??
              null,
          },
          questions_and_answers:
            p.questions_and_answers ??
            p.invitee?.questions_and_answers ??
            [],
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
    return () =>
      window.removeEventListener("message", onCalendlyMessage);
  }, [mode, botId, sessionId, visitorId, apiBase]);

  /* Autosize input (only for inlined bar if needed—kept for completeness) */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  /* =========================
   * PRICING LOGIC
   * ========================= */
  useEffect(() => {
    if (mode !== "price" || !botId) return;
    let cancel = false;
    (async () => {
      try {
        setPriceErr("");
        setPriceEstimate(null);
        setPriceAnswers({});
        const r = await fetch(
          `${apiBase}/pricing/questions?bot_id=${encodeURIComponent(
            botId
          )}`
        );
        const j = await r.json();
        if (cancel) return;
        if (!j?.ok) throw new Error();
        setPriceQuestions(
          Array.isArray(j.questions) ? j.questions : []
        );
        requestAnimationFrame(() =>
          contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
        );
        setPricingCopy((prev) => ({
          intro: j.pricing_intro || prev.intro,
          outro: j.pricing_outro || prev.outro,
          custom_notice:
            j.pricing_custom_notice || prev.custom_notice,
        }));
      } catch {
        if (!cancel) setPriceErr("Unable to load price estimator.");
      }
    })();
    return () => (cancel = true);
  }, [mode, botId, apiBase]);

  const nextPriceQuestion = useMemo(() => {
    if (!priceQuestions.length) return null;
    for (const q of priceQuestions) {
      if (
        (q.group ?? "estimation") !== "estimation" ||
        q.required === false
      )
        continue;
      const v = priceAnswers[q.q_key];
      const isMulti = String(q.type)
        .toLowerCase()
        .includes("multi");
      const empty = isMulti
        ? !(Array.isArray(v) && v.length > 0)
        : v === undefined || v === null || v === "";
      if (empty) return q;
    }
    return null;
  }, [priceQuestions, priceAnswers]);

  useEffect(() => {
    if (mode !== "price" || !botId || nextPriceQuestion) {
      setPriceEstimate((prev) =>
        nextPriceQuestion ? null : prev
      );
      return;
    }
    let cancel = false;
    (async () => {
      try {
        setPriceBusy(true);
        setPriceErr("");
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
        const r = await fetch(`${apiBase}/pricing/estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (cancel) return;
        if (!j?.ok) throw new Error();
        setPriceEstimate(j);
      } catch {
        if (!cancel) setPriceErr("Unable to compute estimate.");
      } finally {
        if (!cancel) setPriceBusy(false);
      }
    })();
    return () => (cancel = true);
  }, [
    mode,
    botId,
    apiBase,
    priceQuestions,
    priceAnswers,
    nextPriceQuestion,
    sessionId,
    visitorId,
  ]);

  function handlePickPriceOption(q, opt) {
    const isMulti = String(q?.type || "")
      .toLowerCase()
      .includes("multi");
    setPriceAnswers((prev) => {
      if (isMulti) {
        const curr = Array.isArray(prev[q.q_key])
          ? prev[q.q_key]
          : [];
        const exists = curr.includes(opt.key);
        const next = exists
          ? curr.filter((k) => k !== opt.key)
          : [...curr, opt.key];
        return { ...prev, [q.q_key]: next };
      }
      return { ...prev, [q.q_key]: opt.key };
    });
  }

  const mirrorLines = useMemo(() => {
    const labelFor = (q_key) => {
      const q = priceQuestions.find((qq) => qq.q_key === q_key);
      if (!q) return "";
      const ans = priceAnswers[q.q_key];
      if (
        ans == null ||
        ans === "" ||
        (Array.isArray(ans) && ans.length === 0)
      )
        return "";
      const opts = normalizeOptions(q);
      if (String(q.type).toLowerCase().includes("multi")) {
        const picked = Array.isArray(ans) ? ans : [];
        return opts
          .filter((o) => picked.includes(o.key))
          .map((o) => o.label)
          .join(", ");
      }
      const o = opts.find((o) => o.key === ans);
      return o?.label || String(ans);
    };
    if (typeof priceEstimate?.mirror_text === "string") {
      const t = priceEstimate.mirror_text.trim();
      if (t) return [t];
    }
    if (Array.isArray(priceEstimate?.mirror_text)) {
      const out = [];
      for (const m of priceEstimate.mirror_text) {
        const raw = String(m?.text || "").trim();
        if (!raw) continue;
        const lbl = labelFor(m?.q_key);
        const rep = raw
          .replace(/\{\{\s*answer_label_lower\s*\}\}/gi, lbl.toLowerCase())
          .replace(/\{\{\s*answer_label\s*\}\}/gi, lbl);
        out.push(rep);
      }
      return out.filter(Boolean);
    }
    if (!priceQuestions.length) return [];
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
        const rep = tmpl
          .replace(/\{\{\s*answer_label_lower\s*\}\}/gi, label.toLowerCase())
          .replace(/\{\{\s*answer_label\s*\}\}/gi, label);
        lines.push(rep);
      } else lines.push(label);
    }
    return lines;
  }, [priceEstimate, priceQuestions, priceAnswers]);

  /* =========================
   * SESSION END BEACON
   * ========================= */
  useEffect(() => {
    if (!sessionId) return;
    function sendEnd(reason = "unload") {
      try {
        const url = `${apiBase}/session/end`;
        const body = JSON.stringify({ session_id: sessionId, reason });
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon(url, blob);
        } else {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
        }
      } catch {}
    }
    function onPageHide() {
      sendEnd("pagehide");
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") sendEnd("hidden");
    }
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionId, apiBase]);

  /* =========================
   * TAB MODEL
   * ========================= */
  const tabs = useMemo(() => {
    const out = [];
    out.push({
      key: "personalize",
      label: "Personalize",
      onClick: openPersonalize,
    });
    if (tabsEnabled.demos)
      out.push({
        key: "demos",
        label: "Browse Demos",
        onClick: openBrowse,
      });
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
        onClick: openPrice,
      });
    if (tabsEnabled.meeting)
      out.push({
        key: "meeting",
        label: "Schedule Meeting",
        onClick: openMeeting,
      });
    return out;
  }, [tabsEnabled]);

  /* Live wording updates (if ThemeLab editing) – stub for now */
  function handleLiveMessages(updated) {
    if (!updated || typeof updated !== "object") return;
    if ("welcome_message" in updated)
      setResponseText(updated.welcome_message || "");
    if ("formfill_intro" in updated)
      setFormFillIntro(updated.formfill_intro || "");
    setPricingCopy((prev) => ({
      intro:
        "pricing_intro" in updated
          ? updated.pricing_intro || ""
          : prev.intro,
      outro:
        "pricing_outro" in updated
          ? updated.pricing_outro || ""
          : prev.outro,
      custom_notice:
        "pricing_custom_notice" in updated
          ? updated.pricing_custom_notice || ""
          : prev.custom_notice,
    }));
  }

  /* Derived lists */
  const logoSrc =
    brandAssets.logo_url ||
    brandAssets.logo_light_url ||
    brandAssets.logo_dark_url ||
    fallbackLogo;

  const listSource = mode === "browse" ? browseItems : items;
  const visibleUnderVideo = selected
    ? mode === "ask"
      ? items
      : []
    : listSource;

  const showAskBottom = mode !== "formfill";

  /* THEMELAB (Color/Wording) PANELS – lightweight inline placeholders
     (Detailed panels were previously in another step; for MVP we can skip, or
      you can reintroduce them similarly.) */

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
        className={[
          "w-screen min-h-[100dvh] flex items-center justify-center bg-[var(--page-bg)] p-4 transition-opacity duration-200",
          brandReady ? "opacity-100" : "opacity-0",
        ].join(" ")}
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
              Provide a <code>?bot_id=…</code> or <code>?alias=…</code>
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

  /* Form fill card transformation (placeholder pass) */
  const formFieldsForCard = activeFormFields.map((f) => {
    const ph =
      typeof f.tooltip === "string" && f.tooltip.trim()
        ? f.tooltip.trim()
        : f.placeholder || "";
    return { ...f, placeholder: ph };
  });

  return (
    <div
      className={[
        "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200",
        brandReady ? "opacity-100" : "opacity-0",
      ].join(" ")}
      style={liveTheme}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-[var(--card-bg)] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)] flex flex-col overflow-hidden transition-all">
        {/* Header */}
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] border-b border-[var(--border-default)]">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img
                src={logoSrc}
                alt="Brand logo"
                className="h-10 object-contain"
              />
            </div>
            <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">
              {selected
                ? selected.title
                : mode === "personalize" || mode === "formfill"
                ? "Personalize"
                : mode === "browse"
                ? "Browse Demos"
                : mode === "docs"
                ? "Browse Documents"
                : mode === "meeting"
                ? "Schedule Meeting"
                : mode === "price"
                ? "Price Estimate"
                : "Ask the Assistant"}
            </div>
          </div>
          <TabsNav
            mode={mode === "formfill" ? "personalize" : mode}
            tabs={tabs}
          />
        </div>

        {/* Main Scrollable Content */}
        <div
          ref={contentRef}
          className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto"
        >
          {mode === "formfill" || mode === "personalize" ? (
            <div className="space-y-4">
              {formFillIntro ? (
                <div className="text-base font-semibold whitespace-pre-line">
                  {formFillIntro}
                </div>
              ) : (
                <div className="text-base font-semibold">
                  Update your information below.
                </div>
              )}
              <FormFillCard
                fields={formFieldsForCard}
                defaults={formDefaults}
                onSubmit={async (vals) => {
                  if (!visitorId) {
                    setMode("ask");
                    return;
                  }
                  if (typeof vals.perspective === "string")
                    vals.perspective = vals.perspective.toLowerCase();
                  updateLocalVisitorValues(vals);
                  try {
                    await fetch(`${apiBase}/visitor-formfill`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        visitor_id: visitorId,
                        values: vals,
                        bot_id: botId || undefined,
                      }),
                    });
                  } catch {}
                  try {
                    sessionStorage.setItem(FORM_KEY, "1");
                  } catch {}
                  setFormCompleted(true);
                  const p = pending;
                  setPending(null);
                  if (p?.type === "ask" && p.payload?.text) {
                    await doSend(p.payload.text);
                  } else if (p?.type === "demos") await _openBrowse();
                  else if (p?.type === "docs") await _openBrowseDocs();
                  else if (p?.type === "meeting") await _openMeeting();
                  else if (p?.type === "price") _openPrice();
                  else setMode("ask");
                  if (!vals.perspective) refetchVisitorValues();
                }}
              />
            </div>
          ) : mode === "price" ? (
            <div className="flex-1 flex flex-col">
              <div className="pt-0 pb-0">
                <PriceMirror
                  lines={mirrorLines.length ? mirrorLines : [""]}
                />
                {!mirrorLines.length && (
                  <div className="text-base font-bold whitespace-pre-line">
                    {pricingCopy.intro ||
                      "This tool provides a quick estimate based on your selections. Final pricing may vary."}
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-4">
                {!priceQuestions.length ? (
                  <div className="text-sm text-[var(--helper-fg)]">
                    Loading questions…
                  </div>
                ) : nextPriceQuestion ? (
                  <QuestionBlock
                    q={nextPriceQuestion}
                    value={priceAnswers[nextPriceQuestion.q_key]}
                    onPick={handlePickPriceOption}
                  />
                ) : priceEstimate && priceEstimate.custom ? (
                  <div className="text-base font-bold whitespace-pre-line">
                    {pricingCopy.custom_notice ||
                      "We’ll follow up with a custom quote tailored to your selection."}
                  </div>
                ) : (
                  <EstimateCard
                    estimate={priceEstimate}
                    outroText={pricingCopy.outro || ""}
                  />
                )}
                {!nextPriceQuestion && priceBusy && (
                  <div className="text-sm text-[var(--helper-fg)]">
                    Calculating…
                  </div>
                )}
                {priceErr && (
                  <div className="text-sm text-red-600">
                    {priceErr}
                  </div>
                )}
              </div>
            </div>
          ) : mode === "meeting" ? (
            <div className="w-full flex-1 flex flex-col">
              {agent?.schedule_header && (
                <div className="text-sm italic text-[var(--helper-fg)] mb-3 whitespace-pre-line">
                  {agent.schedule_header}
                </div>
              )}
              {!agent ? (
                <div className="text-sm text-[var(--helper-fg)]">
                  Loading scheduling…
                </div>
              ) : agent.calendar_link_type &&
                String(agent.calendar_link_type).toLowerCase() ===
                  "embed" &&
                agent.calendar_link ? (
                <iframe
                  title="Schedule a Meeting"
                  src={`${agent.calendar_link}${
                    agent.calendar_link.includes("?") ? "&" : "?"
                  }embed_domain=${embedDomain}&embed_type=Inline&session_id=${encodeURIComponent(
                    sessionId || ""
                  )}&visitor_id=${encodeURIComponent(
                    visitorId || ""
                  )}&bot_id=${encodeURIComponent(
                    botId || ""
                  )}`}
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
                  We opened the scheduling page in a new tab. If it
                  didn’t open,&nbsp;
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
                                headers: {
                                  "Content-Type": "application/json",
                                },
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
                  {showIntroVideo && introVideoUrl && (
                    <div
                      style={{
                        position: "relative",
                        paddingTop: "56.25%",
                      }}
                    >
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
                  )}
                </div>
              )}
              {lastQuestion && (
                <p className="text-base italic text-center mb-2 text-[var(--helper-fg)]">
                  "{lastQuestion}"
                </p>
              )}
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
              {lastError && (
                <details className="mt-4 text-[11px] p-2 border border-red-300 rounded bg-red-50">
                  <summary className="cursor-pointer text-red-700 font-semibold">
                    Technical details
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-all">
{JSON.stringify(lastError, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {showAskBottom && (
          <AskInputBar
            value={input}
            onChange={setInput}
            onSend={onSendClick}
            inputRef={inputRef}
            placeholder="Ask your question here"
            showLogo={true}
          />
        )}
      </div>

      {/* (Optional) ThemeLab Panels could be reintroduced here if needed for MVP later */}
      {themeLabOn && false && botId && (
        <div className="hidden">
          {/* Placeholder: intentionally excluded for MVP minimal patch */}
        </div>
      )}
    </div>
  );
}
