import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  ArrowUpCircleIcon,
  PlayIcon
} from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";
  const [mode, setMode] = useState("ask");
  const [caps] = useState({});
  const [seedDemo, setSeedDemo] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [displayedText, setDisplayedText] = useState("");
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
    } else if (key === "finished") {
      setMode("finished");
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMode("ask");
    setLastQuestion(input);
    setSelectedDemo(null);
    setButtons([]);
    setLoading(true);
    setShowThinking(true);
    try {
      const res = await axios.post(`${apiBase}/demo-hal`, { visitor_id: "local-ui", user_question: input });
      setDisplayedText(res.data.response_text || "");
      setButtons(res.data.buttons || []);
    } catch {
      setDisplayedText("Sorry, something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setShowThinking(false);
      setInput("");
    }
  };

  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300" style={{ width: "min(980px, 100vw - 16px)", height: "auto", minHeight: "520px", maxHeight: "92vh" }}>
        {/* Header */}
        <div className="bg-black text-white text-sm px-6 pt-[env(safe-area-inset-top)] pb-2">
          <div className="flex items-center justify-between w-full mb-1">
            <div className="flex items-center gap-3 min-w-[180px]">
              <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
            </div>
            <div className="flex-1 flex justify-end sm:justify-center">
              <div className="flex flex-wrap justify-center gap-4">
                {["Browse Demos", "Browse Docs", "Price Estimate", "Schedule Meeting", "Start Over", "Finished For Now"].map((label, index) => (
                  <button
                    key={index}
                    onClick={() => handleTab(label.toLowerCase().replace(/ /g, "_"))}
                    className="text-white hover:text-red-400 text-sm leading-tight text-center"
                  >
                    <div className="leading-tight">
                      <div className="font-semibold text-sm">{label.split(" ")[0]}</div>
                      <div className="text-xs opacity-90 -mt-0.5">{label.split(" ")[1] || ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-300">
            Now Showing: {mode === "recommend" && seedDemo ? seedDemo.title : selectedDemo ? selectedDemo.title : ""}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {mode === "finished" ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600">Thanks for exploring! We’ll design this screen next.</p>
            </div>
          ) : selectedDemo ? (
            <div>Video player and recommendations here...</div>
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
                  <p className="text-black text-base font-bold whitespace-pre-line">{displayedText}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pb-[env(safe-area-inset-bottom)] border-t border-gray-400">
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
