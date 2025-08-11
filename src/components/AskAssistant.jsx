import React, { useState, useEffect } from "react";
import axios from "axios";
import { ArrowUpCircleIcon, PlayIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

// --- Browse panel (fetches all active demos for bot and shows 3-across grid) ---
function BrowseDemosPanel({ apiBase, botId, onPick }) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!botId) return;
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json();
        if (!cancel) setDemos(data?.demos || []);
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-left">
      {demos.map((d) => (
        <button
          key={d.id}
          onClick={() => onPick(d)}
          className="flex items-center gap-3 p-3 rounded-xl border-2 border-red-500 bg-black text-white hover:bg-gray-900 text-left"
          title={d.description}
        >
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
            <PlayIcon className="w-4 h-4 text-white" />
          </div>
          <div className="truncate">
            <div className="font-medium text-sm truncate">{d.title}</div>
            <div className="text-xs text-gray-300 truncate">{d.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";
  const [mode, setMode] = useState("ask");
  const [seedDemo, setSeedDemo] = useState(null); // when recommending based on a picked demo
  const [selectedDemo, setSelectedDemo] = useState(null); // currently playing demo
  const [botId] = useState(new URLSearchParams(window.location.search).get("bot") || "f3ab3e92-9855-4c9b-8038-0a9e483218b7");

  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [displayedText, setDisplayedText] = useState("Hello. I am here to answer any questions you may have about what we offer or who we are. Please enter your question below to begin.");
  const [buttons, setButtons] = useState([]); // recommended demo buttons
  const [loading, setLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  // --- Tabs routing ---
  const handleTab = (key) => {
    if (key === "start") {
      // full reset
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
    // docs/pricing/meeting TODO
  };

  // --- Ask flow (with recommended demos from backend buttons[]) ---
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
      const payload = { visitor_id: "local-ui", user_question: outgoing };
      if (botId) payload.bot_id = botId;
      const res = await axios.post(`${apiBase}/demo-hal`, payload);
      setDisplayedText(res.data?.response_text || "");
      setButtons(res.data?.buttons || []); // <— restore recommended demos
    } catch {
      setDisplayedText("Sorry, something went wrong. Please try again.");
      setButtons([]);
    } finally {
      setLoading(false);
      setShowThinking(false);
    }
  };

  // --- Recommend based on a selected demo (from Browse) ---
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

  // --- Render helpers ---
  const renderButtons = () => {
    if (!buttons.length) return null;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-left mt-2">
        {buttons.map((b, idx) => (
          <button
            key={`${b.title}-${idx}`}
            onClick={() => setSelectedDemo(b)}
            className="flex items-center gap-3 p-3 rounded-xl border-2 border-red-500 bg-black text-white hover:bg-gray-900 text-left"
            title={b.description}
          >
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
              <PlayIcon className="w-4 h-4 text-white" />
            </div>
            <div className="truncate">
              <div className="font-medium text-sm truncate">{b.title}</div>
              <div className="text-xs text-gray-300 truncate">{b.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  // --- Tabs config (single-line labels; spread across; scrollable on mobile) ---
  const tabs = [
    { key: "demos", label: "Browse Demos" },
    { key: "docs", label: "Browse Docs" },
    { key: "pricing", label: "Price Estimate" },
    { key: "meeting", label: "Schedule Meeting" },
    { key: "start", label: "Start Over" },
    { key: "finished", label: "Finished For Now" },
  ];
  const currentTab = mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;

  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div
        className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300"
        style={{ width: "min(720px, 100vw - 16px)", height: "auto", minHeight: "450px", maxHeight: "90vh" }}
      >
        {/* Banner */}
        <div className="bg-black text-white px-4 sm:px-6">
          {/* top row: logo (left) + breadcrumb (right) */}
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
            </div>
            {/* breadcrumb (no prefix), right-justified */}
            <div className="text-xs text-gray-300 truncate max-w-[60%] text-right">
              {mode === "recommend" && seedDemo ? seedDemo.title : selectedDemo ? selectedDemo.title : ""}
            </div>
          </div>
          {/* bottom row: single-line tabs spread across; mobile-safe (scrolls horizontally) */}
          <div className="pb-3">
            <nav className="flex justify-between gap-1 overflow-x-auto">
              {tabs.map((t) => {
                const active = currentTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => handleTab(t.key)}
                    className={`flex-1 px-3 py-2 text-sm font-medium whitespace-nowrap text-center transition-colors ${active ? "text-red-400" : "text-white hover:text-red-400"}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
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
            <div className="w-full space-y-4 flex-1 flex flex-col">
              {!lastQuestion ? (
                <p className="text-xl font-bold leading-snug text-left mt-auto mb-auto whitespace-pre-line">{displayedText}</p>
              ) : null}

              {lastQuestion && (
                <div className="w-full text-left pt-2">
                  <p className="text-base text-black italic">“{lastQuestion}”</p>
                </div>
              )}

              <div className="p-1 text-left">
                {showThinking ? (
                  <p className="text-gray-500 font-bold animate-pulse">Thinking...</p>
                ) : (
                  <>
                    <p className="text-black text-base font-bold whitespace-pre-line">{displayedText}</p>
                    {renderButtons()}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer input */}
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
