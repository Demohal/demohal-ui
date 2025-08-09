// ...existing imports
import React, { useState, useEffect } from "react";
import axios from "axios";
import { PaperAirplaneIcon, PlayIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";
  const query = new URLSearchParams(window.location.search);
  const aliasParam = query.get("alias");
  const botParam = query.get("bot");

  const [submitted, setSubmitted] = useState(false);
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("Hello. I am here to answer any questions you may have about what we offer or who we are.\nPlease enter your question below to begin.");
  const [displayedText, setDisplayedText] = useState("");
  const [buttons, setButtons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState(null);

  useEffect(() => {
    if (!showThinking && responseText) {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayedText((prev) => prev + responseText.charAt(i));
        i++;
        if (i >= responseText.length) clearInterval(interval);
      }, 12);
      return () => clearInterval(interval);
    }
  }, [responseText, showThinking]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLastQuestion(input);
    setSelectedDemo(null);
    setSubmitted(false);
    setResponseText("");
    setDisplayedText("");
    setButtons([]);
    setLoading(true);
    setShowThinking(true);
    setInput("");

    try {
      const payload = { visitor_id: "local-ui", user_question: input };
      if (aliasParam) payload.alias = aliasParam; else if (botParam) payload.bot_id = botParam;
      const res = await axios.post(`${apiBase}/demo-hal`, payload);

      const { response_text, buttons } = res.data;
      setShowThinking(false);
      setResponseText(response_text);
      setButtons(buttons || []);
    } catch {
      setShowThinking(false);
      setResponseText("Sorry, something went wrong. Please try again.");
      setButtons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = (btn) => {
    if (btn.url) {
      setSelectedDemo(btn);
      setSubmitted(true);
    }
  };

  const renderButtons = () => {
    if (!buttons.length) return null;
    const sorted = [...buttons].sort((a, b) => {
      const aSelected = selectedDemo && a.title === selectedDemo.title;
      const bSelected = selectedDemo && b.title === selectedDemo.title;
      return aSelected - bSelected;
    });

    return (
      <>
        <p className="text-base italic mt-2 mb-1 text-gray-700 text-left">Recommended Demos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sorted.map((btn, idx) => {
            const isSelected = selectedDemo && selectedDemo.title === btn.title;
            return (
              <button
                key={idx}
                onClick={() => handleButtonClick(btn)}
                title={btn.description}
                className={`flex items-center gap-3 p-4 rounded-xl shadow border-2 text-left transition-all ${isSelected ? 'bg-gray-300 border-black text-white order-last' : 'bg-black border-red-500 text-white hover:bg-gray-900'}`}
              >
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                  <PlayIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-base font-medium max-w-[220px] truncate" title={btn.description}>{btn.title}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300" style={{ width: "min(720px, 100vw - 16px)", height: "auto", minHeight: "450px", maxHeight: "90vh" }}>
        <div className="bg-black text-white text-sm flex items-center justify-between px-6 py-3 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-4">
            <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
          </div>
          <span className="text-white">{selectedDemo ? selectedDemo.title : "Ask the Assistant"}</span>
        </div>

        <div className="p-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {selectedDemo ? (
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
            // === Ask View ===
            <div className="w-full space-y-4 flex-1 flex flex-col">
              {!lastQuestion && (
                <p className="text-xl font-bold leading-snug text-left mt-auto mb-auto whitespace-pre-line">{displayedText}</p>
              )}
              {lastQuestion && (<>
                <div className="w-full text-left pt-2">
                  <p className="text-base text-black italic">“{lastQuestion}”</p>
                </div>
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
              </>)}
            </div>
          )}
        </div>

        <div className="p-4 pb-[env(safe-area-inset-bottom)] border-t border-gray-400 space-y-3">
          <textarea
            rows={1}
            className="w-full border border-gray-400 rounded-lg px-4 py-2 text-base resize-y min-h-[3rem] max-h-[160px]"
            placeholder="Ask your question here"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={loading}
          />

          <div className="w-full flex items-center justify-between gap-2">
            <button className="bg-green-600 text-white px-4 py-2 rounded-full text-sm" onClick={() => setSubmitted(false)}>
              Main Menu
            </button>

            <div className="flex gap-2 flex-1 justify-end">
              <button className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 active:scale-95" onClick={sendMessage} disabled={loading}>
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
