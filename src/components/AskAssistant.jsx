// src/components/AskAssistant.jsx — Back-compat with {items} or {buttons}
// Tabs: Browse Demos, Schedule Meeting, Finished
// Sequenced Ask UX: mirror → Thinking… → response → helper → buttons

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

function Row({ item, onPick }) {
  return (
    <button
      onClick={() => onPick(item)}
      className="w-full text-center bg-gradient-to-b from-gray-600 to-gray-700 text-white rounded-xl border border-gray-700 px-4 py-3 shadow hover:from-gray-500 hover:to-gray-600 transition-colors"
    >
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.description ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{item.description}</div>
      ) : item.functions_text ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{item.functions_text}</div>
      ) : null}
    </button>
  );
}

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  const [botId, setBotId] = useState("");
  const [fatal, setFatal] = useState("");

  const [mode, setMode] = useState("ask"); // ask | browse | finished
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("Hello. Ask a question to get started.");
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  
  const [browseDocs, setBrowseDocs] = useState([]);
const [selected, setSelected] = useState(null);

  // Helper phasing for Ask: "hidden" → "header" → "buttons"
  const [helperPhase, setHelperPhase] = useState("hidden");

  const [isAnchored, setIsAnchored] = useState(false);
  const contentRef = useRef(null);

  
  const inputRef = useRef(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);
// Resolve alias — default to "demo"
  const alias = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return (qs.get("alias") || "demo").trim();
  }, []);

  // Extract bot id from various backend shapes
  function extractBotId(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.bot && payload.bot.id) return payload.bot.id;
    if (payload.id) return payload.id;
    if (payload.data && payload.data.id) return payload.data.id;
    if (Array.isArray(payload.data) && payload.data[0] && payload.data[0].id) return payload.data[0].id;
    if (Array.isArray(payload.rows) && payload.rows[0] && payload.rows[0].id) return payload.rows[0].id;
    return null;
  }

  // Normalize results to the UI's expected shape
  function normalizeList(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => {
      const id = it.id ?? it.button_id ?? it.value ?? it.url ?? it.title;
      const title =
        it.title ?? it.button_title ?? (typeof it.label === "string" ? it.label.replace(/^Watch the \"|\" demo$/g, "") : it.label) ?? "";
      const url = it.url ?? it.value ?? it.button_value ?? "";
      const description = it.description ?? it.summary ?? it.functions_text ?? "";
      return {
        id,
        title,
        url,
        description,
        // Keep legacy props in case other components rely on them
        functions_text: it.functions_text ?? description,
        action: it.action ?? it.button_action ?? "demo",
        label: it.label ?? it.button_label ?? (title ? `Watch the "${title}" demo` : ""),
      };
    }).filter((x) => x.title && x.url);
  }

  // Load bot by alias
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (cancel) return;
        const id = extractBotId(data);
        if (id) {
          setBotId(id);
          setFatal("");
        } else if (!res.ok || data?.ok === false) {
          setFatal("Invalid or inactive alias.");
        } else {
          console.warn("/bot-by-alias returned unexpected shape", data);
          setBotId("");
        }
      } catch (e) {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase]);

  // Release anchor on scroll (video view)
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !selected) return;
    const onScroll = () => {
      if (el.scrollTop > 8 && isAnchored) setIsAnchored(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [selected, isAnchored]);

  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();

    // 1) mirror immediately
    setMode("ask");
    setLastQuestion(outgoing);
    setInput("");

    // reset state for new ask
    setSelected(null);
    setIsAnchored(false);
    setResponseText("");
    setHelperPhase("hidden");
    setItems([]);

    // 2) Thinking…
    setLoading(true);

    try {
      const res = await axios.post(`${apiBase}/demo-hal`, {
        bot_id: botId,
        user_question: outgoing,
      }, { timeout: 30000 });

      const data = res?.data || {};
      const text = data?.response_text || "";
      // Back-compat: accept either {items} or {buttons}
      const recSource = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.buttons) ? data.buttons : []);
      const recs = normalizeList(recSource);

      // 3) response
      setResponseText(text);
      setLoading(false);

      // 4) helper header then 5) buttons
      if (recs.length > 0) {
        setHelperPhase("header");
        setTimeout(() => {
          setItems(recs);
          setHelperPhase("buttons");
        }, 60);
      } else {
        setHelperPhase("hidden");
        setItems([]);
      }

      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch (e) {
      setLoading(false);
      setResponseText("Sorry—something went wrong.");
      setHelperPhase("hidden");
      setItems([]);
    }
  }

  async function openBrowse() {
    if (!botId) return;
    setMode("browse");
    setSelected(null);
    try {
      const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      // Back-compat: accept either {items} or {buttons}
      const src = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.buttons) ? data.buttons : []);
      setBrowseItems(normalizeList(src));
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setBrowseItems([]);
    }
  }


  async function openBrowseDocs() {
    if (!botId) return;
    setMode("docs");
    setSelected(null);
    try {
      const res = await fetch(`${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.buttons) ? data.buttons : []);
      setBrowseDocs(normalizeList(src));
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    } catch {
      setBrowseDocs([]);
    }
  }

  // Under-video lists (primary/industry) — legacy support: safely becomes empty in new flow
  const listSource = mode === "browse" ? browseItems : items;

  const selectedFunctionIds = useMemo(() => new Set((selected?.functions || []).map((f) => f?.id).filter(Boolean)), [selected]);
  const selectedIndustryIds = useMemo(() => new Set((selected?.industry_ids || []).filter(Boolean)), [selected]);

  const primaryMatches = selected && selectedFunctionIds.size > 0
    ? listSource.filter((it) => it.id !== selected.id && it.primary_function_id && selectedFunctionIds.has(it.primary_function_id))
    : [];

  const industryMatches = selected && selectedIndustryIds.size > 0
    ? listSource.filter((it) => {
        if (it.id === selected.id) return false;
        const ids = (it.industry_ids || []).filter(Boolean);
        if (!ids.length) return false;
        for (const x of ids) {
          if (selectedIndustryIds.has(x)) return !primaryMatches.some((p) => p.id === it.id);
        }
        return false;
      })
    : [];

  primaryMatches.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  industryMatches.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  const visibleUnderVideo = selected ? [...primaryMatches, ...industryMatches] : listSource;

  // Tabs — EXACTLY as requested: Browse Demos, Schedule Meeting, Finished
  const tabs = [
    { key: "demos", label: "Browse Demos", onClick: openBrowse },
    { key: "docs", label: "Browse Documents", onClick: openBrowseDocs },
    { key: "meeting", label: "Schedule Meeting", onClick: () => setMode("finished") },
    { key: "finished", label: "Finished", onClick: () => setMode("finished") },
  ];
  const currentTab = mode === "browse" ? "demos" : mode === "docs" ? "docs" : mode === "finished" ? "finished" : null;

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
        <div className="text-gray-700">Loading…</div>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-2 sm:p-0">
      <div
        className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300"
        style={{ width: "min(720px, 100vw - 16px)", minHeight: 450, maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="bg-black text-white px-4 sm:px-6">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
            </div>
            <div className="text-lg sm:text-xl font-semibold text-white truncate max-w-[60%] text-right">
              {selected ? selected.title : mode === "browse" ? "Browse Demos" : mode === "docs" ? "Browse Documents" : "Ask the Assistant"}
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-0.5 overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
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
        <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
          {selected ? (
            <div className="w-full flex-1 flex flex-col">
              {mode === "docs" ? (
                <div className={`${isAnchored ? "sticky top-0 z-10" : ""} bg-white pt-2 pb-2`}>
                  <iframe
                    style={{ width: "100%", height: "70vh" }}
                    src={selected.url}
                    title={selected.title}
                    className="rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                  />
                </div>
              ) : (
                <div className={`${isAnchored ? "sticky top-0 z-10" : ""} bg-white pt-2 pb-2`}>
                  <iframe
                    style={{ width: "100%", aspectRatio: "471 / 272" }}
                    src={selected.url}
                    title={selected.title}
                    className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    />
                </div>
              )}

              {mode !== "docs" && visibleUnderVideo.length > 0 && (
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
                          requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
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
                    <p className="italic text-gray-600">Select a demo to view it</p>
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
                          requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : mode === "docs" ? (
            <div className="w-full flex-1 flex flex-col">
              {browseDocs.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-2 mb-3">
                    <p className="italic text-gray-600">Select a document to view it</p>
                    <span />
                  </div>
                  <div className="flex flex-col gap-3">
                    {browseDocs.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => {
                          setSelected(val);
                          setIsAnchored(true);
                          requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {/* 1) Mirror the question immediately */}
              {lastQuestion ? (
                <p className="text-base text-black italic text-center mb-2">"{lastQuestion}"</p>
              ) : null}

              {/* 2) Thinking… or 3) Response */}
              <div className="text-left mt-2">
                {loading ? (
                  <p className="text-gray-500 font-semibold animate-pulse">Thinking…</p>
                ) : (
                  <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                )}
              </div>

              {/* 4) Helper header (phase===header or buttons) */}
              {helperPhase !== "hidden" && (
                <div className="flex items-center justify-between mt-3 mb-2">
                  <p className="italic text-gray-600">Recommended demos</p>
                  <span />
                </div>
              )}

              {/* 5) Buttons only when phase === buttons */}
              {helperPhase === "buttons" && items.length > 0 && (
                <div className="flex flex-col gap-3">
                  {items.map((it) => (
                    <Row
                      key={it.id || it.url || it.title}
                      item={it}
                      onPick={(val) => {
                        setSelected(val);
                        setIsAnchored(true);
                        requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-top border-gray-400 border-t">
          <div className="relative w-full">
            <textarea ref={inputRef} rows={1}
              className="w-full border border-gray-400 rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px]"
              placeholder="Ask your question here"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => { e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button aria-label="Send" onClick={sendMessage} className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95">
              <ArrowUpCircleIcon className="w-8 h-8 text-red-600 hover:text-red-700" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
