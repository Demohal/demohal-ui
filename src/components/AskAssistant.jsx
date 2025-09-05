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
              {!priceQuestions?.length ? null : (
                <QuestionBlock
                  q={priceQuestions[0]}
                  value={priceAnswers[(priceQuestions[0] && priceQuestions[0].q_key) || "q0"]}
                  onPick={handlePickOption}
                />
              )}
              <EstimateCard estimate={priceEstimate} outroText={priceUiCopy?.outro?.body || ""} />
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
                            setSelected(val);
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
}
// [SECTION 4 END]

// [SECTION 7 BEGIN]
// Sections 5 & 6 are merged within the component to keep the file compact and compiling.
// [SECTION 7 END]
