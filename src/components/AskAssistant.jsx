import React, { useEffect, useMemo, useState } from "react";

/** Lightweight local button so this file is self-contained */
function DemoButton({ item, idx = 0, onClick }) {
  const title = (item?.title || item?.label || "Demo").trim();
  const description = (item?.description || "").trim();
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-slate-700 hover:bg-slate-600 text-white px-4 py-4 shadow"
      aria-label={`Demo ${idx + 1}: ${title}`}
    >
      <div className="font-semibold">{title}</div>
      {description ? (
        <div className="text-xs opacity-80 mt-1 line-clamp-2">{description}</div>
      ) : null}
    </button>
  );
}

/** Safe helpers */
const asArray = (v) => (Array.isArray(v) ? v : []);
const entries = (obj) =>
  obj && typeof obj === "object" && !Array.isArray(obj) ? Object.entries(obj) : [];
const values = (v) =>
  Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];

/** MAIN COMPONENT */
export default function AskAssistant(props) {
  // ---- Config ----
  const apiBase =
    (props?.apiBase || import.meta?.env?.VITE_API_BASE || "").replace(/\/+$/, "");
  const urlParams = new URLSearchParams(window.location.search);
  const alias = (props?.alias || urlParams.get("alias") || "demo").trim();

  // ---- State ----
  const [mode, setMode] = useState("ask"); // "ask" | "browse" | "finished"
  const [bot, setBot] = useState(null);
  const [botId, setBotId] = useState("");
  const [allDemos, setAllDemos] = useState([]);
  const [selectedDemo, setSelectedDemo] = useState(null);

  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [askRecs, setAskRecs] = useState([]); // demos from /demo-hal

  const [related, setRelated] = useState({}); // grouped related demos

  // ---- Boot: resolve bot ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = `${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`;
        console.log("[init] GET", url);
        const r = await fetch(url);
        const j = await r.json();
        const b = j?.bot;
        if (!cancelled && b?.id) {
          setBot(b);
          setBotId(b.id);
        }
      } catch (e) {
        console.error("[init] bot-by-alias error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, alias]);

  // ---- Load browse list when we have a bot ----
  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    (async () => {
      try {
        const url = `${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`;
        console.log("[browse] GET", url);
        const r = await fetch(url);
        const j = await r.json();
        const demos = asArray(j?.demos);
        if (!cancelled) setAllDemos(demos);
      } catch (e) {
        console.error("[browse] error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, botId]);

  // ---- Helper: when picking a demo from browse or a related card ----
  const setSelectedDemoAndLoadRelated = async (demo) => {
    if (!demo?.url || !demo?.title) return;
    setSelectedDemo(demo);
    setMode("ask"); // keep single page; video shown at top area
    setRelated({});
    try {
      const url = `${apiBase}/related-demos-grouped?bot_id=${encodeURIComponent(
        botId
      )}&demo_id=${encodeURIComponent(demo.id || "")}&limit=60`;
      console.log("[related-grouped] GET", url);
      const r = await fetch(url);
      const j = await r.json();
      const groups = j?.groups || {};
      console.log("[related-grouped] groups keys:", Object.keys(groups || {}));
      setRelated(groups);
    } catch (e) {
      console.error("[related-grouped] error", e);
      setRelated({});
    }
  };

  // ---- Ask flow ----
  const onAsk = async () => {
    const q = (input || "").trim();
    if (!q || !botId) return;
    setAnswer("");
    setAskRecs([]);
    try {
      const url = `${apiBase}/demo-hal`;
      console.log("[ask] POST", url);
      const body = { bot_id: botId, user_question: q };
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      console.log("[ask] resp", j);
      setAnswer((j?.response_text || "").trim());
      const demos = asArray(j?.demos || j?.buttons);
      setAskRecs(demos);
      setMode("ask");
    } catch (e) {
      console.error("[ask] error", e);
    }
  };

  // ---- Simple header ----
  const Header = () => (
    <div className="w-full flex items-center justify-between gap-4">
      <div className="text-lg font-semibold">DemoHAL</div>
      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1 rounded border ${
            mode === "browse" ? "bg-black text-white" : "bg-white"
          }`}
          onClick={() => setMode("browse")}
        >
          Browse Demos
        </button>
        <button
          className={`px-3 py-1 rounded border ${
            mode === "finished" ? "bg-black text-white" : "bg-white"
          }`}
          onClick={() => setMode("finished")}
        >
          Finish
        </button>
      </div>
    </div>
  );

  // ---- Renderers ----
  const BrowsePanel = () => {
    const [q, setQ] = useState("");
    const list = useMemo(() => {
      const needle = q.toLowerCase();
      const base = asArray(allDemos);
      if (!needle) return base;
      return base.filter((d) =>
        (d?.title || "").toLowerCase().includes(needle)
      );
    }, [q, allDemos]);

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Here are all demos in our library. Just click one to view.
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search demos..."
          className="w-full border rounded px-3 py-2"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {asArray(list).map((d, idx) => (
            <DemoButton
              key={`${d?.id || idx}`}
              item={d}
              idx={idx}
              onClick={() => setSelectedDemoAndLoadRelated(d)}
            />
          ))}
        </div>
      </div>
    );
  };

  const RelatedGroups = () => {
    if (!related || !Object.keys(related || {}).length) return null;
    return (
      <div className="space-y-6">
        {entries(related).map(([groupName, raw]) => {
          const rows = values(raw);
          if (!rows.length) return null;
          return (
            <section key={groupName}>
              <p className="text-base italic text-left mb-1">{groupName}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {asArray(rows).map((b, idx) => (
                  <DemoButton
                    key={`${groupName}-${b?.id || b?.url || idx}`}
                    item={b}
                    idx={idx}
                    onClick={() =>
                      setSelectedDemoAndLoadRelated({
                        id: b?.id,
                        title: b?.title || b?.label,
                        url: b?.url || b?.value,
                        description: b?.description,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  // ---- Layout ----
  return (
    <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
      <Header />

      {/* Ask box */}
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 border rounded px-3 py-2"
          onKeyDown={(e) => e.key === "Enter" && onAsk()}
        />
        <button
          onClick={onAsk}
          className="px-4 py-2 rounded bg-black text-white"
        >
          Ask
        </button>
      </div>

      {/* Modes */}
      {mode === "finished" ? (
        <div className="py-12 text-center text-gray-600">
          Thanks for exploring! We’ll design this screen next.
        </div>
      ) : mode === "browse" ? (
        <BrowsePanel />
      ) : (
        <div className="space-y-6">
          {/* Welcome or answer */}
          {!answer ? (
            <div className="text-gray-700">
              Hello. We’re here to help. Ask anything about our demos or
              products below.
            </div>
          ) : (
            <div className="text-gray-900 leading-relaxed whitespace-pre-wrap">
              {answer}
            </div>
          )}

          {/* Selected video (when present) */}
          {selectedDemo?.url ? (
            <div>
              <div className="sticky top-0 z-10 bg-white pt-2 pb-3">
                <iframe
                  style={{ width: "100%", aspectRatio: "471 / 272" }}
                  src={selectedDemo.url}
                  title={selectedDemo.title || "Selected demo"}
                  className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}

          {/* Ask-mode recommended demos */}
          {asArray(askRecs).length ? (
            <>
              <p className="text-base italic text-left mt-3 mb-1">
                Recommended Demos
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {asArray(askRecs).map((b, idx) => (
                  <DemoButton
                    key={`${b?.id || b?.url || idx}`}
                    item={b}
                    idx={idx}
                    onClick={() =>
                      setSelectedDemoAndLoadRelated({
                        id: b?.id,
                        title: b?.title || b?.label,
                        url: b?.url || b?.value,
                        description: b?.description,
                      })
                    }
                  />
                ))}
              </div>
            </>
          ) : null}

          {/* Grouped related demos for the selected video */}
          <RelatedGroups />
        </div>
      )}

      {/* Tiny debug block – remove when stable */}
      <pre className="text-xs text-gray-500 whitespace-pre-wrap">
{JSON.stringify(
  {
    mode,
    botId,
    alias,
    allDemos: asArray(allDemos).length,
    selectedDemo: selectedDemo
      ? { id: selectedDemo.id, title: selectedDemo.title }
      : null,
    relatedGroups: Object.keys(related || {}).length,
    askRecs: asArray(askRecs).length,
    inputLen: (input || "").length,
  },
  null,
  2
)}
      </pre>
    </div>
  );
}
