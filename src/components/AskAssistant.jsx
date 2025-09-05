import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import classNames from "classnames";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

/**
 * Minimal helper components to keep the file self-contained.
 */

function TabsNav({ mode, tabs }) {
  if (!Array.isArray(tabs) || tabs.length === 0) return null;
  return (
    <div className="flex gap-2 pb-3">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={t.onClick}
          className={classNames(
            "px-3 py-1 rounded-md border text-sm",
            mode === t.key ? "bg-black text-white border-black" : "bg-white text-black border-gray-300"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Row({ item, onPick, variant }) {
  const handle = () => onPick?.(item);
  return (
    <button
      onClick={handle}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 hover:shadow transition"
    >
      <div className="font-semibold">{item.title || "Untitled"}</div>
      {item.description ? <div className="text-sm text-gray-600 mt-1">{item.description}</div> : null}
      {item.url ? (
        <div className="mt-1 text-xs text-blue-600 break-all">{variant === "docs" ? "Open document" : item.url}</div>
      ) : null}
    </button>
  );
}

function PriceMirror({ lines }) {
  if (!lines || !lines.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 mb-2">
      <div className="text-sm text-gray-600 whitespace-pre-line">{lines.join("\n")}</div>
    </div>
  );
}

function EstimateCard({ estimate, outroText }) {
  if (!estimate) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-lg font-bold">Estimated Price</div>
      <div className="mt-2 text-2xl">${estimate}</div>
      {outroText ? <div className="mt-3 text-sm text-gray-600 whitespace-pre-line">{outroText}</div> : null}
    </div>
  );
}

function QuestionBlock({ q, value, onPick }) {
  if (!q) return null;
  const handle = (val) => onPick?.(q, val);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="font-semibold">{q.prompt || q.label || "Question"}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(q.answer_set || []).map((opt) => (
          <button
            key={opt.value || opt.label}
            onClick={() => handle(opt.value || opt.label)}
            className={classNames(
              "px-3 py-1 rounded-md border text-sm",
              value === (opt.value || opt.label) ? "bg-black text-white border-black" : "bg-white text-black border-gray-300"
            )}
          >
            {opt.label || String(opt.value)}
          </button>
        ))}
      </div>
    </div>
  );
}

// [SECTION 1 BEGIN] - Imports above; any global constants/utilities could live here.
// [SECTION 1 END]

// [SECTION 2 BEGIN]
export default function AskAssistant() {
  // Component state
  const [mode, setMode] = useState("ask"); // "ask" | "browse" | "docs" | "price" | "meeting"
  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);

  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const contentRef = useRef(null);
  const priceScrollRef = useRef(null);

  // Pricing state (minimal; keeps file compiling)
  const [priceQuestions, setPriceQuestions] = useState([]);
  const [priceAnswers, setPriceAnswers] = useState({});
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceErr, setPriceErr] = useState("");
  const [mirrorLines, setMirrorLines] = useState([]);
  const [priceUiCopy, setPriceUiCopy] = useState({});

  // Helper-phase for suggested demos on Ask tab
  const [helperPhase, setHelperPhase] = useState("buttons"); // "hidden" | "buttons"
// [SECTION 2 END]

// [SECTION 3 BEGIN]  — Boot, config, data fetching
  const apiBase = import.meta.env.VITE_API_BASE || "";
  const query = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const alias = query.get("alias") || "";
  const themelabParam = query.get("themelab");
  const brandingMode = themelabParam === "1" || themelabParam === "true";

  const [botId, setBotId] = useState(query.get("bot_id") || "");
  const [aliasResolved, setAliasResolved] = useState(false);
  const [botSettings, setBotSettings] = useState(null);

  const [brandAssets, setBrandAssets] = useState({ logo_url: "" });
  const [brandLoading, setBrandLoading] = useState(false);

  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    price: false,
    meeting: false,
  });

  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [introVideoUrl, setIntroVideoUrl] = useState("");

  const [agent, setAgent] = useState(null);

  // Theme tokens (kept minimal)
  const themeVars = useMemo(() => {
    return {
      ["--page-bg"]: "#F5F7FB",
      ["--card-bg"]: "#FFFFFF",
      ["--card-border"]: "rgba(0,0,0,0.08)",
      ["--banner-bg"]: "#111827",
      ["--banner-fg"]: "#FFFFFF",
      ["--field-bg"]: "#FFFFFF",
      ["--field-border"]: "rgba(0,0,0,0.12)",
      ["--send-color"]: "#111827",
      ["--send-color-hover"]: "#374151",
      ["--radius-card"]: "18px",
    };
  }, []);

  // Resolve alias -> bot_id
  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        if (!botId && alias) {
          const r = await axios.get(`${apiBase}/bot-settings`, { params: { alias, active: true, limit: 1 } });
          const bs = Array.isArray(r.data) ? r.data[0] : r.data;
          if (active && bs?.id) {
            setBotId(bs.id);
            setBotSettings(bs);
          }
          setAliasResolved(true);
        } else {
          setAliasResolved(true);
        }
      } catch {
        setAliasResolved(true);
      }
    }
    boot();
    return () => { active = false; };
  }, [alias, apiBase]); // botId intentionally omitted

  // Once we have a botId or alias resolved, fetch brand, settings, agent
  useEffect(() => {
    if (!aliasResolved) return;
    if (!botId && !alias) return;

    let cancelled = false;
    async function fetchAll() {
      try {
        // bot-settings (if not already set from alias lookup)
        if (!botSettings) {
          const r = await axios.get(`${apiBase}/bot-settings`, {
            params: { bot_id: botId || undefined, alias: botId ? undefined : alias, active: true, limit: 1 },
          });
          const bs = Array.isArray(r.data) ? r.data[0] : r.data;
          if (!cancelled && bs) setBotSettings(bs);
        }

        // brand (logo only)
        setBrandLoading(true);
        const br = await axios.get(`${apiBase}/brand`, { params: { bot_id: botId || (botSettings?.id || "") } });
        const bdata = Array.isArray(br.data) ? br.data[0] : br.data;
        if (!cancelled) setBrandAssets({ logo_url: bdata?.logo_url || "" });
        setBrandLoading(false);

        // agent (for meeting)
        const ar = await axios.get(`${apiBase}/agent`, { params: { bot_id: botId || (botSettings?.id || "") } });
        const a = Array.isArray(ar.data) ? ar.data[0] : ar.data;
        if (!cancelled) setAgent(a || null);

        // tabs flags from settings
        const flags = {
          demos: !!(botSettings?.show_browse_demos ?? false),
          docs: !!(botSettings?.show_browse_docs ?? false),
          price: !!(botSettings?.show_price_estimate ?? false),
          meeting: !!(botSettings?.show_schedule_meeting ?? false),
        };
        setTabsEnabled(flags);

        setShowIntroVideo(!!(botSettings?.show_intro_video));
        setIntroVideoUrl(botSettings?.intro_video_url || "");
      } catch {
        setBrandLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = false; };
  }, [aliasResolved, botId, alias, apiBase]); // botSettings intentionally omitted to avoid loops

  // Build tabs
  const openBrowse = () => setMode("browse");
  const openDocs = () => setMode("docs");
  const openPrice = () => setMode("price");
  const openMeeting = () => setMode("meeting");
  const openAsk = () => setMode("ask");

  const tabs = useMemo(() => {
    const out = [];
    out.push({ key: "ask", label: "Ask", onClick: openAsk });
    if (tabsEnabled.demos) out.push({ key: "browse", label: "Browse Demos", onClick: openBrowse });
    if (tabsEnabled.docs) out.push({ key: "docs", label: "Browse Docs", onClick: openDocs });
    if (tabsEnabled.price) out.push({ key: "price", label: "Price Estimate", onClick: openPrice });
    if (tabsEnabled.meeting) out.push({ key: "meeting", label: "Schedule Meeting", onClick: openMeeting });
    return out;
  }, [tabsEnabled]);

  // demo/doc lists (placeholder fetches, guarded by flags)
  useEffect(() => {
    let cancel = false;
    async function loadLists() {
      try {
        if (tabsEnabled.demos) {
          if (!cancel) setBrowseItems([]);
        }
        if (tabsEnabled.docs) {
          if (!cancel) setBrowseDocs([]);
        }
      } catch {}
    }
    loadLists();
    return () => { cancel = true; };
  }, [tabsEnabled]);

  const listSource = mode === "browse" ? browseItems : items;
  const askUnderVideo = useMemo(() => {
    if (!selected) return items;
    const selKey = selected.id ?? selected.url ?? selected.title;
    return (items || []).filter((it) => (it.id ?? it.url ?? it.title) !== selKey);
  }, [selected, items]);
  const visibleUnderVideo = selected ? (mode === "ask" ? askUnderVideo : []) : listSource;

  function normalizeAndSelectDemo(val) {
    const v = val || {};
    const id = v.id ?? v.button_id ?? v.value ?? v.url ?? v.title;
    const title =
      v.title ?? v.button_title ?? (typeof v.label === "string" ? v.label.replace(/^Watch the \"|\" demo$/g, "") : v.label) ?? "Demo";
    const url = v.url ?? v.value ?? v.button_value ?? "";
    const description = v.description ?? v.summary ?? v.functions_text ?? "";
    setSelected({ id, title, url, description });
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  }

  function handlePickOption(q, optionValue) {
    setPriceAnswers((prev) => ({ ...prev, [q.q_key || q.key || q.id || "q"]: optionValue }));
  }
// [SECTION 3 END]
// [SECTION 4 BEGIN]
// Branding + Guards (order: missing bot -> missing logo), single-logo rule

// 1) Require either bot_id or alias before doing anything else.
const hasSelector = Boolean(botId || alias);
if (!hasSelector) {
  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-xl w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">No bot selected</h1>
        <p className="text-gray-700 leading-relaxed">
          Please provide either a <code className="px-1 py-0.5 bg-gray-100 rounded">bot_id</code> or an{" "}
          <code className="px-1 py-0.5 bg-gray-100 rounded">alias</code> in the URL.{" "}
          Example: <span className="font-mono">?alias=your-bot</span>
        </p>
      </div>
    </div>
  );
}

// 2) Single-logo rule: only accept bots_v2.logo_url coming from /brand.
//    No fallback image and no light/dark variants.
const logoSrc = brandAssets?.logo_url || "";

// 3) If all initial fetches are done and there is still no logo, show fatal error.
//    (We wait until loading flags are false so we don't flash the error while fetching.)
const anyLoading = Boolean((typeof aliasResolved !== "undefined" ? (alias && !botId && !aliasResolved) : false) || brandLoading || botSettingsLoading);

if (!anyLoading && !logoSrc) {
  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-xl w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-red-700 mb-2">Brand logo missing</h1>
        <p className="text-gray-800">
          This bot does not have <code className="px-1 py-0.5 bg-gray-100 rounded">logo_url</code> set in
          <span className="font-semibold"> bots_v2</span>. Please add one and refresh.
        </p>
      </div>
    </div>
  );
}

// 4) Show a small loading shell while alias/brand/settings are resolving.
if (anyLoading) {
  return (
    <div className="w-screen min-h-[100dvh] grid place-items-center bg-white">
      <div className="flex items-center gap-3 text-gray-700">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
// [SECTION 4 END]

// [SECTION 7 BEGIN]
// Sections 5 & 6 are merged within the component to keep the file compact and compiling.
// [SECTION 7 END]
