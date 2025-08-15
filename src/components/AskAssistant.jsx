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
        {(Array.isArray(filtered) ? filtered : []).map((d, idx) => (
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
  const [buttons, setButtons] = useState([]); // ask-flow recs
  const [related, setRelated] = useState([]);        // flat list for existing UI
  const [relatedGroups, setRelatedGroups] = useState({}); // optional grouped view

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

      // Recommendations can be under `demos` (preferred) or `buttons`
      const recs = Array.isArray(data.demos)
        ? data.demos
        : (Array.isArray(data.buttons) ? data.buttons : []);
      
      // Ensure we have the full catalog to enrich id-only items
      const catalog = await ensureAllDemosLoaded(botId);
      
      // Join by id → url/description (fallbacks: url, then title)
      const normalized = (Array.isArray(recs) ? recs : Object.values(recs || {}).flat()).map((r) => {
        const id = r.id ?? r.demo_id ?? null;
        let meta = null;
        if (id) meta = catalog.find((d) => d.id === id) || null;
        if (!meta && r.url) meta = catalog.find((d) => d.url === r.url) || null;
        if (!meta && r.title) meta = catalog.find((d) => d.title === r.title) || null;
      
        return {
          id: id || meta?.id || "",
          title: r.title || meta?.title || "",
          url: r.url || meta?.url || "",
          description: r.description || meta?.description || "",
        };
      });
      
      // Keep only items with a title so the grid renders reliably
      const finalBtns = normalized.filter((b) => b.title);
      console.debug("[ask] recs:", finalBtns);
      setButtons(finalBtns);

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

  async function fetchRelatedForSelected(demo) {
  try {
    if (!demo?.id || !botId) return;

    const url = `${apiBase}/related-demos?bot_id=${encodeURIComponent(
      botId
    )}&demo_id=${encodeURIComponent(demo.id)}&limit=6`;

    const res = await fetch(url);
    const data = await res.json();

    // Accept BOTH shapes:
    //  A) flat: { related | buttons | demos: [...] }
    //  B) grouped: { groups: { "Construction":[...], "Project Mgmt":[...] } }
    const groups =
      data && typeof data.groups === "object" && !Array.isArray(data.groups)
        ? data.groups
        : null;

    const rawList = groups
      ? Object.values(groups).flat()
      : (data?.related || data?.buttons || data?.demos || []);

    const items = (
          Array.isArray(rawList)
            ? rawList
            : Object.values(rawList || {}).flat()
        ).map((d) => ({
        id: d.id || d.demo_id || "",
        title: d.title || "",
        url: d.url || d.value || "",
        description: d.description || "",
        action: "demo",
      }))
      .filter((x) => x.id && x.title && x.url);

    // Keep flat list for existing UI to avoid .map errors
    setRelated(items);

    // Keep grouped (optional future UI)
    if (groups) setRelatedGroups(groups);
    else setRelatedGroups({});
  } catch {
    setRelated([]);
    setRelatedGroups({});
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
            {(Array.isArray(tabs) ? tabs : Object.values(tabs || {})).map((t) => {
                const key = t.key ?? t.id ?? String(t);
                const active = currentTab === key;
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

              {(() => {
                // Accept both shapes:
                // - related = { groups: { "Construction": [...], ... } }
                // - related = { "Construction": [...], ... }
                // - related = [ ... ]  (fallback -> "Related demos")
                const rel = related?.groups ?? related;
                const groups = Array.isArray(rel) ? { "Related demos": rel } : (rel || {});
                const entries = Object.entries(groups).filter(([, arr]) => Array.isArray(arr) && arr.length);
                if (!entries.length) return null;
              
                return (
                  <div className="space-y-6">
                    {entries.map(([groupName, items]) => (
                      <section key={groupName}>
                        <p className="text-base italic text-left mb-1">{groupName}</p>
              
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {items.map((d) => {
                            const id = d.id || d.demo_id || d.value || "";
                            const title = d.title || d.name || "";
                            const url = d.url || d.value || "";
                            const description = d.description || "";
                            if (!id || !title || !url) return null;
              
                            return (
                              <button
                                key={`${groupName}:${id}`}
                                onClick={() =>
                                  setSelectedDemo({ id, title, url, description })
                                }
                                className="text-left px-3 py-2 rounded-xl border hover:bg-muted"
                              >
                                <div className="font-medium">{title}</div>
                                {description ? (
                                  <div className="text-xs text-muted-foreground line-clamp-2">
                                    {description}
                                  </div>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                );
              })()}

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
              {Array.isArray(buttons) && buttons.length > 0 ? (
                <>
                  <p className="text-base italic text-left mt-3 mb-1">Recommended Demos</p>
                  <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[...buttons]
                      .filter(Boolean)
                      .map((b) => ({
                        id: b.id || b.demo_id || b.value || "",
                        title: b.title || b.label || "",
                        url: b.url || b.value || "",
                        description: b.description || "",
                        score:
                          typeof b.score === "number"
                            ? b.score
                            : typeof b.similarity === "number"
                            ? b.similarity
                            : null,
                      }))
                      .filter((x) => x.id && x.title && x.url)
                      // order by score desc when present; otherwise keep original order
                      .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
                      .map((item, idx) => (
                        <div key={`${item.id || item.title}-${idx}`} className="relative">
                          <DemoButton
                            item={{ title: item.title, description: item.description }}
                            idx={idx}
                            onClick={() => setSelectedDemoAndLoadRelated(item)}
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
