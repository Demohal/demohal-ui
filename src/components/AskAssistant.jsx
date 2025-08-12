// AskAssistant.jsx - 2025-08-12 v11.9
// - Strict alias bootstrap via /bot-by-alias (active-only), then use bot.id everywhere
// - Tabs with subtle 3D effect (active red); horizontal scroll hidden
// - Breadcrumb: larger when showing a video title; "Browse All Demos" on browse; "Ask the Assistant" otherwise
// - Video: exact-size wrapper (black bg), clipped corners, and reduced spacing under banner
// - Browse Demos panel: title-only search, light-gray cards, bold centered titles
// - Tooltips (ALL screens): appear BELOW the button, white bg, constrained width, aligned by column on md+
//
//   Tooltip width rule: w = min(200% of card, 44rem, viewport - 2rem)
//   Tooltip alignment on md+ (3-col grid):
//     - left column  -> left aligned to the grid row
//     - middle       -> centered
//     - right column -> right aligned to the grid row

import React, { useState, useEffect } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

// Helper: build tooltip position classes for a grid index (0-based)
function getTooltipPosClasses(idx) {
  const col = idx % 3; // md:grid-cols-3
  // Base (mobile): centered under the card, full card width, constrained by viewport
  // md+: width is 200% (two cells), position varies by column
  if (col === 0) {
    // left-most: anchor to left edge on md+
    return [
      "left-1/2 -translate-x-1/2",     // mobile center
      "md:left-0 md:translate-x-0",     // md+ left align
    ].join(" ");
  }
  if (col === 1) {
    // center: centered on md+
    return [
      "left-1/2 -translate-x-1/2",      // mobile center
      "md:left-1/2 md:-translate-x-1/2",// md+ centered
    ].join(" ");
  }
  // right-most: anchor to right edge on md+
  return [
    "left-1/2 -translate-x-1/2",        // mobile center
    "md:right-0 md:left-auto md:translate-x-0", // md+ right align
  ].join(" ");
}

// --- BrowseDemosPanel (Search-only, Title Cards, Unified tooltips) ---
function BrowseDemosPanel({ apiBase, botId, onPick }) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

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

  // Title-only, case-insensitive
  const filtered = demos.filter((d) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (d.title || "").toLowerCase().includes(q);
  });

  if (loading) return <p className="text-gray-500 text-left">Loading demos…</p>;
  if (!demos.length) return <p className="text-gray-500 text-left">No demos available.</p>;

  return (
    <div className="text-left">
      <p className="italic mb-3">
        Here are all demos in our library. Just click on the one you want to view.
      </p>

      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search demos by title…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      {/* Grid is the clipping boundary for tooltips */}
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden">
        {filtered.map((d, idx) => {
          const pos = getTooltipPosClasses(idx);
          return (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => onPick(d)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(d)}
              className="group relative px-3 py-4 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-black hover:shadow-md transition-colors transition-shadow cursor-pointer whitespace-normal break-words flex items-center justify-center text-center"
              title={d.title}
            >
              <div className="font-bold text-sm leading-snug text-black text-center">{d.title}</div>

              {/* Unified tooltip: BELOW card, white, constrained and aligned by column */}
              {d.description ? (
                <div
                  className={[
                    "pointer-events-none absolute top-full mt-2 z-50 opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-150 rounded-xl bg-white text-black text-xs leading-snug p-3",
                    "shadow-xl border border-gray-300",
                    "w-full md:w-[200%] max-w-[calc(100vw-2rem)] md:max-w-[44rem]",
                    pos,
                  ].join(" ")}
                >
                  {d.description}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // Modes: "ask" (default), "browse", "recommend", "finished"
  const [mode, setMode] = useState("ask");
  const [seedDemo, setSeedDemo] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);

  // Bootstrap strictly by alias once; then use bot.id everywhere
  const qs = new URLSearchParams(window.location.search);
  const alias = (qs.get("alias") || qs.get("a") || "").trim();
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
      setDisplayedText("Sorry - I had trouble understanding your question. Please try again.");
      setButtons([]);
    } finally {
      setLoading(false);
      setShowThinking(false);
    }
  };

  // Recommended demo tiles (always light gray, centered titles, unified tooltips, no reordering)
  const renderButtons = () => {
    if (!buttons.length) return null;

    const ordered = buttons; // no reordering

    return (
      <>
        <p className="text-base italic text-black mt-2 mb-1 text-left">Recommended Demos</p>

        {/* Grid is clipping boundary for tooltips; raise z-index above video */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 text-left overflow-hidden">
          {ordered.map((b, idx) => {
            const pos = getTooltipPosClasses(idx);
            return (
              <button
                key={`${b.title}-${idx}`}
                onClick={() => setSelectedDemo(b)}
                className="group relative p-3 rounded-xl border-2 border-gray-300 bg-gray-100 text-black hover:bg-gray-200 transition-colors whitespace-normal break-words flex items-center justify-center text-center"
                title={b.title}
              >
                <div className="font-medium text-sm leading-snug text-center">{b.title}</div>

                {/* Unified tooltip: BELOW tile, white, constrained and aligned by column */}
                {b.description ? (
                  <div
                    className={[
                      "pointer-events-none absolute top-full mt-2 z-50 opacity-0 group-hover:opacity-100",
                      "transition-opacity duration-150 rounded-xl bg-white text-black text-xs leading-snug p-3",
                      "shadow-xl border border-gray-300",
                      "w-full md:w-[200%] max-w-[calc(100vw-2rem)] md:max-w-[44rem]",
                      pos,
                    ].join(" ")}
                  >
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
            <div className="text-lg sm:text-xl font-semibold text-white truncate max-w-[60%] text-right">
              {breadcrumbText}
            </div>
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

        {/* Content wrapper */}
        <div className="px-6 pt-3 pb-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {mode === "finished" ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600">Thanks for exploring! We will design this screen next.</p>
            </div>
          ) : mode === "browse" ? (
            <BrowseDemosPanel apiBase={apiBase} botId={botId} onPick={recommendFromDemo} />
          ) : selectedDemo ? (
            <div className="w-full flex flex-col">
              {/* Video wrapper: exact-size, black bg, clipped, with HALF spacing under banner */}
              <div className="mt-2">
                <div className="w-full rounded-xl overflow-hidden shadow-[0_4px_12px_0_rgba(107,114,128,0.3)] bg-black">
                  {/* Aspect ratio container (matches ~471x272 => 57.75%) */}
                  <div className="relative" style={{ paddingTop: "57.75%" }}>
                    <iframe
                      src={selectedDemo.url || selectedDemo.value}
                      title={selectedDemo.title}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>

              {renderButtons()}
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {/* Welcome text only on first load */}
              {!lastQuestion ? (
                <p className="text-xl font-bold leading-snug text-left whitespace-pre-line">{displayedText}</p>
              ) : null}

              {/* Question mirror */}
              {lastQuestion && <p className="text-base text-black italic mt-1 text-left">“{lastQuestion}”</p>}

              {/* Response text and recommended tiles */}
              <div className="text-left mt-2">
                {showThinking ? (
                  <p className="text-gray-500 font-bold animate-pulse">Thinking...</p>
                ) : (
                  <>
                    {(lastQuestion || mode !== "ask") && (
                      <p className="text-black text-base font-bold whitespace-pre-line">{displayedText}</p>
                    )}
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
