// [SECTION 1 BEGIN]

/* src/components/AskAssistant.jsx */

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
/* =============================== *
 *  PATCH-READY CONSTANTS & UTILS  *
 * =============================== */

/** Default CSS variable values (used until /brand loads). */
const DEFAULT_THEME_VARS = {
    // Page + card
    "--banner-bg": "#000000",
    "--banner-fg": "#FFFFFF",
    "--page-bg": "#F3F4F6",
    "--card-bg": "#FFFFFF",
    "--card-border": "#E5E7EB",
    "--radius-card": "1rem",
    "--shadow-card": "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",

    // Primary (demo) buttons
    "--btn-grad-from": "#485563",
    "--btn-grad-to": "#374151",
    "--btn-grad-from-hover": "#6B7280",
    "--btn-grad-to-hover": "#4B5563",
    "--btn-fg": "#FFFFFF",
    "--btn-border": "#374151",

    // Tabs
    "--tab-active-bg": "#FFFFFF",
    "--tab-active-fg": "#000000",
    "--tab-active-border": "#FFFFFF",
    "--tab-active-shadow": "0 2px 0 rgba(0,0,0,.15)",
    "--tab-inactive-grad-from": "#4B5563",
    "--tab-inactive-grad-to": "#374151",
    "--tab-inactive-hover-from": "#6B7280",
    "--tab-inactive-hover-to": "#4B5563",
    "--tab-inactive-fg": "#FFFFFF",
    "--tab-inactive-border": "#374151",

    // Fields
    "--field-bg": "#FFFFFF",
    "--field-border": "#9CA3AF",
    "--radius-field": "0.5rem",

    // Send icon
    "--send-color": "#EA4335",
    "--send-color-hover": "#C03327",

    // Docs buttons (lighter gradient than demos)
    "--btn-docs-grad-from": "#b1b3b4",
    "--btn-docs-grad-to": "#858789",
    "--btn-docs-grad-from-hover": "#c2c4c5",
    "--btn-docs-grad-to-hover": "#9a9c9e",
};

const UI = {
    CARD: "border rounded-xl p-4 bg-white shadow",
    BTN:
        "w-full text-center rounded-xl px-4 py-3 shadow transition-colors " +
        "text-[var(--btn-fg)] border " +
        "border-[var(--btn-border)] " +
        "bg-gradient-to-b from-[var(--btn-grad-from)] to-[var(--btn-grad-to)] " +
        "hover:from-[var(--btn-grad-from-hover)] hover:to-[var(--btn-grad-to-hover)]",
    BTN_DOCS:
        "w-full text-center rounded-xl px-4 py-3 shadow transition-colors " +
        "text-[var(--btn-fg)] border " +
        "border-[var(--btn-border)] " +
        "bg-gradient-to-b from-[var(--btn-docs-grad-from)] to-[var(--btn-docs-grad-to)] " +
        "hover:from-[var(--btn-docs-grad-from-hover)] hover:to-[var(--btn-docs-grad-to-hover)]",
    FIELD:
        "w-full rounded-lg px-4 py-3 text-base " +
        "bg-[var(--field-bg)] border border-[var(--field-border)]",
    TAB_ACTIVE:
        "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 " +
        "bg-[var(--tab-active-bg)] text-[var(--tab-active-fg)] border-[var(--tab-active-border)] -mb-px " +
        "shadow-[var(--tab-active-shadow)]",
    TAB_INACTIVE:
        "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 " +
        "text-[var(--tab-inactive-fg)] border-[var(--tab-inactive-border)] " +
        "bg-gradient-to-b from-[var(--tab-inactive-grad-from)] to-[var(--tab-inactive-grad-to)] " +
        "hover:from-[var(--tab-inactive-hover-from)] hover:to-[var(--tab-inactive-hover-to)] " +
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]",
};

const CFG = {
    qKeys: {
        product: ["edition", "editions", "product", "products", "industry_edition", "industry"],
        tier: ["transactions", "transaction_volume", "volume", "tier", "tiers"],
    },
};

const normKey = (s) => (s || "").toLowerCase().replace(/[\s-]+/g, "_");
const classNames = (...xs) => xs.filter(Boolean).join(" ");

function renderMirror(template, label) {
    if (!template) return null;
    return template
        .split("{{answer_label_lower}}")
        .join(label.toLowerCase())
        .split("{{answer_label}}")
        .join(label);
}

/* ========================== *
 *  SMALL PATCHABLE COMPONENTS *
 * ========================== */

function Row({ item, onPick, variant }) {
    const btnClass = variant === "docs" ? UI.BTN_DOCS : UI.BTN;
    return (
        <button data-patch="row-button" onClick={() => onPick(item)} className={btnClass} title={item.description || ""}>
            <div className="font-extrabold text-base">{item.title}</div>
            {item.description ? (
                <div className="mt-1 text-sm opacity-90">{item.description}</div>
            ) : item.functions_text ? (
                <div className="mt-1 text-sm opacity-90">{item.functions_text}</div>
            ) : null}
        </button>
    );
}

function OptionButton({ opt, selected, onClick }) {
    return (
        <button
            data-patch="option-button"
            onClick={() => onClick(opt)}
            className={classNames(UI.BTN, selected && "ring-2 ring-white/60")}
            title={opt.tooltip || ""}
        >
            <div className="font-extrabold text-base">{opt.label}</div>
            {opt.tooltip ? <div className="mt-1 text-sm opacity-90">{opt.tooltip}</div> : null}
        </button>
    );
}

function PriceMirror({ lines }) {
    if (!lines?.length) return null;
    return (
        <div data-patch="price-mirror" className="mb-3">
            {lines.map((ln, i) => (
                <div key={i} className="text-base italic text-gray-700 whitespace-pre-line">
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
                    <div className="text-black font-bold text-lg">Your Estimate</div>
                    <div className="text-black font-bold text-lg">
                        {estimate.currency_code} {Number(estimate.total_min).toLocaleString()} – {estimate.currency_code}{" "}
                        {Number(estimate.total_max).toLocaleString()}
                    </div>
                </div>
                <div className="space-y-3">
                    {(estimate.line_items || []).map((li) => (
                        <div key={li.product.id} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div className="text-black font-bold">{li.product.name}</div>
                                <div className="text-black font-bold text-lg">
                                    {li.currency_code} {Number(li.price_min).toLocaleString()} – {li.currency_code}{" "}
                                    {Number(li.price_max).toLocaleString()}
                                </div>
                            </div>
                            {Array.isArray(li.features) && li.features.length > 0 && (
                                <div className="mt-2">
                                    {li.features
                                        .filter((f) => f.is_standard)
                                        .map((f, idx) => (
                                            <span
                                                key={`${li.product.id}-${idx}`}
                                                className="inline-block text-xs border border-gray-300 rounded-full px-2 py-0.5 mr-1 mb-1"
                                            >
                                                {f.name}
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {outroText ? <div className="mt-3 text-black text-base font-bold whitespace-pre-line">{outroText}</div> : null}
        </div>
    );
}

// [SECTION 1 END]
// [SECTION 2 BEGIN]

// Component state & refs (INTENTIONALLY excludes apiBase/alias/botId/brandAssets/tabsEnabled/introVideo)
const [mode, setMode] = useState("ask"); // "ask" | "browse" | "docs" | "price" | "meeting"
const [items, setItems] = useState([]);
const [browseItems, setBrowseItems] = useState([]);
const [browseDocs, setBrowseDocs] = useState([]);
const [selected, setSelected] = useState(null);

const [lastQuestion, setLastQuestion] = useState("");
const [responseText, setResponseText] = useState("");
const [loading, setLoading] = useState(false);

const inputRef = useRef(null);
const contentRef = useRef(null);
const priceScrollRef = useRef(null);

// Pricing state (does not duplicate brand/tabs/bot vars)
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
// [SECTION 3 BEGIN]

// ------------------------------
// Data fetching & derived flags
// ------------------------------

const apiBase = import.meta.env.VITE_API_BASE || "";
const query = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
const alias = query.get("alias") || "";
const themelabParam = query.get("themelab");
const brandingMode = themelabParam === "1" || themelabParam === "true";

const [botId, setBotId] = useState(query.get("bot_id") || "");
const [aliasResolved, setAliasResolved] = useState(false); // prevents double /bot-settings
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

// Resolve alias -> bot_id for endpoints that require id (e.g., /brand, pricing, etc)
useEffect(() => {
  if (botId || !alias) return;
  let cancelled = false;
  (async () => {
    try {
      const res = await axios.get(`${apiBase}/id`, { params: { alias } });
      const id = res?.data?.id || "";
      if (!cancelled && id) {
        setBotId(id);
        setAliasResolved(true);
      }
    } catch {
      /* noop */
    }
  })();
  return () => {
    cancelled = true;
  };
}, [alias, botId]);

// Fetch bot settings ONCE: prefer bot_id; if not yet resolved, use alias.
// When alias later resolves to bot_id, avoid a second fetch by checking aliasResolved.
useEffect(() => {
  const param =
    botId ? { bot_id: botId } : !aliasResolved && alias ? { alias } : null;
  if (!param) return;

  let cancelled = false;
  (async () => {
    try {
      const res = await axios.get(`${apiBase}/bot-settings`, { params: param });
      if (cancelled) return;
      const data = res?.data || {};
      setBotSettings(data);

      const flags = {
        demos: !!data?.show_browse_demos || !!data?.has_demos,
        docs: !!data?.show_browse_docs || !!data?.has_docs,
        price: !!data?.show_price_estimate,
        meeting: !!data?.show_schedule_meeting,
      };
      setTabsEnabled(flags);

      setShowIntroVideo(!!data?.show_intro_video && !!data?.intro_video_url);
      setIntroVideoUrl((data?.intro_video_url || "").trim());
    } catch {
      /* noop */
    }
  })();

  return () => {
    cancelled = true;
  };
}, [apiBase, botId, alias, aliasResolved]);

// Fetch brand (logo + tokens) — requires bot_id
useEffect(() => {
  if (!botId) return;
  let cancelled = false;
  setBrandLoading(true);

  (async () => {
    try {
      const res = await axios.get(`${apiBase}/brand`, { params: { bot_id: botId } });
      if (cancelled) return;
      const data = res?.data || {};
      const assets = data?.assets || {};
      setBrandAssets({
        logo_url: assets?.logo_url || "",
      });
      // tokens if needed: data?.tokens
    } catch {
      setBrandAssets({ logo_url: "" });
    } finally {
      if (!cancelled) setBrandLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [apiBase, botId]);

// [SECTION 3 END]

/ [SECTION 4 BEGIN]

  const showAskBottom = mode !== "price" || !!priceEstimate;
  const embedDomain = typeof window !== "undefined" ? window.location.hostname : "";

  // If there is no bot selected (no bot_id and no alias), show that message FIRST and stop.
  if (!botId && !alias) {
    return (
      <div
        className={classNames(
          "w-screen min-h-[100dvh] flex items-center justify-center bg-[var(--page-bg)] p-4"
        )}
        style={themeVars}
      >
        <div className="max-w-[720px] w-full bg-white border border-[var(--card-border)] rounded-xl shadow p-6 text-center">
          <div className="text-lg font-semibold mb-2">No bot selected</div>
          <div className="text-sm text-gray-700">
            Provide a <code className="px-1 py-0.5 bg-gray-100 rounded border">?bot_id=…</code> or{" "}
            <code className="px-1 py-0.5 bg-gray-100 rounded border">?alias=…</code> in the URL.
          </div>
        </div>
      </div>
    );
  }

  // Single logo from bots_v2 only; no fallback.
  const logoSrc = brandAssets.logo_url || "";

  // If the bot has no logo_url configured, show an error and stop rendering (AFTER bot presence check).
  if (!logoSrc) {
    return (
      <div
        className={classNames(
          "w-screen min-h-[100dvh] flex items-center justify-center bg-[var(--page-bg)] p-4"
        )}
        style={themeVars}
      >
        <div className="max-w-[720px] w-full bg-white border border-[var(--card-border)] rounded-xl shadow p-6 text-center">
          <div className="text-lg font-semibold text-red-600 mb-2">Brand logo missing</div>
          <div className="text-sm text-gray-700">
            This bot does not have a logo configured. Please add a{" "}
            <code className="px-1 py-0.5 bg-gray-100 rounded border">logo_url</code> in <code>bots_v2</code> for this bot.
          </div>
        </div>
      </div>
    );
  }

  // Moved here from Section 5 so it closes over component state/vars.
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
        { bot_id: botId, user_question: outgoing },
        { timeout: 30000 }
      );
      const data = res?.data || {};

      const text = data?.response_text || "";
      const recSource = Array.isArray(data?.items) ? data.items : Array.isArray(data?.buttons) ? data.buttons : [];

      const recs = (Array.isArray(recSource) ? recSource : [])
        .map((it) => {
          const id = it.id ?? it.button_id ?? it.value ?? it.url ?? it.title;
          const title =
            it.title ??
            it.button_title ??
            (typeof it.label === "string" ? it.label.replace(/^Watch the \"|\" demo$/g, "") : it.label) ??
            "";
          const url = it.url ?? it.value ?? it.button_value ?? "";
          const description = it.description ?? it.summary ?? it.functions_text ?? "";
          const action = it.action ?? it.button_action ?? "demo";
          return { id, title, url, description, functions_text: it.functions_text ?? description, action };
        })
        .filter((b) => {
          const act = (b.action || "").toLowerCase();
          const lbl = (b.title || "").toLowerCase();
          return act !== "continue" && act !== "options" && lbl !== "continue" && lbl !== "show me options";
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

      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setLoading(false);
      setResponseText("Sorry—something went wrong.");
      setHelperPhase("hidden");
      setItems([]);
    }
  }

  return (
    <div
      className={classNames(
        "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center"
      )}
      style={themeVars}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-[var(--card-bg)] border border-[var(--card-border)] md:rounded-[var(--radius-card)] [box-shadow:var(--shadow-card)] flex flex-col overflow-hidden transition-all duration-300">
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
                <div className="text-black text-base font-bold whitespace-pre-line">
                  {((priceUiCopy?.intro?.heading || "").trim() ? `${priceUiCopy.intro.heading.trim()}\n\n` : "") +
                    (priceUiCopy?.intro?.body ||
                      "This tool provides a quick estimate based on your selections. Final pricing may vary by configuration, usage, and implementation.")}
                </div>
              ) : null}
            </div>
            <div ref={priceScrollRef} className="px-6 pt-0 pb-6 flex-1 overflow-y-auto">
              {!priceQuestions?.length ? null : nextPriceQuestion ? (
                <QuestionBlock q={nextPriceQuestion} value={priceAnswers[nextPriceQuestion.q_key]} onPick={handlePickOption} />
              ) : (
                <EstimateCard
                  estimate={priceEstimate}
                  outroText={
                    ((priceUiCopy?.outro?.heading || "").trim() ? `${priceUiCopy.outro.heading.trim()}\n\n` : "") +
                    (priceUiCopy?.outro?.body || "")
                  }
                />
              )}
              {priceBusy ? <div className="mt-2 text-sm text-gray-500">Calculating…</div> : null}
              {priceErr ? <div className="mt-2 text-sm text-red-600">{priceErr}</div> : null}
            </div>
          </>
        ) : (
          /* OTHER MODES */
          <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
            {mode === "meeting" ? (
              <div className="w-full flex-1 flex flex-col" data-patch="meeting-pane">
                <div className="bg-white pt-2 pb-2">
                  {agent?.schedule_header ? (
                    <div className="mb-2 text-sm italic text-gray-600 whitespace-pre-line">{agent.schedule_header}</div>
                  ) : null}

                  {/* calendar_link_type handling */}
                  {!agent ? (
                    <div className="text-sm text-gray-600">Loading scheduling…</div>
                  ) : agent.calendar_link_type && String(agent.calendar_link_type).toLowerCase() === "embed" && agent.calendar_link ? (
                    <iframe
                      title="Schedule a Meeting"
                      src={`${agent.calendar_link}?embed_domain=${embedDomain}&embed_type=Inline`}
                      style={{ width: "100%", height: "60vh", maxHeight: "640px" }}
                      className="rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                    />
                  ) : agent.calendar_link_type && String(agent.calendar_link_type).toLowerCase() === "external" && agent.calendar_link ? (
                    <div className="text-sm text-gray-700">
                      We opened the scheduling page in a new tab. If it didn’t open,&nbsp;
                      <a href={agent.calendar_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        click here to open it
                      </a>.
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">No scheduling link is configured.</div>
                  )}
                </div>
              </div>
            ) : selected ? (
              <div className="w-full flex-1 flex flex-col">
                {mode === "docs" ? (
                  <div className="bg-white pt-2 pb-2">
                    <iframe
                      className="w-full h-[65vh] md:h-[78vh] rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                      src={selected.url}
                      title={selected.title}
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                ) : (
                  <div className="bg-white pt-2 pb-2">
                    <iframe
                      style={{ width: "100%", aspectRatio: "471 / 272" }}
                      src={selected.url}
                      title={selected.title}
                      className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {mode === "ask" && (visibleUnderVideo || []).length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-1 mb-3">
                      <p className="italic text-gray-600">Recommended demos</p>
                      <span />
                    </div>
                    <div className="flex flex-col gap-3">
                      {visibleUnderVideo.map((it) => (
                        <Row key={it.id || it.url || it.title} item={it} onPick={(val) => normalizeAndSelectDemo(val)} />
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
                      <p className="italic text-gray-600">Select a demo to view it</p>
                      <span />
                    </div>
                    <div className="flex flex-col gap-3">
                      {browseItems.map((it) => (
                        <Row key={it.id || it.url || it.title} item={it} onPick={(val) => normalizeAndSelectDemo(val)} />
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
                      <p className="italic text-gray-600">Select a document to view it</p>
                      <span />
                    </div>
                    <div className="flex flex-col gap-3">
                      {browseDocs.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          variant="docs"
                          onPick={(val) => {
                            setSelected(val); // docs pass through without normalization
                            requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
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
                    <div className="text-black text-base font-bold whitespace-pre-line">{responseText}</div>
                    {showIntroVideo && introVideoUrl ? (
                      <div style={{ position: "relative", paddingTop: "56.25%" }}>
                        <iframe
                          src={introVideoUrl}
                          title="Intro Video"
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
                {lastQuestion ? <p className="text-base text-black italic text-center mb-2">"{lastQuestion}"</p> : null}
                <div className="text-left mt-2">
                  {loading ? (
                    <p className="text-gray-500 font-semibold animate-pulse">Thinking…</p>
                  ) : lastQuestion ? (
                    <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                  ) : null}
                </div>
                {helperPhase !== "hidden" && (
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <p className="italic text-gray-600">Recommended demos</p>
                    <span />
                  </div>
                )}
                {helperPhase === "buttons" && (items || []).length > 0 && (
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <Row key={it.id || it.url || it.title} item={it} onPick={(val) => normalizeAndSelectDemo(val)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Ask Bar */}
        <div className="px-4 py-3 border-t border-gray-200" data-patch="ask-bottom-bar">
          {showAskBottom ? (
            <div className="relative w-full">
              <textarea
                ref={inputRef}
                rows={1}
                className="w-full border border-[var(--field-border)] rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--field-bg)]"
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
              <button aria-label="Send" onClick={sendMessage} className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95">
                <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:text-[var(--send-color-hover)]" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

// [SECTION 4 END]

// [SECTION 5 BEGIN]
// (merged into Section 4 — no additional code in this section)
// [SECTION 5 END]

// [SECTION 6 BEGIN]
// (merged into Section 4 — no additional code in this section)
// [SECTION 6 END]

// [SECTION 7 BEGIN]
export default AskAssistant;
// [SECTION 7 END]
