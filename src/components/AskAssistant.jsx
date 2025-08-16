// AskAssistant.jsx — debug-heavy build (use ?debug=1 to enable logs)

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

/* --------------------------------- Debug --------------------------------- */
const qs = new URLSearchParams(window.location.search);
const DEBUG = qs.get("debug") === "1";
const dlog = (...args) => {
  if (DEBUG) console.log("[UI]", ...args);
};

/* ----------------------------- tiny utilities ---------------------------- */
const list = (v) => (Array.isArray(v) ? v : []); // safe list

function tooltipAlignClasses(idx) {
  const mobile = "left-1/2 -translate-x-1/2";
  const col = idx % 3;
  if (col === 0) return `${mobile} md:left-0 md:translate-x-0`;
  if (col === 2) return `${mobile} md:right-0 md:left-auto md:translate-x-0`;
  return `${mobile}`;
}

/* A single, uniform demo button used everywhere (Ask, Video, Browse) */
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

/* ------------------------------- Browse tab ------------------------------ */
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
        dlog("[browse] GET /browse-demos", params.toString());
        const res = await fetch(`${apiBase}/browse-demos?${params.toString()}`);
        const data = await res.json();
        const lst = Array.isArray(data?.demos) ? data.demos : [];
        dlog("[browse] demos loaded:", lst.length, lst.slice(0, 2));
        if (!cancel) setDemos(lst);
      } catch (e) {
        console.error("[browse] failed:", e);
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
    const out = demos.filter(
      (d) =>
        (d.title || "").toLowerCase().includes(needle) ||
        (d.description || "").toLowerCase().includes(needle)
    );
    dlog("[browse] filter", { q, in: demos.length, out: out.length });
    return out;
  }, [demos, q]);

  if (loading) return <p className="text-gray-500">Loading demos...</p>;
  if (!demos.length) return <p className="text-gray-500">No demos available.</p>;

  return (
    <div className="text-left">
      <p className="italic mb-3">Here are all demos in our library. Just click one to view.</p>

      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search demos…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
        {list(filtered).map((d, idx) => (
          <div key={d.id || d.url || d.title || idx} className="relative">
            <DemoButton
              item={{ title: d.title, description: d.description }}
              idx={idx}
              onClick={() => {
                dlog("[browse] pick", d);
                onPick(d);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Main --------------------------------- */
export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  const [mode, setMode] = useState("ask"); // "ask" | "browse" | "finished"
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [allDemos, setAllDemos] = useState([]); // catalog cache
  const [askRecs, setAskRecs] = useState([]); // ask-flow recs
  const [related, setRelated] = useState({}); // grouped related demos

  const [input, setInput] = useState("");
  const [responseText, setResponseText] = useState(
    "Hello. We’re here to help. Ask anything about our demos or products below."
  );
  const [loading, setLoading] = useState(false);

  // alias → bot lookup
  const alias = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return (q.get("alias") || q.get("a") || "").trim();
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
        dlog("[boot] GET /bot-by-alias", alias);
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`);
        if (!res.ok) throw new Error("Bad alias");
        const data = await res.json();
        const b = data?.bot;
        dlog("[boot] bot:", b);
        if (!b?.id) throw new Error("Bad alias");
        if (!cancel) {
          setBot(b);
          setBotId(b.id);
        }
      } catch (e) {
        console.error("[boot] alias lookup failed:", e);
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase]);

  /* catalog for enrichment / fallbacks */
  async function ensureAllDemosLoaded(currentBotId) {
    if (!currentBotId) return [];
    if (allDemos.length) return allDemos;
    try {
      const params = new URLSearchParams();
      params.set("bot_id", currentBotId);
      dlog("[catalog] GET /browse-demos", params.toString());
      const res = await fetch(`${apiBase}/browse-demos?${params.toString()}`);
      const data = await res.json();
      const lst = Array.isArray(data?.demos) ? data.demos : [];
      dlog("[catalog] demos count:", lst.length, lst.slice(0, 2));
      setAllDemos(lst);
      return lst;
    } catch (e) {
      console.error("[catalog] load failed:", e);
      return [];
    }
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!botId) return;
      const lst = await ensureAllDemosLoaded(botId);
      if (!cancel && lst.length && !allDemos.length) setAllDemos(lst);
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, botId]);

  /* tabs */
  const tabs = useMemo(() => {
    const lst = [];
    if (bot?.show_browse_demos) lst.push({ key: "demos", label: "Browse Demos" });
    if (bot?.show_schedule_meeting) lst.push({ key: "meeting", label: "Schedule Meeting" });
    lst.push({ key: "finished", label: "Finished" });
    return lst;
  }, [bot]);
  const currentTab = mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;
  const handleTab = (key) => {
    dlog("[tabs] click", key);
    if (key === "demos") return setMode("browse");
    if (key === "finished") return setMode("finished");
  };

  /* ------------------------------- helpers ------------------------------- */
  function unifyItem(r, catalog = []) {
    if (typeof r === "string") {
      const meta =
        catalog.find((d) => d.id === r) ||
        catalog.find((d) => (d.title || "").toLowerCase() === r.toLowerCase()) ||
        catalog.find((d) => d.url === r) ||
        null;
      return meta
        ? { id: meta.id, title: meta.title, url: meta.url, description: meta.description }
        : { id: "", title: r, url: "", description: "" };
    }

    const id = r.id || r.demo_id || r.demo_video_id || r.video_id || r.value || r.key || "";
    let meta = id ? catalog.find((d) => d.id === id) || null : null;

    if (!meta && r.url) meta = catalog.find((d) => d.url === r.url) || null;
    if (!meta && r.title) meta = catalog.find((d) => d.title === r.title) || null;

    return {
      id: id || meta?.id || "",
      title: r.title || r.label || meta?.title || "",
      url: r.url || r.value || meta?.url || "",
      description: r.description || meta?.description || "",
    };
  }

  function lookupDemoId(item) {
    if (item?.id) return item.id;
    const byUrl = allDemos.find((d) => d.url && item?.url && d.url === item.url);
    if (byUrl) return byUrl.id;
    const byTitle = allDemos.find((d) => d.title && item?.title && d.title === item.title);
    return byTitle ? byTitle.id : "";
  }

  // set + trigger related fetch in effect
  function setSelectedDemoAndLoadRelated(demoLike) {
    const next = {
      id: lookupDemoId(demoLike) || demoLike.id || "",
      title: demoLike.title || "",
      url: demoLike.url || demoLike.value || "",
      description: demoLike.description || "",
    };
    dlog("[video] setSelectedDemo", next);
    setSelectedDemo(next);
    setMode("ask"); // video layout lives in "ask" mode
  }

  useEffect(() => {
    if (!selectedDemo || !botId) return;
    const demoKey = selectedDemo.id || selectedDemo.url || selectedDemo.title || "unknown";
    dlog("[related] effect trigger for", demoKey);

    (async () => {
      try {
        // try grouped endpoint
        let groupsObj = null;
        {
          const url = `${apiBase}/related-demos-grouped?bot_id=${encodeURIComponent(
            botId
          )}&demo_id=${encodeURIComponent(selectedDemo.id || "")}`;
          dlog("[related] GET grouped", url);
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            groupsObj = data?.groups || null;
            dlog("[related] grouped ok:", groupsObj && Object.keys(groupsObj));
          } else {
            dlog("[related] grouped status:", res.status);
          }
        }
        // fallback to flat endpoint
        if (!groupsObj) {
          const url = `${apiBase}/related-demos?bot_id=${encodeURIComponent(
            botId
          )}&demo_id=${encodeURIComponent(selectedDemo.id || "")}&limit=24`;
          dlog("[related] GET flat", url);
          const res2 = await fetch(url);
          const data2 = await res2.json();
          const flat = (data2?.related || data2?.buttons || data2?.demos || []).map((d) => d);
          dlog("[related] flat size:", flat.length, flat.slice(0, 3));
          groupsObj = flat.length ? { Related: flat } : {};
        }

        const catalog = await ensureAllDemosLoaded(botId);
        const enriched = {};
        for (const [name, raw] of Object.entries(groupsObj || {})) {
          const rows = Array.isArray(raw)
            ? raw
            : raw && typeof raw === "object"
            ? Object.values(raw)
            : [];
          const norm = rows
            .map((r) => unifyItem(r, catalog))
            .filter((b) => b.title && (b.url || lookupDemoId(b)));
          if (norm.length) enriched[name] = norm;
        }
        dlog("[related] enriched groups:", Object.fromEntries(Object.entries(enriched).map(([k, v]) => [k, v.length])));
        setRelated(enriched);
      } catch (e) {
        console.error("[related] fetch failed:", e);
        setRelated({});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, selectedDemo?.id, selectedDemo?.url, selectedDemo?.title]);

  /* -------------------------------- ask flow ----------------------------- */
  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();
    setInput("");
    setMode("ask");
    setSelectedDemo(null);
    setAskRecs([]);
    setLoading(true);

    try {
      const payload = { visitor_id: "local-ui", user_question: outgoing, bot_id: botId };
      dlog("[ask] POST /demo-hal payload:", payload);
      const res = await axios.post(`${apiBase}/demo-hal`, payload);
      const data = res.data || {};
      dlog("[ask] response keys:", Object.keys(data || {}));

      if (data.error_code || data.error) {
        console.error("API error:", data.error_code || data.error, data.error_message || "");
      }

      setResponseText(data.response_text || "");

      const recs = Array.isArray(data.demos)
        ? data.demos
        : Array.isArray(data.buttons)
        ? data.buttons
        : [];

      const catalog = await ensureAllDemosLoaded(botId);
      const normalized = list(recs).map((r) => unifyItem(r, catalog));
      const finalBtns = normalized.filter((b) => b.title);
      dlog("[ask] recs normalized:", finalBtns.length, finalBtns.slice(0, 3));
      setAskRecs(finalBtns);
    } catch (e) {
      console.error("demo-hal failed:", e);
      setResponseText("Sorry, something went wrong. Please try again.");
      setAskRecs([]);
    } finally {
      setLoading(false);
    }
  }

  const breadcrumb = selectedDemo
    ? selectedDemo.title || "Selected Demo"
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
            {list(tabs).map((t) => {
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
              {/* Sticky video frame */}
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

              {/* Related demos grouped by dimension */}
              {related && Object.keys(related || {}).length ? (
                <div className="space-y-6">
                  {Object.entries(related || {}).map(([groupName, rawList]) => {
                    const rows = Array.isArray(rawList)
                      ? rawList
                      : rawList && typeof rawList === "object"
                      ? Object.values(rawList)
                      : [];
                    return (
                      <section key={groupName}>
                        <p className="text-base italic text-left mb-1">{groupName}</p>
                        <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                          {rows.map((b, idx) => (
                            <div
                              key={`${groupName}-${(b.id || b.url || b.title || idx)}`}
                              className="relative"
                            >
                              <DemoButton
                                item={{ title: b.title || b.label, description: b.description }}
                                idx={idx}
                                onClick={() => {
                                  dlog("[related] pick", b);
                                  setSelectedDemoAndLoadRelated({
                                    title: b.title || b.label,
                                    url: b.url || b.value,
                                    description: b.description,
                                  });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            /* -------- ASK MODE (welcome + answer + recommended buttons) -------- */
            <div className="text-left space-y-4">
              <p className="text-gray-800 whitespace-pre-wrap">{responseText}</p>
              {askRecs.length ? (
                <>
                  <p className="text-base italic mb-1">Recommended Demos</p>
                  <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                    {askRecs.map((b, idx) => (
                      <div key={`${b.id || b.url || b.title || idx}`} className="relative">
                        <DemoButton
                          item={{ title: b.title, description: b.description }}
                          idx={idx}
                          onClick={() => {
                            dlog("[ask] pick", b);
                            setSelectedDemoAndLoadRelated({
                              title: b.title,
                              url: b.url,
                              description: b.description,
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              {loading ? <p className="text-gray-500">Thinking…</p> : null}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-300">
          <div className="relative w-full">
            <textarea
              rows={1}
              className="w-full border border-gray-400 rounded-lg px-4 py-2 pr-14 text-base resize-y min-h-[3rem] max-h-[160px]"
              placeholder="Ask your question here"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
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

        {/* Inline debug panel */}
        {DEBUG ? (
          <div className="px-4 pb-3 border-t border-gray-200 text-left text-xs text-gray-700 bg-gray-50">
            <pre className="whitespace-pre-wrap">
{JSON.stringify(
  {
    mode,
    botId,
    alias,
    allDemos: allDemos.length,
    selectedDemo,
    related: Object.fromEntries(Object.entries(related || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
    askRecs: askRecs.length,
    inputLen: input.length,
  },
  null,
  2
)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
