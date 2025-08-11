import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  ArrowUpCircleIcon,
  PlayIcon,
  PlayCircleIcon,
  BookOpenIcon,
  BanknotesIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/solid";

import logo from "../assets/logo.png";

// ---- Top Navigation Bar (now rendered in the FOOTER) ----
function TopNav({ caps, current, onNav, placement = "footer" }) {
  const items = [
    caps?.menu_browse_demos && { key: "demos", top: "Browse", bottom: "Demos", Icon: PlayCircleIcon },
    caps?.menu_browse_docs && { key: "docs", top: "Browse", bottom: "Documents", Icon: BookOpenIcon },
    caps?.menu_pricing && { key: "pricing", top: "Price", bottom: "Estimate", Icon: BanknotesIcon },
    caps?.menu_meetings && { key: "meeting", top: "Schedule", bottom: "Meeting", Icon: CalendarDaysIcon },
  ].filter(Boolean);

  if (!items.length) return null;

  // Footer variant is visually lightweight (no extra bar background)
  const containerClass = placement === "top" ? "bg-black text-white border-b border-gray-700" : "bg-transparent";
  const padClass = placement === "top" ? "px-6 py-2" : "";

  return (
    <div className={containerClass}>
      <div className={`${padClass} overflow-x-auto`}>
        {/* Single row always; scrolls on small screens */}
        <nav className="flex gap-2 whitespace-nowrap">
          {items.map(({ key, top, bottom, Icon }) => {
            const active = current === key;
            return (
              <button
                key={key}
                onClick={() => onNav(key)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 min-h-[44px] ${
                  active ? "border-red-500 bg-gray-900 text-white" : "border-gray-700 bg-black text-white hover:bg-gray-900"
                } focus:outline-none focus:ring-2 focus:ring-red-500`}
              >
                <Icon className="w-5 h-5 text-red-500 shrink-0" />
                <span className="leading-tight text-left">
                  <span className="block text-sm font-semibold">{top}</span>
                  <span className="block text-xs opacity-90 -mt-0.5">{bottom}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ---- Browse Demos Panel (3 across on desktop, 2 on mobile) ----
function BrowseDemosPanel({ apiBase, botId, onPick }) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!botId) return;
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json();
        if (!cancelled) setDemos(data?.demos || []);
      } catch (e) {
        if (!cancelled) setDemos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [apiBase, botId]);

  return (
    <div className="text-left">
      <p className="text-sm text-gray-600 mb-3">
        Pick a demo to explore. We’ll then show related recommendations.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {demos.map((d) => (
            <button
              key={d.id}
              onClick={() => onPick(d)}
              className="relative p-3 rounded-xl border-2 border-red-500 bg-black text-white text-left hover:bg-gray-900 transition-colors overflow-hidden"
              title={d.description}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div className="truncate font-medium text-sm">{d.title}</div>
              </div>
              <div className="text-xs opacity-90 line-clamp-2">{d.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";
  const query = new URLSearchParams(window.location.search);
  const aliasParam = query.get("alias");
  const botParam = query.get("bot");

  // Modes: ask | browse | recommend
  const [mode, setMode] = useState("ask");
  const [seedDemo, setSeedDemo] = useState(null);
  const [resolvedBotId, setResolvedBotId] = useState(botParam || null);

  // Capability + Menu flags (Hydrated from backend). Defaults = hidden until fetched.
  const [caps, setCaps] = useState({
    has_demos: false,
    has_docs: false,
    menu_browse_demos: false,
    menu_browse_docs: false,
    menu_pricing: false,
    menu_meetings: false,
  });

  // Typing animation control + pending buttons
  const [submitted, setSubmitted] = useState(false);
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState(
    "Hello. I am here to answer any questions you may have about what we offer or who we are. Please enter your question below to begin."
  );
  const [displayedText, setDisplayedText] = useState("");
  const [buttons, setButtons] = useState([]);
  const [pendingButtons, setPendingButtons] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const displayedDemos = useRef(new Set());

  // Typing effect timing constants
  const TYPING_DELAY_START = 350; // ms (slower, more natural)
  const TYPING_SPEED = 35;        // ms per char

  // Fetch menu flags from backend if available
  useEffect(() => {
    if (!resolvedBotId) return;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-capabilities?bot_id=${encodeURIComponent(resolvedBotId)}`);
        if (!res.ok) return; // endpoint may not exist yet
        const data = await res.json();
        const cap = data?.capabilities || {};
        setCaps((prev) => ({
          ...prev,
          has_demos: cap.has_demos ?? prev.has_demos,
          has_docs: cap.has_docs ?? prev.has_docs,
          // Map DB -> UI menu visibility
          menu_browse_demos: cap.show_browse_demos ?? prev.menu_browse_demos,
          menu_browse_docs: cap.show_browse_docs ?? prev.menu_browse_docs,
          menu_pricing: cap.show_price_estimate ?? prev.menu_pricing,
          menu_meetings: cap.show_schedule_meeting ?? prev.menu_meetings,
        }));
      } catch {
        /* ignore if endpoint not present */
      }
    })();
  }, [apiBase, resolvedBotId]);

  // Slow & robust typing effect
  useEffect(() => {
    // Skip if we're still “thinking” or nothing to show
    if (showThinking || !responseText) return;
    
    setDisplayedText("");
    setIsTyping(true);
  
    let i = 0; // we’ll render slice(0, i)
    const starter = setTimeout(() => {
      const typer = setInterval(() => {
        i += 1;
        setDisplayedText(responseText.slice(0, i));
        if (i >= responseText.length) {
          clearInterval(typer);
          setIsTyping(false);
          // After typing completes, delay 5s then show any pending buttons
          if (pendingButtons && pendingButtons.length) {
            setTimeout(() => {
              setButtons(pendingButtons);
              setPendingButtons(null);
            }, 5000);
          }
        }
      }, TYPING_SPEED);
    }, TYPING_DELAY_START);
  
    return () => {
      setIsTyping(false);
      clearTimeout(starter);
    };
  }, [responseText, showThinking, pendingButtons]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMode("ask");
    setLastQuestion(input);
    setSelectedDemo(null);
    setSubmitted(false);
    setResponseText("");
    setDisplayedText("");
    setButtons([]);
    setPendingButtons(null);
    setLoading(true);
    setShowThinking(true);
    const outgoing = input; // capture before clearing
    setInput("");

    try {
      const payload = { visitor_id: "local-ui", user_question: outgoing };
      if (aliasParam) payload.alias = aliasParam; else if (botParam) payload.bot_id = botParam;
      const res = await axios.post(`${apiBase}/demo-hal`, payload);
      const { response_text, buttons: btns, resolved_bot_id } = res.data;
      if (resolved_bot_id && !resolvedBotId) setResolvedBotId(resolved_bot_id);
      setShowThinking(false);
      setResponseText(response_text || "");
      // Defer showing buttons until 5s after typing completes
      setPendingButtons((btns || []).map(b => ({ title: b.title, description: b.description, url: b.url })));
    } catch (e) {
      setShowThinking(false);
      setResponseText("Sorry, something went wrong. Please try again.");
      setButtons([]);
      setPendingButtons(null);
    } finally {
      setLoading(false);
    }
  };

  // Updated to move send button into text area block and change icon to an up arrow in a circle
  const recommendFromDemo = async (demo) => {
      setSeedDemo(demo);
      setMode("recommend");
      setLastQuestion("");
      setSelectedDemo(null);
      setResponseText("");
      setDisplayedText("");
      setButtons([]);
      setLoading(true);
      setShowThinking(true);
      try {
        const url = `${apiBase}/related-demos?bot_id=${encodeURIComponent(resolvedBotId || botParam)}&demo_id=${encodeURIComponent(demo.id)}&limit=12`;
        const res = await fetch(url);
        const data = await res.json();
        setShowThinking(false);
        setResponseText("Here are complimentary demos:");
        const asButtons = (data?.related || []).map((d) => ({
          title: d.title,
          description: d.description,
          url: d.url,
        }));
        const typingDelayStart = 400;
        const typingSpeed = 40;
        const estimatedTypingTime = responseText.length * typingSpeed + typingDelayStart;
        setTimeout(() => {
          setButtons(asButtons.slice(0, 6));
        }, estimatedTypingTime + 5000);
      } catch (e) {
        console.error("Error fetching related demos:", e);
        setShowThinking(false);
        setResponseText("Sorry — I had trouble understanding your question. Please try again.");
        setButtons([]);
      } finally {
        setLoading(false);
      }
  };

  const handleButtonClick = (btn) => {
    if (btn.url) {
      setSelectedDemo(btn);
      setSubmitted(true);
      displayedDemos.current.add(btn.title);
    }
  };

  const handleNav = (key) => {
    if (key === "demos") {
      setMode("browse");
      setSeedDemo(null);
      return;
    }
    if (key === "docs") {
      // TODO: documents browser view
      return;
    }
    if (key === "pricing") {
      // TODO: pricing flow
      return;
    }
    if (key === "meeting") {
      // TODO: schedule meeting flow
      return;
    }
  };

  const renderButtons = (compact = false, heading = "Recommended Demos") => {
    if (!buttons.length) return null;
    const sorted = [...buttons].sort((a, b) => {
      const aSelected = displayedDemos.current.has(a.title);
      const bSelected = displayedDemos.current.has(b.title);
      return aSelected - bSelected; // selected last
    });

    const gridCols = compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
    const pad = compact ? "p-3" : "p-4";

    return (
      <>
        <p className="text-base italic mt-2 mb-1 text-gray-700 text-left">{heading}</p>
        <div className={`grid ${gridCols} gap-4`}>
          {sorted.map((btn, idx) => {
            const isSelected = displayedDemos.current.has(btn.title);
            return (
              <button
                key={idx}
                onClick={() => handleButtonClick(btn)}
                className={`flex items-center gap-3 ${pad} rounded-xl shadow border-2 text-left transition-all group ${
                  isSelected
                    ? "bg-gray-300 border-black text-white order-last"
                    : "bg-black border-red-500 text-white hover:bg-gray-900"
                }`}
                title={btn.description}
              >
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                  <PlayIcon className="w-4 h-4 text-white" />
                </div>
                <div className="relative group max-w-full">
                  <span className="text-base font-medium max-w-[220px] truncate block">{btn.title}</span>
                  <div className="absolute z-10 hidden group-hover:block bg-white border border-gray-300 shadow-lg text-black text-sm p-2 rounded w-[220px] mt-2">
                    {btn.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div
        className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300"
        style={{ width: "min(720px, 100vw - 16px)", height: "auto", minHeight: "450px", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="bg-black text-white text-sm flex items-center justify-between px-6 py-3 pt-[env(safe-area-inset-top)] h-16">
          <div className="flex items-center gap-4">
            <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
          </div>
          <span className="text-white">
            {mode === "recommend" && seedDemo ? `Related to: ${seedDemo.title}` : selectedDemo ? selectedDemo.title : "Ask the Assistant"}
          </span>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {mode === "browse" ? (
            <BrowseDemosPanel apiBase={apiBase} botId={resolvedBotId || botParam} onPick={recommendFromDemo} />
          ) : selectedDemo ? (
            // === Video View ===
            <>
              <div className="w-full flex justify-center mt-[-10px]">
                <iframe
                  style={{ width: "100%", aspectRatio: "471 / 272" }}
                  src={selectedDemo.url || selectedDemo.value}
                  title={selectedDemo.title}
                  className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              {renderButtons()}
            </>
          ) : (
            // === Ask / Recommend View ===
            <div className="w-full space-y-4 flex-1 flex flex-col">
              {mode === "recommend" ? (
                <div className="text-left">
                  <p className="text-sm text-gray-600">
                    Recommendations based on <span className="font-semibold">{seedDemo?.title}</span>
                  </p>
                </div>
              ) : !lastQuestion ? (
                <p className="text-xl font-bold leading-snug text-left mt-auto mb-auto whitespace-pre-line">{displayedText}</p>
              ) : null}

              {mode !== "recommend" && lastQuestion && (
                <div className="w-full text-left pt-2">
                  <p className="text-base text-black italic">“{lastQuestion}”</p>
                </div>
              )}

              <div className="p-1 text-left">
                {showThinking ? (
                  <p className="text-gray-500 font-bold animate-pulse">Thinking...</p>
                ) : (
                  <>
                    {lastQuestion ? (
                      <p className="text-black text-base font-bold whitespace-pre-line">{displayedText}</p>
                    ) : null}
                    {mode === "recommend"
                      ? renderButtons(true, "Related Demos")
                      : renderButtons(false, "Recommended Demos")}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 pb-[env(safe-area-inset-bottom)] border-t border-gray-400 space-y-3">
          {/* Input + inline send (ChatGPT-style) */}
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

          {/* Bottom nav bar (where Main Menu used to be) */}
          <TopNav
            caps={caps}
            current={mode === 'browse' ? 'demos' : mode}
            onNav={handleNav}
            placement="footer"
          />
        </div>
