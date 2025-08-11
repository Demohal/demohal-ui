import React, { useState, useEffect } from "react";
import axios from "axios";
import { ArrowUpCircleIcon, PlayIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

function BrowseDemosPanel({ apiBase, botId, onPick }) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  let cancel = false;
  async function loadCaps() {
    try {
      const url = `${apiBase}/bot-capabilities?bot_id=${encodeURIComponent(botId)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancel) setCaps(data?.capabilities || {});
    } catch {}
  }
  if (botId) loadCaps();
  return () => { cancel = true; };
}, [apiBase, botId]);

  
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
  const [seedDemo, setSeedDemo] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const qs = new URLSearchParams(window.location.search);
  const [botId] = useState(qs.get("bot") || qs.get("bot_id") || "f3ab3e92-9855-4c9b-8038-0a9e483218b7");
  const [alias] = useState(qs.get("alias") || qs.get("a") || ""); // Flask supports alias/a
  const [caps, setCaps] = useState(null); // backend capability flags


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
      const payload = { visitor_id: "local-ui", user_question: outgoing };
      if (botId) payload.bot_id = botId;
      const res = await axios.post(`${apiBase}/demo-hal`, payload);
      setDisplayedText(res.data?.response_text || "");
      setButtons(res.data?.buttons || []);
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

  const tabs = (() => {
  const list = [];
  if (caps?.show_browse_demos) list.push({ key: "demos", label: "Browse Demos" });
  if (caps?.show_browse_docs) list.push({ key: "docs", label: "Browse Docs" });
  if (caps?.show_price_estimate) list.push({ key: "pricing", label: "Price Estimate" });
  if (caps?.show_schedule_meeting) list.push({ key: "meeting", label: "Schedule Meeting" });
  list.push({ key: "finished", label: "Finished" });
  return list;
})();

  const currentTab = mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;

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
    <div className="text-sm text-white truncate max-w-[60%] text-right">
      {mode === "recommend" && seedDemo
        ? seedDemo.title
        : selectedDemo
        ? selectedDemo.title
        : (!lastQuestion && mode === "ask")
        ? "Ask the Assistant"
        : ""}
    </div>
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
                    {(lastQuestion || mode !== "ask") ? (
                      <p className="text-black text-base font-bold whitespace-pre-line">{displayedText}</p>
                    ) : null}
                    {renderButtons()}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

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
