// src/components/AskAssistant.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

/* --------------------------- Tooltip helpers --------------------------- */
function tooltipAlignClasses(idx) {
  const mobile = "left-1/2 -translate-x-1/2";
  const col = idx % 3;
  if (col === 0) return `${mobile} md:left-0 md:translate-x-0`;
  if (col === 2) return `${mobile} md:right-0 md:left-auto md:translate-x-0`;
  return `${mobile}`;
}

/* A dark-gray demo card like the tabs: full width, uniform height, centered title, white tooltip using DESCRIPTION. */
function DemoButton({ item, idx, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "group relative w-full h-20", // uniform height
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
            // 2-cards wide on md+, clipped by the grid container
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
      <p className="italic mb-3">
        Here are all demos in our library. Just click on the one you want to view.
      </p>
      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search demos..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      {/* Grid container clips tooltips */}
      <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
        {filtered.map((d, idx) => (
          <div key={d.id} className="relative">
            <DemoButton
              item={{ title: d.title, description: d.description }}
              idx={idx}
              onClick={() => onPick(d)} // d includes id,title,description,url
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

  const [mode, setMode] = useState("ask"); // "ask" | "browse" | "finished"
  const [selectedDemo, setSelectedDemo] = useState(null); // {id,title,url,description}
  const [allDemos, setAllDemos] = useState([]); // for ID lookups on related items

  // Bot bootstrap by alias
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

  // Also keep a copy of all demos for id lookups (so related items can be re-opened and re-recommended)
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!botId) return;
      try {
        const params = new URLSearchParams();
        params.set("bot_id", botId);
        const res = await fetch(`${apiBase}/browse-demos?${params.toString()}`);
        const data = await res.json();
        if (!cancel) setAllDemos(Array.isArray(data?.demos) ? data.demos : []);
      } catch {
        if (!cancel) setAllDemos([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [apiBase, botId]);

  // Conversation state (Ask flow)
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState(
    "Hello. I am here to answer any questions you may have about what we offer or who we are. Please enter your question below to begin."
  );
  const [buttons, setButtons] = useState([]); // also used for related-on-video
  const [loading, setLoading] = useState(false);

  // Tabs
  const tabs = useMemo(() => {
    const list = [];
    if (bot?.show_browse_demos) list.push({ key: "demos", label: "Browse Demos" });
    if (bot?.show_schedule_meeting) list.push({ key: "meeting", label: "Schedule Meeting" });
    list.push({ key: "finished", label: "Finished" });
    return list;
  }, [bot]);

  const currentTab =
    mode === "browse" ? "demos" : mode === "finished" ? "finished" : null;

  const handleTab = (key) => {
    if (key === "demos") {
      setMode("browse");
      // Do not clear selectedDemo so a user can return after browsing if desired
      return;
    }
    if (key === "finished") {
      setMode("finished");
      return;
    }
  };

  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();
    setInput("");
    setMode("ask");
    setSelectedDemo(null); // ask flow shows answer + recs based on the answer
    setLastQuestion(outgoing);
    setButtons([]);
    setLoading(true);

    try {
      const payload = { visitor_id: "local-ui", user_question: outgoing, bot_id: botId };
      const res = await axios.post(`${apiBase}/demo-hal`, payload);
      const data = res.data || {};
      setResponseText(data.response_text || "");
      setButtons(Array.isArray(data.buttons) ? data.buttons : []);
    } catch {
      setResponseText("Sorry, something went wrong. Please try again.");
      setButtons([]);
    } finally {
      setLoading(false);
    }
  }

  // ------- New: related demos based on the selected demo (video view) -------
  function lookupDemoId(item) {
    if (item?.id) return item.id;
    const byUrl = allDemos.find((d) => d.url && (d.url === item.url));
    if (byUrl) return byUrl.id;
    const byTitle = allDemos.find((d) => d.title && (d.title === item.title));
    return byTitle ? byTitle.id : "";
  }

  async function fetchRelatedByDemoId(demoId) {
    if (!botId || !demoId) {
      setButtons([]);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("bot_id", botId);
      params.set("demo_id", demoId);
      params.set("limit", "12");
      // If you later add a server-side threshold, you can also pass: params.set("threshold","0.35");
      const res = await fetch(`${apiBase}/related-demos?${params.toString()}`);
      const data = await res.json();
      const related = Array.isArray(data?.related) ? data.related : [];
      setButtons(related);
    } catch {
      setButtons([]);
    }
  }

  async function setSelectedDemoAndLoadRelated(demoLike) {
    const id = lookupDemoId(demoLike);
    const next = {
      id,
      title: demoLike.title || "",
      url: demoLike.url || demoLike.value || "",
      description: demoLike.description || "",
    };
    setSelectedDemo(next);
    setMode("ask"); // show the player screen layout
    await fetchRelatedByDemoId(id);
  }

  const breadcrumb = selectedDemo
    ? (selectedDemo.title || "Selected Demo")
    : mode === "browse"
    ? "Browse All Demos"
    : "Ask the Assistant";

  // Guards
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
            <div className="text-base sm:text-lg font-semibold text-white truncate max-w-[60%] text-right">
              {breadcrumb}
            </div>
          </div>

          {/* Tabs */}
          {tabs.length > 0 && (
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
          )}
        </div>

        {/* Content (scrolls). On video screen the video is sticky so it stays visible at the top while list scrolls */}
        <div className="px-6 pt-3 pb-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {mode === "finished" ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600">Thanks for exploring! We will design this screen next.</p>
            </div>
          ) : mode === "browse" ? (
            <BrowseDemosPanel
              apiBase={apiBase}
              botId={botId}
              onPick={(demo) => {
                // demo from browse has id,title,description,url
                setSelectedDemoAndLoadRelated(demo);
              }}
            />
          ) : selectedDemo ? (
            <div className="w-full flex-1 flex flex-col">
              {/* Sticky video frame so it always remains visible at the top while list scrolls */}
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

              {/* Related to the selected demo */}
              {buttons?.length ? (
                <>
                  <p className="text-base italic text-left mb-1">Based on your selection:</p>
                  <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                    {buttons.map((b, idx) => (
                      <div key={`${(b.title || b.label || "demo")}-${idx}`} className="relative">
                        <DemoButton
                          item={{ title: b.title || b.label, description: b.description }}
                          idx={idx}
                          onClick={() => {
                            // Turn a related button back into a full demo object (needs id lookup)
                            const full = {
                              id: lookupDemoId({ title: b.title || b.label, url: b.url || b.value }),
                              title: b.title || b.label,
                              url: b.url || b.value,
                              description: b.description,
                            };
                            setSelectedDemoAndLoadRelated(full);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {/* Question mirror */}
              {!lastQuestion ? null : (
                <p className="text-base text-black italic">"{lastQuestion}"</p>
              )}

              {/* Prose answer (bolded, including welcome) */}
              <div className="text-left mt-2">
                {loading ? (
                  <p className="text-gray-500 font-semibold animate-pulse">Thinking...</p>
                ) : (
                  <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                )}
              </div>

              {/* Recommended under the prose (ask flow) */}
              {buttons?.length ? (
                <>
                  <p className="text-base italic text-left mt-3 mb-1">Recommended Demos</p>
                  <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                    {buttons.map((b, idx) => (
                      <div key={`${(b.title || b.label || "demo")}-${idx}`} className="relative">
                        <DemoButton
                          item={{ title: b.title || b.label, description: b.description }}
                          idx={idx}
                          onClick={() => {
                            // If a user clicks a rec from the ask flow, switch to player view and load related-by-demo
                            const full = {
                              id: lookupDemoId({ title: b.title || b.label, url: b.url || b.value }),
                              title: b.title || b.label,
                              url: b.url || b.value,
                              description: b.description,
                            };
                            setSelectedDemoAndLoadRelated(full);
                          }}
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
