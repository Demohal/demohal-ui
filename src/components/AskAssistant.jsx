/* src/components/AskAssistant.jsx */

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

/* =============================== *
 *  PATCH-READY CONSTANTS & UTILS  *
 * =============================== */

const UI = {
  CARD: "border rounded-xl p-4 bg-white shadow",
  BTN: "w-full text-center bg-gradient-to-b from-gray-600 to-gray-700 text-white rounded-xl border border-gray-700 px-4 py-3 shadow hover:from-gray-500 hover:to-gray-600 transition-colors",
  FIELD: "w-full border border-gray-400 rounded-lg px-4 py-3 text-base bg-white",
  TAB_ACTIVE:
    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 bg-white text-black border-white -mb-px shadow-[0_2px_0_rgba(0,0,0,0.15)]",
  TAB_INACTIVE:
    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 bg-gradient-to-b from-gray-600 to-gray-700 text-white border-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]",
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

function Row({ item, onPick }) {
  return (
    <button data-patch="row-button" onClick={() => onPick(item)} className={UI.BTN} title={item.description || ""}>
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.description ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{item.description}</div>
      ) : item.functions_text ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{item.functions_text}</div>
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
      <div className="font-extrabold text-xs sm:text-sm">{opt.label}</div>
      {opt.tooltip ? <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{opt.tooltip}</div> : null}
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

function QuestionBlock({ q, value, onPick }) {
  return (
    <div data-patch="question-block" className={UI.FIELD}>
      <div className="text-black font-bold text-base">{q.prompt}</div>
      {q.help_text ? <div className="text-xs text-black italic mt-1">{q.help_text}</div> : null}

      {Array.isArray(q.options) && q.options.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          {q.options.map((opt) => (
            <OptionButton
              key={opt.key || opt.id}
              opt={opt}
              selected={q.type === "multi_choice" ? Array.isArray(value) && value.includes(opt.key) : value === opt.key}
              onClick={() => onPick(q, opt)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-600">No options available.</div>
      )}
    </div>
  );
}

function TabsNav({ mode, tabs }) {
  return (
    <div
      className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            <button key={t.key} onClick={t.onClick} role="tab" aria-selected={active} className={active ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}>
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

  const [items, setItems] = useState([]); // Ask suggestions
  const [browseItems, setBrowseItems] = useState([]); // Demos
  const [browseDocs, setBrowseDocs] = useState([]); // Docs
  const [selected, setSelected] = useState(null);

  const [helperPhase, setHelperPhase] = useState("hidden");
  const [isAnchored, setIsAnchored] = useState(false);

  const contentRef = useRef(null);
  const priceScrollRef = useRef(null);
  const inputRef = useRef(null);

  // Pricing state
  const [priceUiCopy, setPriceUiCopy] = useState({});
  const [priceQuestions, setPriceQuestions] = useState([]);
  const [priceAnswers, setPriceAnswers] = useState({});
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceErr, setPriceErr] = useState("");

  // Agent for meeting tab
  const [agent, setAgent] = useState(null);

  // Compute alias
  const alias = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return (qs.get("alias") || qs.get("alais") || "demo").trim();
  }, []);

  // Bot id resolver
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (cancel) return;
        const id =
          data?.bot?.id ||
          data?.id ||
          data?.data?.id ||
          (Array.isArray(data?.data) && data?.data[0]?.id) ||
          (Array.isArray(data?.rows) && data?.rows[0]?.id) ||
          "";
        if (id) {
          setBotId(id);
          setFatal("");
        } else if (!res.ok || data?.ok === false) {
          setFatal("Invalid or inactive alias.");
        } else {
          setBotId("");
        }
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase]);

  // Autosize ask box
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Release video/doc sticky when scrolling
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !selected) return;
    const onScroll = () => {
      if (el.scrollTop > 8 && isAnchored) setIsAnchored(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [selected, isAnchored]);

  // Load pricing questions (entering price tab)
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
      } catch {
        if (!cancel) setPriceErr("Unable to load price estimator.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode, botId, apiBase]);

  // Compute estimate when inputs ready
  useEffect(() => {
    const haveAll = (() => {
      if (!priceQuestions?.length) return false;
      const req = priceQuestions.filter((q) => q.group === "estimation" && q.required !== false);
      if (!req.length) return false;
      return req.every((q) => {
        const v = priceAnswers[q.q_key];
        return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
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
        const res = await fetch(`${apiBase}/pricing/estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botId, answers: priceAnswers }),
        });
        const data = await res.json();
        if (cancel) return;
        if (!data?.ok) throw new Error(data?.error || "Failed to compute estimate");
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
  }, [mode, botId, apiBase, priceQuestions, priceAnswers]);

  // Next unanswered (required) question
  const nextPriceQuestion = useMemo(() => {
    if (!priceQuestions?.length) return null;
    for (const q of priceQuestions) {
      const v = priceAnswers[q.q_key];
      const empty =
        (q.type === "multi_choice" && Array.isArray(v) && v.length === 0) || v === undefined || v === null || v === "";
      if (empty && q.group === "estimation" && q.required !== false) return q;
    }
    return null;
  }, [priceQuestions, priceAnswers]);

  // Mirror lines (for PriceTop)
  const mirrorLines = useMemo(() => {
    if (!priceQuestions?.length) return [];
    const lines = [];
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

      const key = normKey(q.q_key);
      let line = null;
      if (q.mirror_template) line = renderMirror(q.mirror_template, label);
      else if (CFG.qKeys.product.includes(key)) line = `You have selected ${label}.`;
      else if (CFG.qKeys.tier.includes(key)) line = `You stated that you execute ${label.toLowerCase()} commercial transactions per month.`;
      if (line) lines.push(line);
    }
    return lines;
  }, [priceQuestions, priceAnswers]);

  // Actions
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

  async function openBrowse() {
    if (!botId) return;
    setMode("browse");
    setSelected(null);
    try {
      const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : Array.isArray(data?.buttons) ? data.buttons : [];
      setBrowseItems(
        (Array.isArray(src) ? src : []).map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
          functions_text: it.functions_text ?? it.description ?? "",
        }))
      );
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
      setBrowseDocs(
        (Array.isArray(src) ? src : []).map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
          functions_text: it.functions_text ?? it.description ?? "",
        }))
      );
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setBrowseDocs([]);
    }
  }

  function handlePickOption(q, opt) {
    setPriceAnswers((prev) => {
      if (q.type === "multi_choice") {
        const curr = Array.isArray(prev[q.q_key]) ? prev[q.q_key] : [];
        const exists = curr.includes(opt.key);
        const next = exists ? curr.filter((k) => k !== opt.key) : [...curr, opt.key];
        return { ...prev, [q.q_key]: next };
      }
      return { ...prev, [q.q_key]: opt.key };
    });
  }

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
      const data = res?.data || {}; // <-- axios: use res.data

      const text = data?.response_text || "";
      const recSource = Array.isArray(data?.items) ? data.items : Array.isArray(data?.buttons) ? data.buttons : [];
      const recs = (Array.isArray(recSource) ? recSource : []).map((it) => {
        const id = it.id ?? it.button_id ?? it.value ?? it.url ?? it.title;
        const title =
          it.title ??
          it.button_title ??
          (typeof it.label === "string" ? it.label.replace(/^Watch the \"|\" demo$/g, "") : it.label) ??
          "";
        const url = it.url ?? it.value ?? it.button_value ?? "";
        const description = it.description ?? it.summary ?? it.functions_text ?? "";
        return { id, title, url, description, functions_text: it.functions_text ?? description, action: it.action ?? it.button_action ?? "demo" };
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

  const listSource = mode === "browse" ? browseItems : items;
  const askUnderVideo = useMemo(() => {
    if (!selected) return items;
    const selKey = selected.id ?? selected.url ?? selected.title;
    return (items || []).filter((it) => (it.id ?? it.url ?? it.title) !== selKey);
  }, [selected, items]);
  const visibleUnderVideo = selected ? (mode === "ask" ? askUnderVideo : []) : listSource;

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

  const showAskBottom = mode !== "price" || !!priceEstimate;
  const embedDomain = typeof window !== "undefined" ? window.location.hostname : "";

  return (
    <div className="w-screen min-h-[100dvh] h-[100dvh] bg-gray-100 p-0 md:p-2 md:flex md:items-center md:justify-center">
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-white border md:rounded-2xl md:shadow-xl flex flex-col overflow-hidden transition-all duration-300 rounded-none shadow-none">
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
                  {agent?.calendar_link ? (
                    <iframe
                      title="Schedule a Meeting"
                      src={`${agent.calendar_link}?embed_domain=${embedDomain}&embed_type=Inline`}
                      style={{ width: "100%", height: "60vh", maxHeight: "640px" }}
                      className="rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                    />
                  ) : null}
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
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
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
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
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
                {helperPhase === "buttons" && (items || []).length > 0 && (
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => {
                          setSelected(val);
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

        {/* Bottom Ask Bar */}
        <div className="px-4 py-3 border-t border-gray-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-patch="ask-bottom-bar">
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
