import React, { useState, useEffect } from "react";
import axios from "axios";
import { ArrowUpCircleIcon, PlayIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

function BrowseDemosPanel({ apiBase, botId, onPick }) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!botId) return;
      setLoading(true);
 try {
    const params = new URLSearchParams();
    if (botId) params.set("bot_id", botId);
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

  if (loading) return <p className="text-gray-500">Loading demos…</p>;
  if (!demos.length) return <p className="text-gray-500">No demos available.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
      {demos.map((d) => (
        <button
          key={d.id}
          onClick={() => onPick(d)}
          className="p-3 rounded-xl border-2 border-red-500 bg-black text-white hover:bg-gray-900 text-left truncate"
          title={d.description || d.title}
        >
          <div className="font-medium text-sm truncate">{d.title}</div>
        </button>
      ))}
    </div>
  );

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";
  const [mode, setMode] = useState("ask");
  const [seedDemo, setSeedDemo] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);

  // Strict: alias is required; fetch bot once; keep bot + botId in state.
  const qs = new URLSearchParams(window.location.search);
  const alias = (qs.get("alias") || qs.get("a") || "").trim().toLowerCase();
  const [bot, setBot] = useState(null);
  const [botId, setBotId] = useState("");
  const [fatalError, setFatalError] = useState("");

  useEffect(() => {
    let cancel = false;
    async function boot() {
      if (!alias) { setFatalError("Missing alias in URL."); return; }
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
    return () => { cancel = true; };
  }, [apiBase, alias]);

  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [displayedText, setDisplayedText] = useState("Hello. I am here to answer any questions you may have about what we offer or who we are. Please enter your question below to begin.");
  const [buttons, setButtons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const handleTab = (key) => {
    if (key === "start") {
      setMode("ask");
      setSeedDemo(null);
      setSelectedDemo(null);
      setLastQuestion("");
      setDisplayedText("");
      setButtons([]);
      return;
    }
    if (key === "finished") {
      setMode("finished");
      return;
    }
    if (key === "demos") {
      setMode("browse");
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
      const url = `${apiBase}/related-demos?bot_id=${encodeURIComponent(botId || "")}&demo_id=${encodeURIComponent(demo.id)}&limit=12`;
      const res = await fetch(url);
      const data = await res.json();
      const items = (data?.related || []).map((d) => ({ title: d.title, description: d.description, url: d.url }));
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
        (x) => (x.url && selectedDemo.url && x.url === selectedDemo.url) || x.title === selectedDemo.title
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

        {/* 3-across grid (no play icon; title only; description as hover) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
          {ordered.map((b, idx) => {
            const isSelected =
              !!selectedDemo &&
              ((b.url && selectedDemo.url && b.url === selectedDemo.url) || b.title === selectedDemo.title);

            return (
              <button
                key={`${b.title}-${idx}`}
                onClick={() => setSelectedDemo(b)}
                className={[
                  "p-3 rounded-xl border-2 text-left truncate transition-colors",
                  isSelected
                    ? "bg-gray-200 text-black border-black"
                    : "bg-black text-white border-red-500 hover:bg-gray-900"
                ].join(" ")}
                title={b.description || b.title}
              >
                <div className="font-medium text-sm truncate">{b.title}</div>
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


  const currentTab =
    mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;

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
  
  return (

    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div
        className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300"
        style={{ width: "min(720px, 100vw - 16px)", height: "auto", minHeight: "450px", maxHeight: "90vh" }}
      >
<div className="bg-black text-white px-4 sm:px-6">
  <div className="flex items-center justify-between w-full py-3">
    <div className="flex items-center gap-3">
      <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
    </div>

    {/* Breadcrumb (white; same size as tab text) */}
    {(() => {
      // Only the video screen shows the selected video title; otherwise show Ask the Assistant,
      // except for tabbed screens like Browse/Finished which use their tab label.
      const labelMap = Object.fromEntries(tabs.map(t => [t.key, t.label]));
      const tabKey = mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;
      const text = selectedDemo?.title
        ? selectedDemo.title
        : tabKey
        ? (labelMap[tabKey] || "")
        : "Ask the Assistant";
      return (
        <div className="text-sm text-white truncate max-w-[60%] text-right">
          {text}
        </div>
      );
    })()}

  </div>

  {/* Tabs */}
  <div className="pb-0">
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
                ? "bg-red-600 text-white border-red-600 -mb-px"
                : "bg-gray-600 text-white hover:bg-gray-500 border-gray-500"
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  </div>
</div>
        <div className="p-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {mode === "finished" ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600">Thanks for exploring! We’ll design this screen next.</p>
            </div>
          ) : mode === "browse" ? (
                        <BrowseDemosPanel apiBase={apiBase} botId={botId} onPick={recommendFromDemo} />

          ) : selectedDemo ? (
            <>
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
            </>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {/* Welcome text only on first load */}
              {!lastQuestion ? (
                <p className="text-xl font-bold leading-snug text-left whitespace-pre-line">{displayedText}</p>
              ) : null}

              {/* Question mirror: one line below the banner */}
              {lastQuestion && (
                <p className="text-base text-black italic mt-2">“{lastQuestion}”</p>
              )}

              {/* Response text: one line below the question mirror */}
              <div className="text-left mt-2">
                {showThinking ? (
                  <p className="text-gray-500 font-bold animate-pulse">Thinking...</p>
                ) : (
                  <>
                    {(lastQuestion || mode !== "ask") ? (
                      <p className="text-black text-base font-bold whitespace-pre-line">{displayedText}</p>
                    ) : null}
                    {/* Recommended tiles with help line */}
                    {renderButtons()}
                  </>
                )}
              </div>
            </div>
          )}


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
