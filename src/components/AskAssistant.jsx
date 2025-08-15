// src/components/AskAssistant.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function AskAssistant({ apiBase, initialBot }) {
  const [bot, setBot] = useState(initialBot || null);
  const [botId, setBotId] = useState(initialBot?.id || "");
  const [mode, setMode] = useState("ask"); // "ask" | "browse"
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [demos, setDemos] = useState([]); // browse catalog
  const [selectedDemo, setSelectedDemo] = useState(null); // {id,title,url,description}
  const [groupedRelated, setGroupedRelated] = useState(null); // {groups:[{family,title,labels,items:[...]}, ...]}
  const [flatRelated, setFlatRelated] = useState([]); // fallback/compat
  const [loadingRecs, setLoadingRecs] = useState(false);

  // ---- Load bot by alias if not provided ----
  useEffect(() => {
    async function init() {
      try {
        if (bot) return;
        const alias = new URLSearchParams(window.location.search).get("alias") || "demo";
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (data?.bot) {
          setBot(data.bot);
          setBotId(data.bot.id);
        }
      } catch {
        // ignore
      }
    }
    init();
  }, [apiBase, bot]);

  // ---- Load demo catalog for browse ----
  useEffect(() => {
    async function loadDemos() {
      if (!botId) return;
      try {
        const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
        const data = await res.json();
        setDemos(data?.demos || []);
      } catch {
        setDemos([]);
      }
    }
    loadDemos();
  }, [apiBase, botId]);

  // ---- Helpers ----
  function lookupDemoId(demoLike) {
    // Prefer explicit id; otherwise attempt to match by title
    if (demoLike?.id) return demoLike.id;
    const title = (demoLike?.title || "").toLowerCase().trim();
    const found = demos.find((d) => (d.title || "").toLowerCase().trim() === title);
    return found?.id || "";
    }

  async function fetchRelatedGrouped(demo) {
    try {
      if (!demo?.id || !botId) return;
      setLoadingRecs(true);
      setGroupedRelated(null);
      setFlatRelated([]);

      // Preferred: grouped endpoint (no hard cap)
      const gUrl = `${apiBase}/related-demos-grouped?bot_id=${encodeURIComponent(
        botId
      )}&demo_id=${encodeURIComponent(demo.id)}`;
      const gres = await fetch(gUrl);
      const gdat = await gres.json();
      const groups = Array.isArray(gdat?.groups) ? gdat.groups : [];

      if (groups.length > 0) {
        setGroupedRelated({ groups });
        setLoadingRecs(false);
        return;
      }

      // Fallback: flat list (compat) — keep old 6-cap if the endpoint enforces it
      const fUrl = `${apiBase}/related-demos?bot_id=${encodeURIComponent(
        botId
      )}&demo_id=${encodeURIComponent(demo.id)}&limit=6`;
      const fres = await fetch(fUrl);
      const fdat = await fres.json();
      const items = (fdat?.related || []).map((d) => ({
        id: d.id || d.demo_id || "",
        title: d.title || "",
        url: d.url || d.value || "",
        description: d.description || "",
      })).filter((x) => x.id && x.title && x.url);

      setFlatRelated(items);
      setLoadingRecs(false);
    } catch {
      setGroupedRelated(null);
      setFlatRelated([]);
      setLoadingRecs(false);
    }
  }

  async function setSelectedDemoAndLoadRelated(demoLike) {
    const next = {
      id: lookupDemoId(demoLike),
      title: demoLike.title || "",
      url: demoLike.url || demoLike.value || "",
      description: demoLike.description || "",
    };
    setSelectedDemo(next);
    setMode("ask"); // video layout lives in "ask" mode
    if (botId && next.id) {
      await fetchRelatedGrouped(next);
    }
  }

  // If a demo was picked before bot loaded, trigger once both ready
  useEffect(() => {
    if (!selectedDemo || !botId) return;
    fetchRelatedGrouped(selectedDemo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, selectedDemo?.id]);

  // ---- Ask (demo-hal) ----
  async function submitQuestion() {
    const q = input.trim();
    if (!q || !botId) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    try {
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, user_question: q }),
      });
      const data = await res.json();
      const answer = data?.response_text || "";
      const recs = (data?.buttons || data?.demos || []).filter((b) => b?.id && b?.title && b?.url);
      setMessages((prev) => [...prev, { role: "assistant", content: answer, recs }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry — something went wrong." }]);
    }
  }

  // ---- Render ----
  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        <button
          className={`px-3 py-2 rounded ${mode === "ask" ? "bg-gray-200" : "bg-gray-100"}`}
          onClick={() => setMode("ask")}
        >
          Ask Assistant
        </button>
        <button
          className={`px-3 py-2 rounded ${mode === "browse" ? "bg-gray-200" : "bg-gray-100"}`}
          onClick={() => setMode("browse")}
        >
          Browse Demos
        </button>
      </div>

      {/* Ask mode: left = video (if selected) + grouped related; right = Q&A */}
      {mode === "ask" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Video + Related */}
          <div>
            {selectedDemo ? (
              <>
                <div className="mb-4">
                  <div className="text-lg font-semibold text-center">{selectedDemo.title}</div>
                  <div className="mt-2 aspect-video bg-black rounded overflow-hidden">
                    <iframe
                      title={selectedDemo.title}
                      src={selectedDemo.url}
                      allow="autoplay; fullscreen"
                      className="w-full h-full"
                    />
                  </div>
                </div>

                {/* Grouped related (unlimited) */}
                {loadingRecs && <div className="text-sm text-gray-600">Finding related demos…</div>}
                {groupedRelated?.groups?.length > 0 && (
                  <div className="space-y-6">
                    {groupedRelated.groups.map((g, idx) => (
                      <div key={idx}>
                        <div className="font-semibold mb-2">{g.title}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {g.items.map((it) => (
                            <button
                              key={it.id}
                              className="w-full text-center px-3 py-3 rounded bg-gray-200 hover:bg-gray-300 truncate"
                              onClick={() => setSelectedDemoAndLoadRelated(it)}
                              title={it.description || it.title}
                            >
                              <div className="font-medium leading-tight">
                                {it.title}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Flat fallback (old 6-cap) */}
                {!loadingRecs && !groupedRelated?.groups?.length && flatRelated?.length > 0 && (
                  <div className="mt-4">
                    <div className="font-semibold mb-2">Related demos</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {flatRelated.map((it) => (
                        <button
                          key={it.id}
                          className="w-full text-center px-3 py-3 rounded bg-gray-200 hover:bg-gray-300 truncate"
                          onClick={() => setSelectedDemoAndLoadRelated(it)}
                          title={it.description || it.title}
                        >
                          <div className="font-medium leading-tight">
                            {it.title}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-600">Select a demo from Browse to start the player.</div>
            )}
          </div>

          {/* Q&A */}
          <div>
            <div className="mb-2 font-semibold">Ask a question</div>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded px-3 py-2"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question…"
                onKeyDown={(e) => e.key === "Enter" && submitQuestion()}
              />
              <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitQuestion}>
                Ask
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`${m.role === "user" ? "" : "bg-gray-50"} p-3 rounded`}>
                  <div className="text-sm font-semibold mb-1">{m.role === "user" ? "You" : "Assistant"}</div>
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Ask recommended demos (flat, ordered by score, unlimited) */}
                  {m.role !== "user" && Array.isArray(m.recs) && m.recs.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm text-gray-700 mb-1">
                        Based on your question, we’ve recommended demos below you might find informative.
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {m.recs.map((it) => (
                          <button
                            key={it.id}
                            className="w-full text-center px-3 py-3 rounded bg-gray-200 hover:bg-gray-300 truncate"
                            onClick={() => setSelectedDemoAndLoadRelated(it)}
                            title={it.description || it.title}
                          >
                            <div className="font-medium leading-tight">
                              {it.title}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Browse mode: simple grid of demos */}
      {mode === "browse" && (
        <div>
          <div className="mb-3 text-sm text-gray-700">Browse all demos</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {demos.map((d) => (
              <button
                key={d.id}
                className="w-full text-center px-3 py-3 rounded bg-gray-200 hover:bg-gray-300 truncate"
                onClick={() => setSelectedDemoAndLoadRelated(d)}
                title={d.description || d.title}
              >
                <div className="font-medium leading-tight">
                  {d.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
