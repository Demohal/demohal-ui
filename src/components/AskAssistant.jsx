/* src/components/AskAssistant.jsx */

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

/* Browse/demo/document row button */
function Row({ item, onPick }) {
  return (
    <button
      onClick={() => onPick(item)}
      className="w-full text-center bg-gradient-to-b from-gray-600 to-gray-700 text-white rounded-xl border border-gray-700 px-4 py-3 shadow hover:from-gray-500 hover:to-gray-600 transition-colors"
      title={item.description || ""}
    >
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.description ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{item.description}</div>
      ) : item.functions_text ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{item.functions_text}</div>
      ) : null}
    </button>
  );
}

/* Small pill for standard features */
function Pill({ children }) {
  return (
    <span className="inline-block text-xs border border-gray-300 rounded-full px-2 py-0.5 mr-1 mb-1">
      {children}
    </span>
  );
}

/* Pricing options styled like Browse buttons (one per row, tooltip line under label) */
function OptionButton({ opt, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(opt)}
      className={[
        "w-full text-center bg-gradient-to-b from-gray-600 to-gray-700 text-white rounded-xl",
        "border border-gray-700 px-4 py-3 shadow hover:from-gray-500 hover:to-gray-600 transition-colors",
        selected ? "ring-2 ring-white/60" : "",
      ].join(" ")}
      title={opt.tooltip || ""}
    >
      <div className="font-extrabold text-xs sm:text-sm">{opt.label}</div>
      {opt.tooltip ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{opt.tooltip}</div>
      ) : null}
    </button>
  );
}

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  const [botId, setBotId] = useState("");
  const [fatal, setFatal] = useState("");

  // Modes: ask | browse | docs | price | meeting
  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState(
    "Welcome to DemoHAL where you can Let Your Product Sell Itself. From here you can ask technical or business related questions, watch short video demos based on your interest, review the document library for technical specifications, case studies, and other materials, book a meeting, or even get a  price quote. You can get started by watching this short video, or simply by asking your first question."
  );
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]);             // Ask recommendations
  const [browseItems, setBrowseItems] = useState([]); // Browse demos
  const [browseDocs, setBrowseDocs] = useState([]);   // Browse docs
  const [selected, setSelected] = useState(null);

  // Helper phasing for Ask: "hidden" → "header" → "buttons"
  const [helperPhase, setHelperPhase] = useState("hidden");

  const [isAnchored, setIsAnchored] = useState(false);
  const contentRef = useRef(null);     // main scroll area for non-price modes
  const priceScrollRef = useRef(null); // scroll area for price questions/estimate

  // --------------------------
  // Pricing state (isolated)
  // --------------------------
  const [priceUiCopy, setPriceUiCopy] = useState({});
  const [priceQuestions, setPriceQuestions] = useState([]);
  const [priceAnswers, setPriceAnswers] = useState({});
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceErr, setPriceErr] = useState("");

  // Agent (for meeting tab)
  const [agent, setAgent] = useState(null);

  const nextPriceQuestion = useMemo(() => {
    if (!priceQuestions?.length) return null;
    for (const q of priceQuestions) {
      const val = priceAnswers[q.q_key];
      const empty =
        (q.type === "multi_choice" && Array.isArray(val) && val.length === 0) ||
        val === undefined ||
        val === null ||
        val === "";
      if (empty) return q;
    }
    return null;
  }, [priceQuestions, priceAnswers]);

  const haveAllEstimationAnswers = useMemo(() => {
    if (!priceQuestions?.length) return false;
    const requiredEstimation = priceQuestions.filter((q) => q.group === "estimation" && q.required !== false);
    if (requiredEstimation.length === 0) return false;
    return requiredEstimation.every((q) => {
      const v = priceAnswers[q.q_key];
      return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
    });
  }, [priceQuestions, priceAnswers]);

  // Autosize the question box (Ask tab)
  const inputRef = useRef(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Resolve alias — support alias and alais; default to demo
  const alias = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return (qs.get("alias") || qs.get("alais") || "demo").trim();
  }, []);

  /* Utility: extract bot id from various shapes */
  function extractBotId(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.bot && payload.bot.id) return payload.bot.id;
    if (payload.id) return payload.id;
    if (payload.data && payload.data.id) return payload.data.id;
    if (Array.isArray(payload.data) && payload.data[0] && payload.data[0].id) return payload.data[0].id;
    if (Array.isArray(payload.rows) && payload.rows[0] && payload.rows[0].id) return payload.rows[0].id;
    return null;
  }

  /* Normalize items for list rendering */
  function normalizeList(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it) => {
        const id = it.id ?? it.button_id ?? it.value ?? it.url ?? it.title;
        const title =
          it.title ??
          it.button_title ??
          (typeof it.label === "string" ? it.label.replace(/^Watch the \"|\" demo$/g, "") : it.label) ??
          "";
        const url = it.url ?? it.value ?? it.button_value ?? "";
        const description = it.description ?? it.summary ?? it.functions_text ?? "";
        return {
          id,
          title,
          url,
          description,
          functions_text: it.functions_text ?? description,
          action: it.action ?? it.button_action ?? "demo",
          label: it.label ?? it.button_label ?? (title ? `Watch the "${title}" demo` : ""),
        };
      })
      .filter((x) => x.title && x.url);
  }

  // Load bot by alias
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (cancel) return;
        const id = extractBotId(data);
        if (id) {
          setBotId(id);
          setFatal("");
        } else if (!res.ok || data?.ok === false) {
          setFatal("Invalid or inactive alias.");
        } else {
          console.warn("/bot-by-alias returned unexpected shape", data);
          setBotId("");
        }
      } catch (e) {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase]);

  // Release anchor on scroll (video/doc view)
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !selected) return;
    const onScroll = () => {
      if (el.scrollTop > 8 && isAnchored) setIsAnchored(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [selected, isAnchored]);

  // --------------------------
  // Pricing: load questions
  // --------------------------
  useEffect(() => {
    if (mode !== "price" || !botId) return;
    let cancel = false;
    (async () => {
      try {
        setPriceErr("");
        setPriceEstimate(null);
        setPriceAnswers({});
        const res = await fetch(`${apiBase}/pricing/questions?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json();
        if (cancel) return;
        if (!data?.ok) throw new Error(data?.error || "Failed to load pricing questions");
        setPriceUiCopy(data.ui_copy || {});
        setPriceQuestions(Array.isArray(data.questions) ? data.questions : []);
        requestAnimationFrame(() => priceScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
      } catch (e) {
        if (!cancel) setPriceErr("Unable to load price estimator.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode, botId, apiBase]);

  // Pricing: compute estimate when ready
  useEffect(() => {
    if (mode !== "price" || !botId) return;
    if (!haveAllEstimationAnswers) {
      setPriceEstimate(null);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        setPriceBusy(true);
        const res = await fetch(`${apiBase}/pricing/estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botId, answers: priceAnswers }),
        });
        const data = await res.json();
        if (cancel) return;
        if (!data?.ok) throw new Error(data?.error || "Failed to compute estimate");
        setPriceEstimate(data);
      } catch (e) {
        if (!cancel) setPriceErr("Unable to compute estimate.");
      } finally {
        if (!cancel) setPriceBusy(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode, botId, apiBase, haveAllEstimationAnswers, priceAnswers]);

  /* Handle clicking an option */
  function handlePickOption(q, opt) {
    setPriceAnswers((prev) => {
      if (q.type === "multi_choice") {
        const curr = Array.isArray(prev[q.q_key]) ? prev[q.q_key] : [];
        const exists = curr.includes(opt.key);
        const next = exists ? curr.filter((k) => k !== opt.key) : [...curr, opt.key];
        return { ...prev, [q.q_key]: next };
      } else {
        return { ...prev, [q.q_key]: opt.key };
      }
    });
  }

  // --------------------------
  // Price panels
  // --------------------------
  function PriceTop() {
    const intro = priceUiCopy?.intro || {};
    const heading = (intro.heading || "").trim();
    const body = (
      intro.body ||
      "This tool provides a quick estimate based on your selections. Final pricing may vary by configuration, usage, and implementation."
    ).trim();
    const introText = heading ? `${heading}\n\n${body}` : body;

    // Build mirror lines from answered questions using optional mirror_template
    // Tokens supported: {{answer_label}} and {{answer_label_lower}}
    const norm = (s) => (s || "").toLowerCase().replace(/[\s-]+/g, "_");

    const mirrorLines = [];
    for (const q of priceQuestions) {
      const ans = priceAnswers[q.q_key];
      if (ans === undefined || ans === null || ans === "" || (Array.isArray(ans) && ans.length === 0)) continue;

      const opts = q.options || [];
      let label = "";
      if (q.type === "choice") {
        const o = opts.find((o) => o.key === ans);
        label = o?.label || String(ans);
      } else if (q.type === "multi_choice") {
        const picked = Array.isArray(ans) ? ans : [];
        label = opts.filter((o) => picked.includes(o.key)).map((o) => o.label).join(", ");
      } else {
        label = String(ans);
      }
      if (!label) continue;

      let line = "";
      if (q.mirror_template) {
        line = (q.mirror_template + "")
          .split("{{answer_label_lower}}").join(label.toLowerCase())
          .split("{{answer_label}}").join(label);
      } else {
        if (["edition","editions","product","products","industry_edition","industry"].includes(norm(q.q_key))) {
          line = `You have selected ${label}.`;
        } else if (["transactions","transaction_volume","volume","tier","tiers"].includes(norm(q.q_key))) {
          line = `You stated that you execute ${label.toLowerCase()} commercial transactions per month.`;
        }
      }
      if (line) mirrorLines.push(line);
    }

    if (mirrorLines.length > 0) {
      return (
        <div className="w-full">
          <div className="mb-3">
            {mirrorLines.map((ln, idx) => (
              <div key={idx} className="text-base italic text-gray-700 whitespace-pre-line">{ln}</div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="mb-3">
          <div className="text-black text-base font-bold whitespace-pre-line">{introText}</div>
        </div>
      </div>
    );
  }

  function PriceBottomBox() {
    const q = nextPriceQuestion;

    if (!priceQuestions?.length) {
      return null; // fully remove loading container
    }

    // When all questions are answered, show the estimate card (no loading placeholder)
    if (!q) {
      const outro = priceUiCopy?.outro || {};
      const outroHeading = (outro.heading || "").trim();
      const outroBody = (outro.body || "").trim();
      const outroText = outroHeading ? `${outroHeading}\n\n${outroBody}` : outroBody;

      return (
        <div className="relative w-full">
          {priceEstimate ? (
            <>
              <div className="border rounded-xl p-4 bg-white shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-black font-bold text-lg">Your Estimate</div>
                  <div className="text-black font-bold text-lg">
                    {priceEstimate.currency_code} {priceEstimate.total_min.toLocaleString()} –{" "}
                    {priceEstimate.currency_code} {priceEstimate.total_max.toLocaleString()}
                  </div>
                </div>

                <div className="space-y-3">
                  {Array.isArray(priceEstimate.line_items) &&
                    priceEstimate.line_items.map((li) => (
                      <div key={li.product.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-black font-bold">{li.product.name}</div>
                          <div className="text-black font-bold text-lg">
                            {li.currency_code} {li.price_min.toLocaleString()} – {li.currency_code}{" "}
                            {li.price_max.toLocaleString()}
                          </div>
                        </div>
                        {Array.isArray(li.features) && li.features.length > 0 && (
                          <div className="mt-2">
                            {li.features
                              .filter((f) => f.is_standard)
                              .map((f, idx) => (
                                <Pill key={`${li.product.id}-${idx}`}>{f.name}</Pill>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {outroText ? (
                <div className="mt-3 text-black text-base font-bold whitespace-pre-line">{outroText}</div>
              ) : null}
            </>
          ) : null}
        </div>
      );
    }

    const currentVal = priceAnswers[q.q_key];

    return (
      <div className="relative w-full">
        <div className="w-full border border-gray-400 rounded-lg px-4 py-3 text-base bg-white">
          {/* QUESTION SIZE bumped one step up (sm → base) */}
          <div className="text-black font-bold text-base">{q.prompt}</div>
          {q.help_text ? <div className="text-xs text-black italic mt-1">{q.help_text}</div> : null}

          {Array.isArray(q.options) && q.options.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3">
              {q.options.map((opt) => (
                <OptionButton
                  key={opt.key || opt.id}
                  opt={opt}
                  selected={
                    q.type === "multi_choice"
                      ? Array.isArray(currentVal) && currentVal.includes(opt.key)
                      : currentVal === opt.key
                  }
                  onClick={handlePickOption.bind(null, q)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-gray-600">No options available.</div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------
  // Core Ask flow
  // --------------------------
  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();

    setMode("ask");
    setLastQuestion(outgoing);
    setInput("");
    setSelected(null);
    setIsAnchored(false);
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
      const recs = normalizeList(recSource);

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
    } catch (e) {
      setLoading(false);
      setResponseText("Sorry—something went wrong.");
      setHelperPhase("hidden");
      setItems([]);
    }
  }

  async function openBrowse() {
    if (!botId) return;
    setMode("browse");
    setSelected(null);
    try {
      const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : Array.isArray(data?.buttons) ? data.buttons : [];
      setBrowseItems(normalizeList(src));
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setBrowseItems([]);
    }
  }

  async function openBrowseDocs() {
    if (!botId) return;
    setMode("docs");
    setSelected(null);
    try {
      const res = await fetch(`${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : Array.isArray(data?.buttons) ? data.buttons : [];
      setBrowseDocs(normalizeList(src));
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setBrowseDocs([]);
    }
  }

  async function openMeeting() {
    if (!botId) return;
    setSelected(null);
    setMode("meeting");
    try {
      const res = await fetch(`${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      setAgent(data?.ok ? data.agent : null);
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setAgent(null);
    }
  }

  const listSource = mode === "browse" ? browseItems : items;

  const askUnderVideo = useMemo(() => {
    if (!selected) return items;
    const selKey = selected.id ?? selected.url ?? selected.title;
    return (items || []).filter((it) => (it.id ?? it.url ?? it.title) !== selKey);
  }, [selected, items]);

  const visibleUnderVideo = selected ? (mode === "ask" ? askUnderVideo : []) : listSource;

  // Tabs (Removed Finished)
  const tabs = [
    { key: "demos", label: "Browse Demos", onClick: openBrowse },
    { key: "docs", label: "Browse Documents", onClick: openBrowseDocs },
    { key: "price", label: "Price Estimate", onClick: () => { setSelected(null); setMode("price"); } },
    { key: "meeting", label: "Schedule Meeting", onClick: openMeeting },
  ];

  if (fatal) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-red-600 font-semibold">{fatal}</div>
      </div>
    );
  }
  if (!botId) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-gray-700">Loading…</div>
      </div>
    );
  }

  // Show standard Ask bottom when not in price OR once estimate exists
  const showAskBottom = mode !== "price" || !!priceEstimate;

  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div
        className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300"
        style={{ width: "min(720px, 100vw - 16px)", minHeight: 450, maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="bg-black text-white px-4 sm:px-6">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
            </div>
            <div className="text-lg sm:text-xl font-semibold text-white truncate max-w-[60%] text-right">
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

          {/* Tabs (centered) */}
          <div className="w-full flex justify-center border-b border-gray-300">
            <nav
              className="inline-flex justify-center items-center gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    className={[
                      "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors",
                      "rounded-t-md border border-b-0",
                      active
                        ? "bg-white text-black border-white -mb-px shadow-[0_2px_0_rgba(0,0,0,0.15)]"
                        : "bg-gradient-to-b from-gray-600 to-gray-700 text-white border-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* PRICE MODE: anchored header + its own scroll area */}
        {mode === "price" ? (
          <>
            <div className="px-6 pt-3 pb-2">
              <PriceTop />
            </div>
            <div ref={priceScrollRef} className="px-6 pt-0 pb-6 flex-1 overflow-y-auto">
              <PriceBottomBox />
            </div>
          </>
        ) : (
          /* Other modes use a single scrolling content area */
          <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
            {mode === "meeting" ? (
              <div className="w-full flex-1 flex flex-col">
                <div className={`${isAnchored ? "sticky top-0 z-10" : ""} bg-white pt-2 pb-2`}>
                  {agent?.calendar_link && (
                    <iframe
                      title="Schedule a Meeting"
                      src={`${agent.calendar_link}?embed_domain=${window.location.hostname}&embed_type=Inline`}
                      style={{ width: "100%", height: "60vh", maxHeight: "640px" }}
                      className="rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                    />
                  )}
                </div>
              </div>
            ) : selected ? (
              <div className="w-full flex-1 flex flex-col">
                {mode === "docs" ? (
                  <div className={`${isAnchored ? "sticky top-0 z-10" : ""} bg-white pt-2 pb-2`}>
                    <iframe
                      style={{ width: "100%", height: "70vh" }}
                      src={selected.url}
                      title={selected.title}
                      className="rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                    />
                  </div>
                ) : (
                  <div className={`${isAnchored ? "sticky top-0 z-10" : ""} bg-white pt-2 pb-2`}>
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

                {mode === "ask" && visibleUnderVideo.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-1 mb-3">
                      <p className="italic text-gray-600">Recommended demos</p>
                      <span />
                    </div>
                    <div className="flex flex-col gap-3">
                      {visibleUnderVideo.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          onPick={(val) => {
                            setSelected(val);
                            setIsAnchored(true);
                            requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : mode === "browse" ? (
              <div className="w-full flex-1 flex flex-col">
                {browseItems.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-2 mb-3">
                      <p className="italic text-gray-600">Select a demo to view it</p>
                      <span />
                    </div>
                    <div className="flex flex-col gap-3">
                      {browseItems.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          onPick={(val) => {
                            setSelected(val);
                            setIsAnchored(true);
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
                    <div style={{ position: "relative", paddingTop: "56.25%" }}>
                      <iframe
                        src="https://player.vimeo.com/video/1102303359?badge=0&autopause=0&player_id=0&app_id=58479"
                        title="DemoHAL Intro Video"
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                      />
                    </div>
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

                {helperPhase === "buttons" && items.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => {
                          setSelected(val);
                          setIsAnchored(true);
                          requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom bar (Ask); shown once estimate exists or for all other modes */}
        <div className="px-4 py-3 border-t border-gray-200">
          {showAskBottom ? (
            <div className="relative w-full">
              <textarea
                ref={inputRef}
                rows={1}
                className="w-full border border-gray-400 rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px]"
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
                <ArrowUpCircleIcon className="w-8 h-8 text-red-600 hover:text-red-700" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
