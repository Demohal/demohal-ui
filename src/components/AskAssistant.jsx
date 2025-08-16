import React, { useEffect, useMemo, useState } from "react";

function DemoButton({ item, idx, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-white border border-gray-200 shadow hover:shadow-md transition"
    >
      <div className="font-medium">{item.title || `Demo ${idx + 1}`}</div>
      {item.description ? (
        <div className="text-sm text-gray-600 mt-1 line-clamp-3">{item.description}</div>
      ) : null}
    </button>
  );
}

function BrowseDemosPanel({ apiBase, botId, onPick }) {
  const [demos, setDemos] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!botId) return;
    (async () => {
      const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const items = (data?.demos || []).map((d) => ({
        id: d.id || d.demo_id || "",
        title: d.title || "",
        url: d.url || d.value || "",
        description: d.description || "",
      })).filter((x) => x.id && x.title && x.url);
      setDemos(items);
    })();
  }, [apiBase, botId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return demos;
    return demos.filter((d) =>
      (d.title || "").toLowerCase().includes(s) ||
      (d.description || "").toLowerCase().includes(s)
    );
  }, [q, demos]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search demos…"
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {filtered.map((d, idx) => (
          <DemoButton
            key={d.id}
            item={d}
            idx={idx}
            onClick={() => onPick(d)}
          />
        ))}
      </div>
    </div>
  );
}

export default function AskAssistant({ apiBase, botId }) {
  const [mode, setMode] = useState("browse"); // "browse" | "finished"
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [related, setRelated] = useState(null); // grouped object from backend
  const [assistantText, setAssistantText] = useState("");
  const [buttons, setButtons] = useState([]);

  // Select demo + load grouped related
  const setSelectedDemoAndLoadRelated = (demo) => {
    setSelectedDemo(demo);
    setRelated(null);

    if (!demo?.id || !botId) return;
    (async () => {
      try {
        const url = `${apiBase}/related-demos-grouped?bot_id=${encodeURIComponent(
          botId
        )}&demo_id=${encodeURIComponent(demo.id)}&limit=60`;
        const res = await fetch(url);
        const data = await res.json();
        // expect { groups: { "Heading": [ {id,title,url,description}, ... ], ... } }
        const groups = data?.groups && typeof data.groups === "object" ? data.groups : {};
        setRelated(groups);
        console.debug("[related-demos-grouped] groups keys:", Object.keys(groups || {}));
      } catch (e) {
        console.error("[related-demos-grouped] fetch error", e);
        setRelated({});
      }
    })();
  };

  // demo-hal submit
  const askAssistant = async (userQuestion) => {
    setAssistantText("");
    setButtons([]);
    try {
      const payload = { bot_id: botId, user_question: userQuestion || "" };
      const res = await fetch(`${apiBase}/demo-hal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const text = data?.response_text || "";
      const rawList = data?.buttons || data?.demos || [];

      const items = (Array.isArray(rawList) ? rawList : [])
        .map((d) => ({
          id: d.id || d.demo_id || "",
          title: d.title || "",
          url: d.url || d.value || "",
          description: d.description || "",
        }))
        .filter((x) => x.id && x.title && x.url);

      setAssistantText(text);
      setButtons(items);
      setMode("browse"); // keep user on same screen; the answer shows above the browse panel
    } catch (e) {
      console.error("[demo-hal] error", e);
      setAssistantText("Sorry — something went wrong. Please try again.");
      setButtons([]);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top banner / header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">DemoHAL</div>
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1 rounded ${mode === "browse" ? "bg-black text-white" : "bg-gray-100"}`}
              onClick={() => setMode("browse")}
            >
              Browse Demos
            </button>
            <button
              className={`px-3 py-1 rounded ${mode === "finished" ? "bg-black text-white" : "bg-gray-100"}`}
              onClick={() => setMode("finished")}
            >
              Finish
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 pt-3 pb-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
        {/* Quick Q&A box */}
        <div className="max-w-3xl mx-auto w-full">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = e.currentTarget.elements.userq.value.trim();
              if (q) askAssistant(q);
            }}
            className="flex gap-2"
          >
            <input
              name="userq"
              placeholder="Ask a question…"
              className="flex-1 border rounded-lg px-3 py-2"
            />
            <button className="px-4 py-2 rounded bg-black text-white">Ask</button>
          </form>
          {assistantText ? (
            <div className="text-left mt-3 p-3 rounded-lg bg-gray-50">{assistantText}</div>
          ) : null}
          {buttons?.length ? (
            <>
              <p className="text-base italic text-left mt-3 mb-1">Recommended Demos</p>
              <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                {buttons.map((b, idx) => (
                  <div key={`${(b.title || "demo")}-${idx}`} className="relative">
                    <DemoButton
                      item={{ title: b.title, description: b.description }}
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
            </>
          ) : null}
        </div>

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
                          <div key={`${groupName}-${(b.id || b.url || b.title || idx)}`} className="relative">
                            <DemoButton
                              item={{ title: b.title || b.label, description: b.description }}
                              idx={idx}
                              onClick={() =>
                                setSelectedDemoAndLoadRelated({
                                  id: b.id,
                                  title: b.title || b.label,
                                  url: b.url || b.value,
                                  description: b.description,
                                })
                              }
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
        ) : null}
      </div>
    </div>
  );
}
