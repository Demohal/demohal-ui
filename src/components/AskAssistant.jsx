// src/components/AskAssistant.jsx — MVP: flat list + anchored video + inline search tooltip (rev3)

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ArrowUpCircleIcon,
  MagnifyingGlassCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

function Row({ item, onPick }) {
  return (
    <button
      onClick={() => onPick(item)}
      className="w-full text-center bg-gradient-to-b from-gray-600 to-gray-700 text-white rounded-xl border border-gray-700 px-4 py-3 shadow hover:from-gray-500 hover:to-gray-600 transition-colors"
    >
      {/* Title reduced ~25% and centered */}
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.functions_text ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {item.functions_text}
        </div>
      ) : null}
    </button>
  );
}

export default function AskAssistant() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  const [bot, setBot] = useState(null);
  const [botId, setBotId] = useState("");
  const [fatal, setFatal] = useState("");

  const [mode, setMode] = useState("ask"); // ask | browse | finished
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const INITIAL_MSG = "Hello. Ask a question to get started.";
  const [responseText, setResponseText] = useState(INITIAL_MSG);
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]); // flat list from /demo-hal
  const [browseItems, setBrowseItems] = useState([]); // flat list from /browse-demos
  const [selected, setSelected] = useState(null); // {title,url,...}

  // Anchoring logic
  const [isAnchored, setIsAnchored] = useState(false);

  // Search tooltip state
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState(""); // committed query
  const [searchDraft, setSearchDraft] = useState(""); // type-ahead buffer
  const searchInputRef = useRef(null);

  const contentRef = useRef(null);

  // alias
  const alias = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return (qs.get("alias") || qs.get("a") || "").trim();
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!alias) {
        setFatal("Missing alias in URL.");
        return;
      }
      try {
        const res = await fetch(
          `${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`
        );
        if (!res.ok) throw new Error("Bad alias");
        const data = await res.json();
        if (!cancel) {
          setBot(data.bot);
          setBotId(data.bot?.id || "");
        }
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase]);

  // When anchored, release on first scroll
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !selected) return;
    const onScroll = () => {
      if (el.scrollTop > 8 && isAnchored) setIsAnchored(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [selected, isAnchored]);

  // Focus search input when tooltip opens
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();
    setInput("");
    setSelected(null);
    setMode("ask");
    setLoading(true);
    try {
      const res = await axios.post(`${apiBase}/demo-hal`, {
        bot_id: botId,
        user_question: outgoing,
      });
      const data = res.data || {};
      setResponseText(data.response_text || "");
      const arr = Array.isArray(data.items) ? data.items : [];
      setItems(arr);
      setLastQuestion(outgoing);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch (e) {
      setResponseText("Sorry—something went wrong.");
      setItems([]);
    } finally {
      setLoading(false);
    }
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
      const arr = Array.isArray(data.items) ? data.items : [];
      setBrowseItems(arr);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseItems([]);
    }
  }

  const filteredAsk = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.toLowerCase();
    return items.filter(
      (r) =>
        (r.title || "").toLowerCase().includes(needle) ||
        (r.functions_text || "").toLowerCase().includes(needle)
    );
  }, [items, q]);

  const filteredBrowse = useMemo(() => {
    if (!q.trim()) return browseItems;
    const needle = q.toLowerCase();
    return browseItems.filter(
      (r) =>
        (r.title || "").toLowerCase().includes(needle) ||
        (r.functions_text || "").toLowerCase().includes(needle)
    );
  }, [browseItems, q]);

  const tabs = [
    { key: "demos", label: "Browse Demos", onClick: openBrowse },
    { key: "meeting", label: "Schedule Meeting", onClick: () => setMode("finished") },
    { key: "finished", label: "Finished", onClick: () => setMode("finished") },
  ];
  const currentTab = mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;

  // Hide helper/search on welcome
  const showAskMeta = Boolean(lastQuestion) || filteredAsk.length > 0;

  const SearchControl = ({ align = "right" }) => (
    <div className="relative">
      <button
        aria-label="Search demos"
        onClick={() =>
          setShowSearch((v) => {
            const nv = !v;
            if (!v) setSearchDraft(q);
            return nv;
          })
        }
        className="p-1.5"
      >
        <MagnifyingGlassCircleIcon className="w-8 h-8 text-blue-600" />
      </button>
      {showSearch && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-2 w-64`}
        >
          <div className="flex items-center gap-2">
            <input
              ref={searchInputRef}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  setQ(searchDraft);
                  setShowSearch(false); // collapse on Enter
                }
              }}
              placeholder="Search by title or function"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-black placeholder-gray-400"
            />
            <button
              onClick={() => {
                setSearchDraft("");
                setQ("");
                setShowSearch(false); // collapse on X
              }}
              className="p-2 rounded bg-gray-300 text-gray-700"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (fatal) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-red-600 font-semibold">{fatal}</div>
      </div>
    );
  }
  if (!botId) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div
        className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300"
        style={{
          width: "min(720px, 100vw - 16px)",
          height: "auto",
          minHeight: 450,
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="bg-black text-white px-4 sm:px-6">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
            </div>
            <div className="text-lg sm:text-xl font-semibold text-white truncate max-w-[60%] text-right">
              {selected ? selected.title : mode === "browse" ? "Browse Demos" : "Ask the Assistant"}
            </div>
          </div>

          {/* Tabs */}
          <nav
            className="flex gap-0.5 overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            {tabs.map((t) => {
              const active = currentTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={t.onClick}
                  role="tab"
                  aria-selected={active}
                  className={[
                    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors",
                    "rounded-t-md border border-b-0",
                    active
                      ? "bg-white text-black border-white -mb-px shadow-[0_2px_0_rgba(0,0,0,0.15)]"
                      : "bg-gradient-to-b from-gray-600 to-gray-700 text-white border-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto"
        >
          {selected ? (
            <div className="w-full flex-1 flex flex-col">
              {/* Video: anchor initially, then release on scroll */}
              <div className={`${isAnchored ? "sticky top-0 z-10" : ""} bg-white pt-2 pb-3`}>
                <iframe
                  style={{ width: "100%", aspectRatio: "471 / 272" }}
                  src={selected.url}
                  title={selected.title}
                  className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Help + right-justified blue search icon; tighter space to video */}
              <div className="flex items-center justify-between mt-1 mb-3">
                <p className="italic text-gray-600">Recommended demos</p>
                <SearchControl align="right" />
              </div>

              <div className="flex flex-col gap-3">
                {(mode === "browse" ? filteredBrowse : filteredAsk).map((it) => (
                  <Row
                    key={it.id || it.url || it.title}
                    item={it}
                    onPick={(val) => {
                      setSelected(val);
                      setIsAnchored(true); // re-anchor on selection
                      requestAnimationFrame(() =>
                        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
                      );
                    }}
                  />
                ))}
              </div>
            </div>
          ) : mode === "browse" ? (
            <div className="w-full flex-1 flex flex-col">
              {/* Browse helper + search */}
              <div className="flex items-center justify-between mt-2 mb-3">
                <p className="italic text-gray-600">Select a demo to view it</p>
                <SearchControl align="right" />
              </div>
              <div className="flex flex-col gap-3">
                {filteredBrowse.map((it) => (
                  <Row
                    key={it.id || it.url || it.title}
                    item={it}
                    onPick={(val) => {
                      setSelected(val);
                      setIsAnchored(true);
                      requestAnimationFrame(() =>
                        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
                      );
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {!lastQuestion ? null : (
                <p className="text-base text-black italic text-center mb-4">"{lastQuestion}"</p>
              )}
              {/* More space between mirrored question and response */}
              <div className="text-left mt-4">
                {loading ? (
                  <p className="text-gray-500 font-semibold animate-pulse">Thinking...</p>
                ) : (
                  <p className="text-black text-base font-bold whitespace-pre-line">
                    {responseText}
                  </p>
                )}
              </div>

              {/* Slightly less space below response; hide on welcome */}
              {showAskMeta && (
                <>
                  <div className="flex items-center justify-between mt-2 mb-2">
                    <p className="italic text-gray-600">Recommended demos</p>
                    <SearchControl align="right" />
                  </div>
                  <div className="flex flex-col gap-3">
                    {filteredAsk.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => {
                          setSelected(val);
                          setIsAnchored(true);
                          requestAnimationFrame(() =>
                            contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
                          );
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-top border-gray-400 border-t">
          <div className="relative w-full">
            <textarea
              rows={1}
              className="w-full border border-gray-400 rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px]"
              placeholder="Ask your question here"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            />
            {/* Send button centered inside the textarea vertically & visually */}
            <button
              aria-label="Send"
              onClick={sendMessage}
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
