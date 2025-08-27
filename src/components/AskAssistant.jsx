/* src/components/AskAssistant.jsx */

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import fallbackLogo from "../assets/logo.png";

/* =============================== *
 *  PATCH-READY CONSTANTS & UTILS  *
 * =============================== */

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
};

const UI = {
  CARD: "border rounded-xl p-4 bg-white shadow",
  BTN:
    "w-full text-center rounded-xl px-4 py-3 shadow transition-colors " +
    "text-[var(--btn-fg)] border " +
    "border-[var(--btn-border)] " +
    "bg-gradient-to-b from-[var(--btn-grad-from)] to-[var(--btn-grad-to)] " +
    "hover:from-[var(--btn-grad-from-hover)] hover:to-[var(--btn-grad-to-hover)]",
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

const classNames = (...xs) => xs.filter(Boolean).join(" ");

/* ========================== *
 *  SMALL PATCHABLE COMPONENTS *
 * ========================== */

function Row({ item, onPick }) {
  return (
    <button onClick={() => onPick(item)} className={UI.BTN} title={item.description || ""}>
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.description ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{item.description}</div>
      ) : null}
    </button>
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
            <button
              key={t.key}
              onClick={t.onClick}
              role="tab"
              aria-selected={active}
              className={active ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}
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
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL params
  const { alias, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const a = (qs.get("alias") || qs.get("alais") || "").trim();
    const b = (qs.get("bot_id") || "").trim();
    return { alias: a, botIdFromUrl: b };
  }, []);

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");

  // Modes: ask | browse | docs | price | meeting
  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState(
    "Welcome to DemoHAL. Ask a question, watch short demos, read documents, schedule a meeting, or get a price estimate."
  );
  const [loading, setLoading] = useState(false);

  // Lists & selection
  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);

  const contentRef = useRef(null);
  const inputRef = useRef(null);

  // Theme (DB-driven CSS variables)
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);

  // Brand assets (logo)
  const [brandAssets, setBrandAssets] = useState({ logo_url: null });

  // Tab visibility flags (driven by bots.show_* booleans)
  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
    price: false,
  });

  // NEW: meeting agent state
  const [agent, setAgent] = useState(null);

  // Resolve bot by alias when botId not provided
  useEffect(() => {
    if (botId) return;
    if (!alias) return;
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

        const b = data?.bot || data || {};
        setTabsEnabled({
          demos: !!b.show_browse_demos,
          docs: !!b.show_browse_docs,
          meeting: !!b.show_schedule_meeting,
          price: !!b.show_price_estimate,
        });

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

  // Fetch brand once we know botId
  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json();
        if (cancel) return;

        if (data?.ok && data?.css_vars && typeof data.css_vars === "object") {
          setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
        }
        if (data?.ok && data?.assets) {
          setBrandAssets({ logo_url: data.assets.logo_url || null });
        }
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancel = true;
    };
  }, [botId, apiBase]);

  // If a disabled tab is active, fall back to Ask
  useEffect(() => {
    if (mode === "browse" && !tabsEnabled.demos) setMode("ask");
    if (mode === "docs" && !tabsEnabled.docs) setMode("ask");
    if (mode === "meeting" && !tabsEnabled.meeting) setMode("ask");
    if (mode === "price" && !tabsEnabled.price) setMode("ask");
  }, [tabsEnabled, mode]);

  // Tab list built from flags
  const tabs = useMemo(() => {
    const out = [];
    if (tabsEnabled.demos) out.push({ key: "demos", label: "Browse Demos", onClick: openBrowse });
    if (tabsEnabled.docs) out.push({ key: "docs", label: "Browse Documents", onClick: openBrowseDocs });
    if (tabsEnabled.price) {
      out.push({
        key: "price",
        label: "Price Estimate",
        onClick: () => {
          setSelected(null);
          setMode("price");
        },
      });
    }
    if (tabsEnabled.meeting) out.push({ key: "meeting", label: "Schedule Meeting", onClick: openMeeting });
    return out;
  }, [tabsEnabled]);

  async function openMeeting() {
    if (!botId) return;
    setSelected(null);
    setMode("meeting");
    try {
      const res = await fetch(`${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const ag = data?.ok ? data.agent : null;
      setAgent(ag);

      // NEW: if the agent says calendar_link_type === 'external', open in a new tab immediately
      if (ag && ag.calendar_link_type && String(ag.calendar_link_type).toLowerCase() === "external" && ag.calendar_link) {
        try {
          window.open(ag.calendar_link, "_blank", "noopener,noreferrer");
        } catch {
          /* ignore window open issues; fallback link is shown in-pane */
        }
      }

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
      const src = Array.isArray(data?.items) ? data.items : [];
      setBrowseItems(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? "",
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
      const src = Array.isArray(data?.items) ? data.items : [];
      setBrowseDocs(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? "",
        }))
      );
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setBrowseDocs([]);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();
    setMode("ask");
    setLastQuestion(outgoing);
    setInput("");
    setSelected(null);
    setResponseText("");
    setItems([]);
    setLoading(true);
    try {
      const res = await axios.post(`${apiBase}/demo-hal`, { bot_id: botId, user_question: outgoing }, { timeout: 30000 });
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
          const description = it.description ?? it.summary ?? "";
          const action = it.action ?? it.button_action ?? "demo";
          return { id, title, url, description, action };
        })
        .filter((b) => {
          const act = (b.action || "").toLowerCase();
          const lbl = (b.title || "").toLowerCase();
          return act !== "continue" && act !== "options" && lbl !== "continue" && lbl !== "show me options";
        });

      setResponseText(text);
      setLoading(false);
      setItems(recs);

      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setLoading(false);
      setResponseText("Sorry—something went wrong.");
      setItems([]);
    }
  }

  const listSource = mode === "browse" ? browseItems : items;

  if (fatal) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-red-600 font-semibold">{fatal}</div>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center" style={themeVars}>
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] bg-[var(--card-bg)] border border-[var(--card-border)] md:rounded-[var(--radius-card)] [box-shadow:var(--shadow-card)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)]">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={brandAssets.logo_url || fallbackLogo} alt="Brand logo" className="h-10 object-contain" />
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

        {/* Body */}
        <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
          {mode === "browse" ? (
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
          ) : mode === "docs" ? (
            selected ? (
              <div className="bg-white pt-2 pb-2">
                <iframe
                  className="w-full h-[65vh] md:h-[78vh] rounded-xl border border-gray-200"
                  src={selected.url}
                  title={selected.title}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
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
            )
          ) : mode === "price" ? (
            <div className="text-sm text-gray-700">Price estimator loading…</div>
          ) : mode === "meeting" ? (
            <div className="w-full flex-1 flex flex-col" data-patch="meeting-pane">
              <div className="bg-white pt-2 pb-2">
                {/* NEW: calendar_link_type handling */}
                {!agent ? (
                  <div className="text-sm text-gray-600">Loading scheduling…</div>
                ) : agent.calendar_link_type && String(agent.calendar_link_type).toLowerCase() === "embed" && agent.calendar_link ? (
                  <>
                    {agent?.schedule_header ? (
                      <div className="mb-2 text-sm italic text-gray-600 whitespace-pre-line">{agent.schedule_header}</div>
                    ) : null}
                    <iframe
                      title="Schedule a Meeting"
                      src={agent.calendar_link}
                      style={{ width: "100%", height: "60vh", maxHeight: "640px" }}
                      className="rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                    />
                  </>
                ) : agent.calendar_link_type && String(agent.calendar_link_type).toLowerCase() === "external" && agent.calendar_link ? (
                  <>
                    {agent?.schedule_header ? (
                      <div className="mb-3 text-sm italic text-gray-600 whitespace-pre-line">{agent.schedule_header}</div>
                    ) : null}
                    <div className="text-sm text-gray-700">
                      We opened the scheduling page in a new tab. If it didn’t open,{" "}
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
                  </>
                ) : (
                  <div className="text-sm text-gray-600">No scheduling link is configured.</div>
                )}
              </div>
            </div>
          ) : (
            // Ask mode
            <div className="w-full flex-1 flex flex-col">
              {lastQuestion ? <p className="text-base text-black italic text-center mb-2">"{lastQuestion}"</p> : null}
              <div className="text-left mt-2">
                {loading ? (
                  <p className="text-gray-500 font-semibold animate-pulse">Thinking…</p>
                ) : lastQuestion ? (
                  <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                ) : (
                  <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                )}
              </div>
              {!selected && mode === "ask" && (listSource || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <p className="italic text-gray-600">Recommended demos</p>
                    <span />
                  </div>
                  <div className="flex flex-col gap-3">
                    {listSource.map((it) => (
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
          )}
        </div>

        {/* Bottom Ask Bar */}
        <div className="px-4 py-3 border-t border-gray-200">
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
        </div>
      </div>
    </div>
  );
}
