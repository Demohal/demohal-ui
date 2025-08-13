// AskAssistant.jsx — unified recommendations, robust parsing, sticky video, aligned tooltips

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

/* --------------------------- Tooltip helpers --------------------------- */
function tooltipAlignClasses(idx) {
  // Mobile: center; Desktop: left/center/right by column
  const mobile = "left-1/2 -translate-x-1/2";
  const col = idx % 3;
  if (col === 0) return `${mobile} md:left-0 md:translate-x-0`;
  if (col === 2) return `${mobile} md:right-0 md:left-auto md:translate-x-0`;
  return `${mobile}`;
}

/* A single, uniform demo button used everywhere (Ask, Video, Browse). */
function DemoButton({ item, idx, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "group relative w-full h-20",
        "flex items-center justify-center text-center",
        "rounded-xl border border-gray-700",
        "bg-gradient-to-b from-gray-600 to-gray-700 text-white hover:from-gray-500 hover:to-gray-600",
        "px-3 transition-shadow hover:shadow-md",
      ].join(" ")}
      title={item.title}
    >
      {/* Centered title, max two lines; uniform sizing */}
      <span
        className="font-semibold text-sm leading-snug w-full"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {item.title || "Demo"}
      </span>

      {/* White tooltip, two grid-cells wide on md+, aligned by column; clipped by grid container */}
      {item.description ? (
        <div
          className={[
            "pointer-events-none absolute z-30 hidden group-hover:block",
            "bottom-full mb-2",
            tooltipAlignClasses(idx),
            "w-[95vw] max-w-[95vw] md:w-[200%] md:max-w-[200%]",
            "rounded-lg border border-gray-300 bg-white text-black",
            "px-3 py-2 text-xs leading-snug shadow-xl",
          ].join(" ")}
        >
          {item.description}
        </div>
      ) : null}
    </button>
  );
}

/* ------------------------ Browse Demos (search) ------------------------ */
function BrowseDemosPanel({ apiBase, botId, onPick }) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
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
    })();
    return () => {
      cancel = true;
    };
  }, [apiBase, botId]);

  const filtered = useMemo(() => {
    if (!q.trim()) return demos;
    const needle = q.toLowerCase();
    return demos.filter((d) => {
      return (
        (d.title || "").toLowerCase().includes(needle) ||
        (d.description || "").toLowerCase().includes(needle)
      );
    });
  }, [demos, q]);

  if (loading) return <p className="text-gray-500">Loading demos...</p>;
  if (!demos.length) return <p className="text-gray-500">No demos available.</p>;

  return (
    <div className="text-left">
      {/* Help copy */}
      <p className="italic mb-3">
        Here are all demos in our library. Just click on the one you want to view.
      </p>

      {/* Search-only */}
      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search demos..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      {/* Title-only cards; tooltips confined by this grid container */}
      <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
        {filtered.map((d, idx) => (
          <div key={d.id || d.url || d.title} className="relative">
            <DemoButton
              item={{ title: d.title, description: d.description }}
              idx={idx}
              onClick={() => onPick(d)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Main Screen ----------------------------- */
export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // "ask" | "browse" | "finished"
  const [mode, setMode] = useState("ask");
  const [selectedDemo, setSelectedDemo] = useState(null); // {id,title,url,description}
  const [allDemos, setAllDemos] = useState([]); // cache for fallbacks
  const [buttons, setButtons] = useState([]); // recs (ask flow OR video related)

  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState(
    "Hello. I am here to answer any questions you may have about what we offer or who we are. Please enter your question below to begin."
  );
  const [loading, setLoading] = useState(false);

  /* Bot bootstrap by alias */
  const alias = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return (qs.get("alias") || qs.get("a") || "").trim();
  }, []);
  const [bot, setBot] = useState(null);
  const [botId, setBotId] = useState("");
  const [fatal, setFatal] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!alias) {
        setFatal("Missing alias in URL.");
        return;
      }
      try {
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`);
        if (!res.ok) throw new Error("Bad alias");
        const data = await res.json();
        const b = data?.bot;
        if (!b?.id) throw new Error("Bad alias");
        if (!cancel) {
          setBot(b);
          setBotId(b.id);
        }
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase]);

  /* Preload demos for fallbacks / id lookup */
  async function ensureAllDemosLoaded(currentBotId) {
    if (!currentBotId) return [];
    if (allDemos.length) return allDemos;
    try {
      const params = new URLSearchParams();
      params.set("bot_id", currentBotId);
      const res = await fetch(`${apiBase}/browse-demos?${params.toString()}`);
      const data = await res.json();
      const list = Array.isArray(data?.demos) ? data.demos : [];
      setAllDemos(list);
      return list;
    } catch {
      return [];
    }
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!botId) return;
      const list = await ensureAllDemosLoaded(botId);
      if (!cancel && list.length && !allDemos.length) setAllDemos(list);
    })();
    return () => {
      cancel = true;
    };
  }, [apiBase, botId]); // eslint-disable-line

  /* If a demo was selected before botId arrived, kick related once both are ready */
  useEffect(() => {
    if (!selectedDemo || !botId) return;
    fetchRelatedForSelected(selectedDemo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, selectedDemo]);

  /* Tabs built from bot toggles */
  const tabs = useMemo(() => {
    const list = [];
    if (bot?.show_browse_demos) list.push({ key: "demos", label: "Browse Demos" });
    if (bot?.show_schedule_meeting) list.push({ key: "meeting", label: "Schedule Meeting" });
    list.push({ key: "finished", label: "Finished" });
    return list;
  }, [bot]);

  const currentTab = mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;

  const handleTab = (key) => {
    if (key === "demos") {
      setMode("browse");
      return;
    }
    if (key === "finished") {
      setMode("finished");
      return;
    }
  };

  /* Ask flow */
  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();
    setInput("");
    setMode("ask");
    setSelectedDemo(null);
    setLastQuestion(outgoing);
    setButtons([]);
    setLoading(true);

    try {
      const payload = { visitor_id: "local-ui", user_question: outgoing, bot_id: botId };
      const res = await axios.post(`${apiBase}/demo-hal`, payload);
      const data = res.data || {};

      // Log surfaced server-side errors (still 200)
      if (data.error_code || data.error) {
        console.error("API error:", data.error_code || data.error, data.error_message || "");
      }

      setResponseText(data.response_text || "");

      // Tolerate either shape and normalize
      const rawBtns = Array.isArray(data.buttons)
        ? data.buttons
        : (Array.isArray(data.demos) ? data.demos : []);
      const normalized = rawBtns.map((b) => ({
        id: b.id ?? b.demo_id ?? "",
        title: b.title ?? b.name ?? "",
        url: b.url ?? b.value ?? "",
        description: b.description ?? "",
      }));
      console.debug("[ask] buttons:", normalized);
      setButtons(normalized);
    } catch (e) {
      console.error("demo-hal failed:", e);
      setResponseText("Sorry, something went wrong. Please try again.");
      setButtons([]);
    } finally {
      setLoading(false);
    }
  }

  function lookupDemoId(item) {
    if (item?.id) return item.id;
    const byUrl = allDemos.find((d) => d.url && item?.url && d.url === item.url);
    if (byUrl) return byUrl.id;
    const byTitle = allDemos.find((d) => d.title && item?.title && d.title === item.title);
    return byTitle ? byTitle.id : "";
  }

  async function fetchRelatedForSelected(sel) {
    if (!botId || !sel) {
      setButtons([]);
      return;
    }

    // Ensure we have all demos for strong fallback
    const demosCache = await ensureAllDemosLoaded(botId);

    const id = lookupDemoId(sel);
    const params = new URLSearchParams();
    params.set("bot_id", botId);
    if (id) {
      params.set("demo_id", id);
    } else if (sel.url) {
      params.set("demo_url", sel.url);
    } else if (sel.title) {
      params.set("demo_title", sel.title);
    }
    params.set("limit", "12");
    params.set("threshold", "0.40"); // tighter match

    try {
      const res = await fetch(`${apiBase}/related-demos?${params.toString()}`);
      const data = await res.json();
      if (data.error_code || data.error) {
        console.error("related-demos error:", data.error_code || data.error);
      }

      let related = Array.isArray(data?.related) ? data.related : [];
      if (!related.length) {
        // Client fallback: other demos (exclude selected)
        const others = demosCache.filter((d) => (id ? d.id !== id : d.url !== sel.url));
        related = others.map((d) => ({
          title: d.title,
          description: d.description,
          url: d.url,
        }));
      }
      setButtons(related);
    } catch (err) {
      console.warn("[related-demos] fetch failed; using fallback", err);
      const others = demosCache.filter((d) => (id ? d.id !== id : d.url !== sel.url));
      setButtons(
        others.map((d) => ({ title: d.title, description: d.description, url: d.url }))
      );
    }
  }

  // ✅ FIX: do not fetch immediately after setSelectedDemo; let the effect run
  function setSelectedDemoAndLoadRelated(demoLike) {
    const next = {
      id: lookupDemoId(demoLike),
      title: demoLike.title || "",
      url: demoLike.url || demoLike.value || "",
      description: demoLike.description || "",
    };
    setSelectedDemo(next);
    setMode("ask"); // video layout lives in "ask" mode
    // Fetch is handled by the effect that watches botId + selectedDemo
  }

  const breadcrumb = selectedDemo
    ? (selectedDemo.title || "Selected Demo")
    : mode === "browse"
    ? "Browse All Demos"
    : "Ask the Assistant";

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
        style={{ width: "min(720px, 100vw - 16px)", height: "auto", minHeight: 450, maxHeight: "90vh" }}
      >
        {/* Banner */}
        <div className="bg-black text-white px-4 sm:px-6">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
            </div>
            <div className="text-lg sm:text-xl font-semibold text-white truncate max-w-[60%] text-right">
              {breadcrumb}
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
        </div>

        {/* Content area (scrolls). Video frame is sticky on top when shown. */}
        <div className="px-6 pt-3 pb-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {mode === "finished" ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600">Thanks for exploring! We will design this screen next.</p>
            </div>
          ) : mode === "browse" ? (
            <BrowseDemosPanel
              apiBase={apiBase}
              botId={botId}
              onPick={(demo) => setSelectedDemoAndLoadRelated(demo)}
            />
          ) : selectedDemo ? (
            <div className="w-full flex-1 flex flex-col">
              {/* Sticky video frame; small top/bottom padding so it does not collide with banner */}
              <div className="sticky top-0 z-10 bg-white pt-2 pb-3">
                <iframe
                  style={{ width: "100%", aspectRatio: "471 / 272" }}
                  src={selectedDemo.url || selectedDemo.value}
                  title={selectedDemo.title || "Selected demo"}
                  className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Related demos */}
              <p className="text-base italic text-left mb-1">Based on your selection:</p>
              {buttons?.length ? (
                <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                  {buttons.map((b, idx) => (
                    <div key={`${(b.title || b.label || "demo")}-${idx}`} className="relative">
                      <DemoButton
                        item={{ title: b.title || b.label, description: b.description }}
                        idx={idx}
                        onClick={() =>
                          setSelectedDemoAndLoadRelated({
                            title: b.title || b.label,
                            url: b.url || b.value,
                            description: b.description,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-left">No related demos found.</p>
              )}
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {/* Question mirror (shown above response) */}
              {!lastQuestion ? null : (
                <p className="text-base text-black italic">"{lastQuestion}"</p>
              )}

              {/* Bolded prose (includes welcome) */}
              <div className="text-left mt-2">
                {loading ? (
                  <p className="text-gray-500 font-semibold animate-pulse">Thinking...</p>
                ) : (
                  <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                )}
              </div>

              {/* Ask-flow recommendations */}
              {buttons?.length ? (
                <>
                  <p className="text-base italic text-left mt-3 mb-1">Recommended Demos</p>
                  <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                    {buttons.map((b, idx) => (
                      <div key={`${(b.title || b.label || "demo")}-${idx}`} className="relative">
                        <DemoButton
                          item={{ title: b.title || b.label, description: b.description }}
                          idx={idx}
                          onClick={() =>
                            setSelectedDemoAndLoadRelated({
                              title: b.title || b.label,
                              url: b.url || b.value,
                              description: b.description,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-top border-gray-400 border-t">
          <div className="relative w-full">
            <textarea
              rows={1}
              className="w-full border border-gray-400 rounded-lg px-4 py-2 pr-14 text-base resize-y min-h-[3rem] max-h-[160px]"
              placeholder="Ask your question here"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            />
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
