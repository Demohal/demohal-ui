
// src/components/AskAssistant.jsx — App v3 (Grouped buttons: Industry → Supergroup)
// - Renders grouped sections returned by /demo-hal and /browse-demos
// - Skips "General Business" on the server; UI just renders provided sections
// - Falls back to flat buttons if sections are missing

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

/* --------------------------------- UI bits -------------------------------- */
function tooltipAlign(idx) {
  const mobile = "left-1/2 -translate-x-1/2";
  const col = idx % 3;
  if (col === 0) return `${mobile} md:left-0 md:translate-x-0`;
  if (col === 2) return `${mobile} md:right-0 md:left-auto md:translate-x-0`;
  return `${mobile}`;
}

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
            tooltipAlign(idx),
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

/* ---------------------- Shared grouped rendering widget ------------------- */
function GroupedSections({ sections, onPick }) {
  if (!Array.isArray(sections) || sections.length === 0) return null;

  return (
    <>
      {sections.map((s, secIdx) => {
        const buttons = Array.isArray(s.buttons) ? s.buttons : [];

        return (
          <section key={`${s.kind || "sec"}-${s.title || secIdx}`} className="mb-6">
            <div className="mb-2">
              <span className="inline-block rounded-md px-2 py-1 text-xs uppercase tracking-wide bg-gray-900 text-white">
                {s.kind === "industry" ? "Industry" : s.kind === "supergroup" ? "Supergroup" : "All"}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-black">{s.title || "Demos"}</h3>
              <p className="text-sm text-gray-600 italic">
                {s.help_text ||
                  (s.kind === "industry"
                    ? `Demos tailored for the ${s.title} industry.`
                    : s.kind === "supergroup"
                    ? `Related demos by topic: ${s.title}.`
                    : "Browse available demos.")}
              </p>
            </div>

            <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
              {buttons.map((b, idx) => (
                <div key={`${b.id || b.url || b.title || idx}`} className="relative">
                  <DemoButton
                    item={{ title: b.title, description: b.description }}
                    idx={idx}
                    onClick={() =>
                      onPick?.({
                        id: b.id || "",
                        title: b.title || "",
                        url: b.url || "",
                        description: b.description || "",
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* --------------------------- Ask-flow utilities -------------------------- */
function dedupeByIdAndUrl(list, limit = 6) {
  const out = [];
  const ids = new Set();
  const urls = new Set();
  for (const x of list || []) {
    const id = (x.id || "").trim();
    const url = (x.url || "").trim().toLowerCase();
    if (id && ids.has(id)) continue;
    if (url && urls.has(url)) continue;
    out.push(x);
    if (id) ids.add(id);
    if (url) urls.add(url);
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------- Browse tab ------------------------------ */
function BrowseDemosPanel({ apiBase, botId, onPick, onSectionsLoaded }) {
  const [sections, setSections] = useState([]);
  const [demos, setDemos] = useState([]); // flat list for search fallback
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!botId) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("bot_id", botId);
        const res = await fetch(`${apiBase}/browse-demos?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancel) return;
        const secs = Array.isArray(data?.sections) ? data.sections : [];
        const flat = Array.isArray(data?.demos) ? data.demos : [];
        setSections(secs);
        setDemos(flat);
        onSectionsLoaded?.(secs);
      } catch (e) {
        if (!cancel) setError(String(e.message || e));
        if (!cancel) setSections([]);
        if (!cancel) setDemos([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [apiBase, botId, onSectionsLoaded]);

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
  if (error) return <p className="text-red-600">Error: {error}</p>;

  // If user is searching, show flat filtered results; otherwise show grouped sections
  const searching = q.trim().length > 0;

  return (
    <div className="text-left">
      <p className="italic mb-3">Here are all demos in our library. Just click on the one you want to view.</p>

      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search demos..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      {searching ? (
        <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
          {filtered.map((d, idx) => (
            <div key={d.id || d.url || d.title || idx} className="relative">
              <DemoButton
                item={{ title: d.title, description: d.description }}
                idx={idx}
                onClick={() => onPick(d)}
              />
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500">No demos match your search.</p>
          )}
        </div>
      ) : (
        <GroupedSections sections={sections} onPick={onPick} />
      )}
    </div>
  );
}

/* -------------------------------- Main UI -------------------------------- */
export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // "ask" | "browse" | "finished"
  const [mode, setMode] = useState("ask");

  // Shared state
  const [selectedDemo, setSelectedDemo] = useState(null); // {id,title,url,description}
  const [selectionSource, setSelectionSource] = useState(null); // "ask" | "browse" | null

  // Ask flow state
  const [askButtons, setAskButtons] = useState([]); // fallback list from /demo-hal (deduped, max 6)
  const [askSections, setAskSections] = useState([]); // NEW grouped sections from /demo-hal
  const [browseSections, setBrowseSections] = useState([]); // sections from /browse-demos

  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState(
    "Hello. I am here to answer any questions you may have about what we offer or who we are. Please enter your question below to begin."
  );
  const [loading, setLoading] = useState(false);

  // Bot bootstrap
  const alias = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return (qs.get("alias") || qs.get("a") || "").trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* Tabs available for this bot */
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
      setSelectedDemo(null);
      setSelectionSource(null);
      return;
    }
    if (key === "finished") {
      setMode("finished");
      setSelectedDemo(null);
      setSelectionSource(null);
      return;
    }
  };

  /* ------------------------------ ASK FLOW ------------------------------ */
  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();
    setInput("");
    setMode("ask");
    setSelectedDemo(null);
    setSelectionSource(null);
    setLastQuestion(outgoing);
    setAskButtons([]);
    setAskSections([]);
    setLoading(true);

    try {
      const payload = { visitor_id: "local-ui", user_question: outgoing, bot_id: botId };
      const res = await axios.post(`${apiBase}/demo-hal`, payload);
      const data = res.data || {};

      if (data.error_code || data.error) {
        console.error("API error:", data.error_code || data.error, data.error_message || "");
      }

      setResponseText(data.response_text || "");

      // NEW: Use grouped sections if available
      const secs = Array.isArray(data.sections) ? data.sections : [];
      setAskSections(secs);

      // Fallback: Expect buttons or demos; normalize and DEDUPE; limit to 6
      const raw = Array.isArray(data.buttons)
        ? data.buttons
        : Array.isArray(data.demos)
        ? data.demos
        : [];
      const normalized = raw.map((b) => ({
        id: b.id ?? b.demo_id ?? "",
        title: b.title ?? b.name ?? "",
        url: b.url ?? b.value ?? "",
        description: b.description ?? "",
      }));
      setAskButtons(dedupeByIdAndUrl(normalized, 6));
    } catch (e) {
      console.error("demo-hal failed:", e);
      setResponseText("Sorry, something went wrong. Please try again.");
      setAskButtons([]);
      setAskSections([]);
    } finally {
      setLoading(false);
    }
  }

  function pickFromAsk(item) {
    const next = {
      id: item.id || "",
      title: item.title || "",
      url: item.url || "",
      description: item.description || "",
    };
    setSelectedDemo(next);
    setSelectionSource("ask");
    setMode("ask"); // video view still lives in "ask" mode
  }

  function pickFromBrowse(item) {
    const next = {
      id: item.id || "",
      title: item.title || "",
      url: item.url || "",
      description: item.description || "",
    };
    setSelectedDemo(next);
    setSelectionSource("browse");
    setMode("ask"); // we show the player inside ask mode
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
        {/* Header */}
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

        {/* Content */}
        <div className="px-6 pt-3 pb-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
          {mode === "finished" ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600">Thanks for exploring! We will design this screen next.</p>
            </div>
          ) : mode === "browse" ? (
            <BrowseDemosPanel
              apiBase={apiBase}
              botId={botId}
              onPick={pickFromBrowse}
              onSectionsLoaded={setBrowseSections}
            />
          ) : selectedDemo ? (
            <div className="w-full flex-1 flex flex-col">
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

              {/* Under the player:
                  - if selection came from ASK → show ASK sections (grouped)
                  - if selection came from BROWSE → show BROWSE sections (grouped)
                  - fallback to askButtons if sections empty */}
              {selectionSource === "ask" ? (
                askSections?.length ? (
                  <GroupedSections sections={askSections} onPick={pickFromAsk} />
                ) : (
                  <>
                    <p className="text-base italic text-left mt-3 mb-1 text-gray-600">Recommended Demos</p>
                    <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                      {askButtons.map((b, idx) => (
                        <div key={`${(b.id || b.url || b.title || "demo")}-${idx}`} className="relative">
                          <DemoButton
                            item={{ title: b.title, description: b.description }}
                            idx={idx}
                            onClick={() =>
                              pickFromAsk({
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
                )
              ) : (
                <GroupedSections sections={browseSections} onPick={pickFromBrowse} />
              )}
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {/* Show the user's question */}
              {!lastQuestion ? null : (
                <p className="text-base text-black italic">"{lastQuestion}"</p>
              )}

              {/* Assistant's response */}
              <div className="text-left mt-2">
                {loading ? (
                  <p className="text-gray-500 font-semibold animate-pulse">Thinking...</p>
                ) : (
                  <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                )}
              </div>

              {/* Ask recommendations (grouped if available; otherwise fallback to flat */}
              {askSections?.length ? (
                <GroupedSections sections={askSections} onPick={pickFromAsk} />
              ) : askButtons?.length ? (
                <>
                  <p className="text-base italic text-left mt-3 mb-1 text-gray-600">Recommended Demos</p>
                  <div className="relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
                    {askButtons.map((b, idx) => (
                      <div key={`${(b.id || b.url || b.title || "demo")}-${idx}`} className="relative">
                        <DemoButton
                          item={{ title: b.title, description: b.description }}
                          idx={idx}
                          onClick={() =>
                            pickFromAsk({
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
