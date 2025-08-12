// AskAssistant.jsx — 2025-08-12 v10
// - Strict alias bootstrap via /bot-by-alias (active-only), then use bot.id everywhere

// - Tabs with subtle 3D effect (active red); horizontal scroll hidden
// - Breadcrumb: video title on player; “Browse All Demos” on browse; “Ask the Assistant” otherwise
// - Reduced banner→question spacing by ~50%
// - Recommended tiles: title-only, wrap text, in-tile hover overlay (confined), 3-across
// - Browse Demos panel: thumbnails + search/type filter/sort + in-card description overlay

import React, { useState, useEffect } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

// --- BrowseDemosPanel (Thumbnails + Filters) ---
function BrowseDemosPanel({ apiBase, botId, onPick }) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state for filters
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortKey, setSortKey] = useState("newest"); // 'newest' | 'title'

  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!botId) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("bot_id", botId);
        const res = await fetch(`${apiBase}/browse-demos?${params.toString()}`);
        const data = await res.json();
        if (!cancel) setDemos(Array.isArray(data?.demos) ? data.demos : []);
      } catch {
        if (!cancel) setDemos([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [apiBase, botId]);

  // Distinct types for filter chips
  const types = ["All", ...Array.from(new Set(demos.map((d) => d.type).filter(Boolean)))];

  // Filter + sort
  const filtered = demos
    .filter((d) => (typeFilter === "All" ? true : d.type === typeFilter))
    .filter((d) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (d.title || "").toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortKey === "title") return (a.title || "").localeCompare(b.title || "");
      return new Date(b.created_at || 0) - new Date(a.created_at || 0); // newest first
    });

  // Derive a YouTube thumbnail when possible; else gradient
  const getThumb = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        const id = u.pathname.slice(1);
        return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
      }
      if (u.hostname.includes("youtube.com")) {
        const id = u.searchParams.get("v");
        return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
      }
    } catch {}
    return null;
  };

  if (loading) return <p className="text-gray-500 text-left">Loading demos…</p>;
  if (!demos.length) return <p className="text-gray-500 text-left">No demos available.</p>;

  return (
    <div className="text-left">
      {/* Help copy */}
      <p className="italic mb-3">
        Here are all demos in our library. Just click on the one you want to view.
      </p>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search demos…"
          className="w-full md:w-1/2 border border-gray-300 rounded-lg px-3 py-2"
        />
        <div className="flex items-center gap-3 flex-wrap">
          {/* Type chips */}
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const active = t === typeFilter;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={[
                    "px-3 py-1 rounded-full text-sm border transition-colors",
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-gray-300 hover:bg-gray-100",
                  ].join(" ")}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
            title="Sort demos"
          >
            <option value="newest">Newest</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>

      {/* Card Grid (3 across) */}
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden">
        {filtered.map((d) => {
          const thumb = getThumb(d.url);
          return (
            <button
              key={d.id}
              onClick={() => onPick(d)}
              className="group relative text-left bg-white border border-gray-300 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              title={d.title}
            >
              {/* Thumbnail */}
              <div className="w-full" style={{ aspectRatio: "16 / 9" }}>
                {thumb ? (
                  <img src={thumb} alt={d.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                )}
              </div>

              {/* Title */}
              <div className="p-3">
                <div className="font-medium text-sm leading-snug whitespace-normal break-words">
                  {d.title}
                </div>
              </div>

              {/* In-card description overlay (confined to card) */}
              {d.description ? (
                <div className="pointer-events-none absolute inset-0 z-10 hidden group-hover:flex items-end">
                  <div className="w-full bg-black/75 text-white text-xs leading-snug p-3 whitespace-normal break-words">
                    {d.description}
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // Modes: "ask" (default), "browse" (all demos), "recommend" (related tiles after a pick), "finished"
  const [mode, setMode] = useState("ask");
  const [seedDemo, setSeedDemo] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);

  // Bootstrap strictly by alias once; then use bot.id everywhere
  const qs = new URLSearchParams(window.location.search);
  const alias = (qs.get("alias") || qs.get("a") || "").trim(); // keep case; backend is case-insensitive
  const [bot, setBot] = useState(null);
  const [botId, setBotId] = useState("");
  const [fatalError, setFatalError] = useState("");

  useEffect(() => {
    let cancel = false;
    async function boot() {
      if (!alias) {
        setFatalError("Missing alias in URL.");
        return;
      }
      try {
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`);
        if (!res.ok) throw new Error("Invalid or inactive alias");
        const data = await res.json();
        const b = data?.bot;
        if (!b?.id) throw new Error("Invalid or inactive alias");
        if (!cancel) {
          setBot(b);
          setBotId(b.id);
        }
      } catch {
        if (!cancel) setFatalError("Invalid or inactive alias.");
      }
    }
    boot();
    return () => {
      cancel = true;
    };
  }, [apiBase, alias]);

  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [displayedText, setDisplayedText] = useState(
    "Hello. I am here to answer any questions you may have about what we offer or who we are. Please enter your question below to begin."
  );
  const [buttons, setButtons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const handleTab = (key) => {
    if (key === "finished") {
      setMode("finished");
      return;
    }
    if (key === "demos") {
      setMode("browse");
      setSelectedDemo(null);
      setSeedDemo(null);
      setLastQuestion("");
      setDisplayedText("");
      setButtons([]);
      return;
    }
    // Other tabs can be wired later
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMode("ask");
    setSeedDemo(null);
    setSelectedDemo(null);
    setLastQuestion(input);
    setButtons([]);
    setLoading(true);
    setShowThinking(true);
    const outgoing = input;
    setInput("");
    try {
      const payload = { visitor_id: "local-ui", user_question: outgoing, bot_id: botId };
      const res = await axios.post(`${apiBase}/demo-hal`, payload);
      const data = res.data || {};
      setDisplayedText(data.response_text || "");
      setButtons(Array.isArray(data.buttons) ? data.buttons : []);
    } catch {
      setDisplayedText("Sorry, something went wrong. Please try again.");
      setButtons([]);
    } finally {
      setLoading(false);
      setShowThinking(false);
    }
  };

  const recommendFromDemo = async (demo) => {
    setMode("recommend");
    setSeedDemo(demo);
    setSelectedDemo(null);
    setLastQuestion("");
    setDisplayedText("Here are complimentary demos:");
    setButtons([]);
    setLoading(true);
    setShowThinking(true);
    try {
      const url = `${apiBase}/related-demos?bot_id=${encodeURIComponent(
        botId || ""
      )}&demo_id=${encodeURIComponent(demo.id)}&limit=12`;
      const res = await fetch(url);
      const data = await res.json();
      const items = (data?.related || []).map((d) => ({
        title: d.title,
        description: d.description,
        url: d.url,
      }));
      setButtons(items);
    } catch {
      setDisplayedText("Sorry — I had trouble understanding your question. Please try again.");
      setButtons([]);
    } finally {
      setLoading(false);
      setShowThinking(false);
    }
  };

  const renderButtons = () => {
    if (!buttons.length) return null;

    // Move the currently selected demo (if any) to the end of the list
    const ordered = [...buttons];
    if (selectedDemo) {
      const i = ordered.findIndex(
        (x) =>
          (x.url && selectedDemo.url && x.url === selectedDemo.url) || x.title === selectedDemo.title
      );
      if (i >= 0) {
        const [picked] = ordered.splice(i, 1);
        ordered.push(picked);
      }
    }

    return (
      <>
        {/* Help line above tiles */}
        <p className="text-base italic text-black mt-2 mb-1">Recommended Demos</p>

        {/* 3-across grid; custom tooltips live inside each tile */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3 text-left overflow-hidden">
          {ordered.map((b, idx) => {
            const isSelected =
              !!selectedDemo &&
              ((b.url && selectedDemo.url && b.url === selectedDemo.url) || b.title === selectedDemo.title);

            return (
              <button
                key={`${b.title}-${idx}`}
                onClick={() => setSelectedDemo(b)}
                className={[
                  "group relative p-3 rounded-xl border-2 text-left transition-colors whitespace-normal break-words",
                  isSelected
                    ? "bg-gray-200 text-black border-black"
                    : "bg-black text-white border-red-500 hover:bg-gray-900",
                ].join(" ")}
                title={b.title}
              >
                <div className="font-medium text-sm leading-snug">{b.title}</div>
                {/* Tooltip overlay (confined to the tile & grid) */}
                {b.description ? (
                  <div className="pointer-events-none absolute inset-0 z-10 hidden group-hover:flex items-center justify-center rounded-xl bg-black/90 p-3 text-xs leading-snug text-white text-left whitespace-normal break-words">
                    {b.description}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const tabs = (() => {
    const list = [];
    if (bot?.show_browse_demos) list.push({ key: "demos", label: "Browse Demos" });
    if (bot?.show_browse_docs) list.push({ key: "docs", label: "Browse Docs" });
    if (bot?.show_price_estimate) list.push({ key: "pricing", label: "Price Estimate" });
    if (bot?.show_schedule_meeting) list.push({ key: "meeting", label: "Schedule Meeting" });
    list.push({ key: "finished", label: "Finished" });
    return list;
  })();

  const currentTab = mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;

  // Guard screens must be BEFORE the main return
  if (fatalError) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-red-600 font-semibold">{fatalError}</div>
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

  const breadcrumbText = selectedDemo
    ? selectedDemo.title
    : mode === "browse"
    ? "Browse All Demos"
    : "Ask the Assistant";

  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div
        className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300"
        style={{ width: "min(720px, 100vw - 16px)", height: "auto", minHeight: "450px", maxHeight: "90vh" }}
      >
        {/* Banner */}
        <div className="bg-black text-white px-4 sm:px-6">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
            </div>

            {/* Breadcrumb */}
            <div className="text-sm text-white truncate max-w-[60%] text-right">{breadcrumbText}</div>
          </div>

          {/* Tabs with subtle 3D effect */}
          <div className="pb-0">
            {tabs.length > 0 && (
              <nav
                className="flex gap-0.5 overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
              >
                {tabs.map((t) => {
                  const active = currentTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => handleTab(t.key)}
                      role="tab"
                      aria-selected={active}
                      className={[
                        "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors",
                        "rounded-t-md border border-b-0",
                        active
                          ? "bg-gradient-to-b from-red-500 to-red-700 text-white border-red-700 -mb-px shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_0_rgba(0,0,0,0.15)]"
                          : "bg-gradient-to-b from-gray-600 to-gray-700 text-white border-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </div>

        {/* Content wrapper — top padding reduced by ~50% */}
        <div className="px-6 pt-3 pb-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {mode === "finished" ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600">Thanks for exploring! We’ll design this screen next.</p>
            </div>
          ) : mode === "browse" ? (
            <BrowseDemosPanel apiBase={apiBase} botId={botId} onPick={recommendFromDemo} />
          ) : selectedDemo ? (
            <div className="w-full flex flex-col">
              <div className="w-full flex justify-center -mt-2">
                <iframe
                  style={{ width: "100%", aspectRatio: "471 / 272" }}
                  src={selectedDemo.url || selectedDemo.value}
                  title={selectedDemo.title}
                  className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              {renderButtons()}
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {/* Welcome text only on first load */}
              {!lastQuestion ? (
                <p className="text-xl font-bold leading-snug text-left whitespace-pre-line">{displayedText}</p>
              ) : null}

              {/* Question mirror — closer to banner */}
              {lastQuestion && <p className="text-base text-black italic mt-1">“{lastQuestion}”</p>}

              {/* Response text: one line below the question mirror */}
              <div className="text-left mt-2">
                {showThinking ? (
                  <p className="text-gray-500 font-bold animate-pulse">Thinking...</p>
                ) : (
                  <>
                    {(lastQuestion || mode !== "ask") && (
                      <p className="text-black text-base font-bold whitespace-pre-line">{displayedText}</p>
                    )}
                    {/* Recommended tiles with help line */}
                    {renderButtons()}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-400">
          <div className="relative w-full">
            <textarea
              rows={1}
              className="w-full border border-gray-400 rounded-lg px-4 py-2 pr-14 text-base resize-y min-h-[3rem] max-h-[160px]"
              placeholder="Ask your question here"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button
              aria-label="Send"
              onClick={sendMessage}
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95"
            >
              <ArrowUpCircleIcon className="w-8 h-8 text-red-600 hover:text-red-700" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
