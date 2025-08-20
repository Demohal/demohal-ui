// src/components/AskAssistant.jsx — MVP: primary + industry matches under video (exclude selected), no banner search

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

function Row({ item, onPick }) {
  return (
    <button
      onClick={() => onPick(item)}
      className="w-full text-center bg-gradient-to-b from-gray-600 to-gray-700 text-white rounded-xl px-4 py-3 shadow hover:from-gray-500 hover:to-gray-600 transition-colors"
    >
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.functions_text ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {item.functions_text}
        </div>
      ) : null}
      {item.description ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-80 italic">
          {item.description}
        </div>
      ) : null}
    </button>
  );
}

export default function AskAssistant() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  const [botId, setBotId] = useState("");
  const [mode, setMode] = useState("welcome"); // 'welcome' | 'ask' | 'browse'
  const [isAnchored, setIsAnchored] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [items, setItems] = useState([]); // recommended demos for Ask mode
  const [browseItems, setBrowseItems] = useState([]); // all demos for Browse mode
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const contentRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch bot by alias on mount
  useEffect(() => {
    async function loadBot() {
      try {
        const alias =
          new URLSearchParams(window.location.search).get("alias") || "demo";
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${alias}`);
        const data = await res.json();
        if (data?.ok && data.bot?.id) {
          setBotId(data.bot.id);
        } else {
          // keep botId empty to avoid UUID cast errors
          setBotId("");
        }
      } catch (e) {
        setBotId("");
      }
    }
    loadBot();
  }, [apiBase]);

  // Derived lists for under-video recs vs. list source
  const { listSource, visibleUnderVideo } = useMemo(() => {
    const source = selected ? [] : items;

    const primaryMatches = (source || []).filter((x) => x.match_type === "primary");
    const industryMatches = (source || []).filter((x) => x.match_type === "industry");

    // Exclude the currently selected video from matches
    const selectedId = selected?.id;
    const excludeSelected = (arr) =>
      Array.isArray(arr)
        ? arr.filter((it) => {
            if (!selectedId) return true;
            return (it.id || it.demo_video_id) !== selectedId;
          })
        : [];

    const pm = excludeSelected(primaryMatches);
    const im = excludeSelected(industryMatches);

    pm.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    im.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

    const visible = selected ? [...pm, ...im] : source;
    return { listSource: source || [], visibleUnderVideo: visible || [] };
  }, [items, selected]);

  // Hide helper on welcome; only show “Recommended demos” if there are items
  const showAskMeta = Array.isArray(items) && items.length > 0;

  const tabs = [
    { key: "demos", label: "Browse Demos" },
    { key: "ask", label: "Ask a Question" },
  ];

  function openAsk() {
    setMode("ask");
    setSelected(null);
    setIsAnchored(false);
    inputRef.current?.focus();
  }
  async function openBrowse() {
    if (!botId) return;
    setMode("browse");
    setSelected(null);
    try {
      const res = await fetch(
        `${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`
      );
      const data = await res.json();
      setBrowseItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setBrowseItems([]);
    }
  }

  async function submitAsk(question) {
    if (!question || !question.trim()) return;
    setLoading(true);
    setError("");
    setMode("ask");
    setSelected(null);
    setIsAnchored(false);
    setLastQuestion(question);

    try {
      const payload = {
        question,
        bot_id: botId || undefined,
      };
      const res = await axios.post(`${apiBase}/ask`, payload, {
        timeout: 30000,
      });
      const data = res?.data || {};
      const text = data?.messages?.[0]?.text || "";
      setResponseText(text || "");
      const recs = Array.isArray(data?.recommendations)
        ? data.recommendations
        : [];
      setItems(recs);
    } catch (e) {
      setError("Sorry—something went wrong.");
      setResponseText("Sorry—something went wrong.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function submitFromInput() {
    const val = inputRef.current?.value || "";
    if (!val.trim()) return;
    inputRef.current.value = "";
    await submitAsk(val);
  }

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between p-2 sm:p-3 bg-white border-b">
        <div className="flex items-center gap-2">
          <img src={logo} alt="logo" className="h-6 w-6" />
          <div className="font-bold text-sm sm:text-base">DemoHAL</div>
        </div>
        <div className="flex items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => (t.key === "demos" ? openBrowse() : openAsk())}
              className={`px-3 py-1 rounded-md text-sm font-semibold ${
                (t.key === "demos" && mode === "browse") ||
                (t.key === "ask" && (mode === "ask" || mode === "welcome"))
                  ? "bg-gray-900 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left / Main Column */}
        <div className="flex-1 flex flex-col">
          {/* Conversation/Content area */}
          <div
            ref={contentRef}
            className="flex-1 overflow-auto px-3 sm:px-4 py-3 sm:py-4"
          >
            {mode === "welcome" ? (
              <div className="text-center text-gray-700">
                <div className="text-lg font-semibold">
                  Welcome to DemoHAL for WAC
                </div>
                <div className="mt-2 text-sm opacity-80">
                  Ask a question about WAC or Acumatica, or browse demos.
                </div>
              </div>
            ) : mode === "ask" ? (
              <div className="flex flex-col gap-3">
                {/* Question + Answer */}
                {lastQuestion ? (
                  <div className="bg-white border rounded-xl p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Your question
                    </div>
                    <div className="mt-1 font-semibold">{lastQuestion}</div>
                  </div>
                ) : null}

                {loading ? (
                  <div className="bg-white border rounded-xl p-3 shadow-sm">
                    <div className="animate-pulse text-gray-500">Thinking…</div>
                  </div>
                ) : responseText ? (
                  <div className="bg-white border rounded-xl p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Answer
                    </div>
                    <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                      {responseText}
                    </div>
                  </div>
                ) : null}

                {/* Selected video (if any) */}
                {selected ? (
                  <div className="bg-white border rounded-xl p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Now playing
                    </div>
                    <div className="mt-2">
                      <div className="font-extrabold">{selected.title}</div>
                      {selected.description ? (
                        <div className="text-sm opacity-80 mt-1">
                          {selected.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <div className="relative w-full h-0 pb-[56.25%] overflow-hidden rounded-lg">
                        <iframe
                          src={selected.url}
                          title={selected.title}
                          className="absolute inset-0 w-full h-full rounded-lg"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>

                    {/* Helper + list (only when we have items) */}
                    {visibleUnderVideo.length > 0 && (
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
                                setIsAnchored(true);
                                requestAnimationFrame(() =>
                                  contentRef.current?.scrollTo({
                                    top: 0,
                                    behavior: "auto",
                                  })
                                );
                              }}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                {/* Ask-meta list (only when items exist) */}
                {showAskMeta && (
                  <>
                    <div className="flex items-center justify-between mt-2 mb-2">
                      <p className="italic text-gray-600">Recommended demos</p>
                      <span />
                    </div>
                    <div className="flex flex-col gap-3">
                      {items.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          onPick={(val) => {
                            setSelected(val);
                            setIsAnchored(true);
                            requestAnimationFrame(() =>
                              contentRef.current?.scrollTo({
                                top: 0,
                                behavior: "auto",
                              })
                            );
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : mode === "browse" ? (
              <div className="w-full flex-1 flex flex-col">
                {browseItems.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-2 mb-3">
                      <p className="italic text-gray-600">
                        Select a demo to view it
                      </p>
                      <span />
                    </div>
                    <div className="flex flex-col gap-3">
                      {browseItems.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          onPick={(val) => {
                            setSelected(val);
                            setIsAnchored(true);
                            requestAnimationFrame(() =>
                              contentRef.current?.scrollTo({
                                top: 0,
                                behavior: "auto",
                              })
                            );
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-gray-500">Unknown mode.</div>
            )}
          </div>
        </div>
      </div>
        
        {/* Footer / Input */}
        <div className="border-t bg-white p-2 sm:p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Type your question…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitFromInput();
                }
              }}
            />
            <button
              onClick={submitFromInput}
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-800"
            >
              <ArrowUpCircleIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          {error ? (
            <div className="text-red-600 text-sm mt-2">{error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
