import React, { useEffect, useMemo, useRef, useState } from "react";

/** Simple pill-style demo button */
function DemoButton({ item, idx, onClick }) {
  const title = item?.title || item?.label || "Demo";
  const desc = item?.description || "";
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl px-5 py-6 bg-slate-700 text-white hover:bg-slate-600 shadow"
      aria-label={`demo-${idx}`}
    >
      <div className="font-semibold">{title}</div>
      {desc ? <div className="opacity-80 text-sm mt-1">{desc}</div> : null}
    </button>
  );
}

/** One-liner helper */
const safeArr = (v) => (Array.isArray(v) ? v : []);

/** Turn a flat list into a single default group */
const asDefaultGroup = (list, group = "Recommended") => ({
  [group]: safeArr(list),
});

/** Normalize a messy backend payload into groups -> array<demo> */
function normalizeRelatedPayload(payload) {
  // Accept shapes:
  //  - { groups: { functions:[...], modules:[...], industries:[...] } }
  //  - { related: [...] }
  //  - { demos: [...] } or { buttons: [...] }
  if (!payload || typeof payload !== "object") return {};

  if (payload.groups && typeof payload.groups === "object") {
    const out = {};
    for (const [g, v] of Object.entries(payload.groups)) {
      if (Array.isArray(v)) out[g] = v;
    }
    return out;
  }
  if (Array.isArray(payload.related)) return asDefaultGroup(payload.related);
  if (Array.isArray(payload.demos)) return asDefaultGroup(payload.demos);
  if (Array.isArray(payload.buttons)) return asDefaultGroup(payload.buttons);
  return {};
}

export default function AskAssistant({
  apiBase = "https://demohal-app.onrender.com",
  alias = "demo",
}) {
  // core state
  const [mode, setMode] = useState("ask"); // "ask" | "browse" | "finished"
  const [botId, setBotId] = useState("");
  const [allDemos, setAllDemos] = useState([]);
  const [selectedDemo, setSelectedDemo] = useState(null);

  // results
  const [answer, setAnswer] = useState("");
  const [askRecs, setAskRecs] = useState([]); // recommendations from /demo-hal
  const [related, setRelated] = useState({}); // grouped recommendations for a selected demo

  // debug
  const [netlog, setNetlog] = useState([]);
  const appendLog = (line) =>
    setNetlog((prev) => [...prev.slice(-40), `${new Date().toISOString()} ${line}`]);

  // input
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  /** Resolve bot by alias on mount */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        appendLog(`[init] GET /bot-by-alias?alias=${alias}`);
        const res = await fetch(`${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (!active) return;

        const id = data?.bot?.id || data?.id || data?.bot_id || "";
        setBotId(id || "");
        appendLog(`[init] botId=${id || "(missing)"}`);

        // pre-load demos for Browse
        if (id) {
          appendLog(`[init] GET /browse-demos?bot_id=${id}`);
          const br = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(id)}`);
          const bj = await br.json();
          const demos = safeArr(bj?.demos).map((d) => ({
            id: d.id || d.demo_id || d.value || "",
            title: d.title || d.label || "",
            url: d.url || d.value || "",
            description: d.description || "",
          }));
          setAllDemos(demos);
          appendLog(`[init] browse count=${demos.length}`);
        }
      } catch (e) {
        appendLog(`[init][err] ${e?.message || e}`);
      }
    })();
    return () => {
      active = false;
    };
  }, [apiBase, alias]);

  /** Fetch related for a picked demo (grouped first, fallback to flat) */
  const fetchRelatedForSelected = async (demo) => {
    if (!botId || !demo?.id) {
      appendLog(`[related] skipped botId=${botId ? "ok" : "missing"} demo.id=${demo?.id || "missing"}`);
      return;
    }
    try {
      // grouped attempt
      const gUrl = `${apiBase}/related-demos-grouped?bot_id=${encodeURIComponent(
        botId
      )}&demo_id=${encodeURIComponent(demo.id)}&limit=24`;
      appendLog(`[related] GET ${gUrl}`);
      let res = await fetch(gUrl);
      if (res.ok) {
        const gj = await res.json();
        const groups = normalizeRelatedPayload(gj);
        const groupsCount = Object.values(groups).reduce((a, v) => a + safeArr(v).length, 0);
        appendLog(`[related] grouped ok groups=${Object.keys(groups).length} items=${groupsCount}`);

        // Strip self if present
        for (const [k, arr] of Object.entries(groups)) {
          groups[k] = safeArr(arr).filter((x) => (x.id || x.demo_id || "") !== demo.id);
        }
        setRelated(groups);
        return;
      }

      // fallback to flat
      const fUrl = `${apiBase}/related-demos?bot_id=${encodeURIComponent(
        botId
      )}&demo_id=${encodeURIComponent(demo.id)}&limit=24`;
      appendLog(`[related] GET ${fUrl} (fallback)`);
      res = await fetch(fUrl);
      const fj = await res.json();
      const flatGroups = normalizeRelatedPayload(fj);
      for (const [k, arr] of Object.entries(flatGroups)) {
        flatGroups[k] = safeArr(arr).filter((x) => (x.id || x.demo_id || "") !== demo.id);
      }
      const itemsCount = Object.values(flatGroups).reduce((a, v) => a + safeArr(v).length, 0);
      appendLog(`[related] flat ok items=${itemsCount}`);
      setRelated(flatGroups);
    } catch (e) {
      appendLog(`[related][err] ${e?.message || e}`);
    }
  };

  /** Ensure we auto-fetch related when selected changes */
  useEffect(() => {
    if (selectedDemo?.id && botId) {
      fetchRelatedForSelected(selectedDemo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDemo?.id, botId]);

  /** Pick a demo from Browse and fetch related immediately */
  const setSelectedDemoAndLoadRelated = (demo) => {
    const picked = {
      id: demo?.id || demo?.demo_id || "",
      title: demo?.title || demo?.label || "",
      url: demo?.url || demo?.value || "",
      description: demo?.description || "",
    };
    setSelectedDemo(picked);
    setMode("ask"); // keep single-screen UX
    setRelated({});
    appendLog(`[pick] ${picked.id} "${picked.title}"`);
    fetchRelatedForSelected(picked);
  };

  /** Ask the assistant */
  const ask = async () => {
    if (!botId || !input.trim()) return;
    try {
      const body = {
        bot_id: botId,
        user_question: input.trim(),
      };
      appendLog(`[ask] POST /demo-hal (len=${body.user_question.length})`);
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      setAnswer(data?.response_text || data?.text || "");
      // Normalize possible rec fields
      const raw =
        safeArr(data?.buttons)?.length
          ? data.buttons
          : safeArr(data?.demos)?.length
          ? data.demos
          : safeArr(data?.related);
      const mapped = safeArr(raw).map((d) => ({
        id: d.id || d.demo_id || "",
        title: d.title || d.label || "",
        url: d.url || d.value || "",
        description: d.description || "",
      }));
      setAskRecs(mapped);
      appendLog(`[ask] recs=${mapped.length}`);
    } catch (e) {
      appendLog(`[ask][err] ${e?.message || e}`);
    }
  };

  /** Browse-screen filter */
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return allDemos;
    return safeArr(allDemos).filter(
      (d) =>
        (d.title || "").toLowerCase().includes(needle) ||
        (d.description || "").toLowerCase().includes(needle)
    );
  }, [q, allDemos]);

  /** Render helpers */
  const Debug = () => {
    const obj = {
      mode,
      botId,
      alias,
      allDemos: allDemos.length,
      selectedDemo,
      related,
      askRecs: askRecs.length,
      inputLen: input.length,
    };
    return (
      <pre className="text-xs bg-slate-50 border rounded p-3 overflow-auto max-h-64 mt-4">
        {JSON.stringify(obj, null, 2)}
      </pre>
    );
  };

  const NetLog = () => (
    <pre className="text-[10px] bg-slate-50 border rounded p-2 overflow-auto max-h-40 mt-2">
      {safeArr(netlog).join("\n")}
    </pre>
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-2 items-center mb-4">
        <button
          className={`px-4 py-2 rounded ${mode === "browse" ? "bg-slate-700 text-white" : "bg-slate-200"}`}
          onClick={() => setMode("browse")}
        >
          Browse Demos
        </button>
        <button
          className={`px-4 py-2 rounded ${mode === "ask" ? "bg-slate-700 text-white" : "bg-slate-200"}`}
          onClick={() => setMode("ask")}
        >
          Schedule Meeting
        </button>
        <button
          className={`px-4 py-2 rounded ${mode === "finished" ? "bg-slate-700 text-white" : "bg-slate-200"}`}
          onClick={() => setMode("finished")}
        >
          Finished
        </button>
        <div className="ml-auto font-semibold text-lg">
          {selectedDemo?.title || (mode === "browse" ? "Browse All Demos" : "Ask the Assistant")}
        </div>
      </div>

      {/* Top notice (welcome) */}
      {mode === "ask" && !selectedDemo ? (
        <div className="rounded border bg-white p-4 mb-3">
          Hello. We’re here to help. Ask anything about our demos or products below.
        </div>
      ) : null}

      {/* Ask box */}
      <div className="rounded border bg-white p-3 mb-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 border rounded px-3 py-2"
            placeholder="Ask your question here"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
          />
          <button
            className="px-4 py-2 rounded bg-red-600 text-white"
            onClick={ask}
            title="Ask"
          >
            ⬆
          </button>
        </div>
        {answer ? (
          <div className="mt-3 p-3 bg-slate-50 rounded border text-left whitespace-pre-wrap">{answer}</div>
        ) : null}
        {/* Ask recs */}
        {askRecs.length ? (
          <>
            <p className="text-base italic text-left mt-3 mb-1">Recommended Demos</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {safeArr(askRecs).map((b, idx) => (
                <div key={`ask-${b.id || b.url || idx}`} className="relative">
                  <DemoButton
                    item={b}
                    idx={idx}
                    onClick={() =>
                      setSelectedDemoAndLoadRelated({
                        id: b.id || b.demo_id || "",
                        title: b.title || b.label || "",
                        url: b.url || b.value || "",
                        description: b.description || "",
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Mode blocks */}
      {mode === "finished" ? (
        <div className="rounded border bg-white p-6 text-center text-gray-600">
          Thanks for exploring! We will design this screen next.
        </div>
      ) : mode === "browse" ? (
        <div className="rounded border bg-white p-4">
          <p className="mb-3">Here are all demos in our library. Just click one to view.</p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search demos..."
            className="w-full border rounded px-3 py-2 mb-4"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {safeArr(filtered).map((d, idx) => (
              <div key={`browse-${d.id || d.title || idx}`}>
                <DemoButton
                  item={d}
                  idx={idx}
                  onClick={() => setSelectedDemoAndLoadRelated(d)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : selectedDemo ? (
        <div className="rounded border bg-white p-4">
          {/* Video */}
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

          {/* Related */}
          <div className="mt-4 space-y-6">
            {Object.keys(related || {}).length ? (
              Object.entries(related || {}).map(([groupName, raw]) => {
                const rows = safeArr(raw).map((d) => ({
                  id: d.id || d.demo_id || "",
                  title: d.title || d.label || "",
                  url: d.url || d.value || "",
                  description: d.description || "",
                }));
                if (!rows.length) return null;
                return (
                  <section key={groupName}>
                    <p className="text-base italic text-left mb-1">{groupName}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {rows.map((b, idx) => (
                        <div key={`${groupName}-${b.id || b.url || idx}`} className="relative">
                          <DemoButton
                            item={b}
                            idx={idx}
                            onClick={() =>
                              setSelectedDemoAndLoadRelated({
                                id: b.id,
                                title: b.title,
                                url: b.url,
                                description: b.description,
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })
            ) : (
              <div className="text-sm text-gray-500">Loading related demos…</div>
            )}
          </div>
        </div>
      ) : null}

      {/* Debug */}
      <Debug />
      <NetLog />
    </div>
  );
}
