import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * AskAssistant.jsx — 2025-08-16
 *
 * Goals of this replacement:
 * 1) Fix boot loop by being strict about apiBase and adding robust bot resolution.
 *    - Supports bot lookup by `bot_id` OR `alias` (from props or ?query).
 *    - Validates responses and surfaces helpful, on-screen errors in dev.
 *    - Never calls the UI origin by accident when apiBase is missing.
 * 2) Prevent "no formatting" look by shipping minimal, namespaced fallback CSS that
 *    works even if Tailwind isn't loaded. Tailwind classes are still present.
 * 3) Add small dev/debug panel (toggle with ?debug=1) to inspect computed config
 *    and last fetch statuses without opening the console.
 */

/*****************************
 * Namespaced fallback styles *
 *****************************/
const FALLBACK_CSS = `
.demohal { --ring:#11182733; --border:#e5e7eb; --muted:#6b7280; --bg:#ffffff; --ink:#111827; --card:#111827; --cardText:#ffffff; }
.demohal { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"; color: var(--ink); }
.demohal .container { max-width: 1040px; margin: 0 auto; padding: 24px; }
.demohal .stack { display: grid; gap: 16px; }
.demohal .row { display: flex; align-items: center; gap: 8px; }
.demohal .btn { border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; cursor: pointer; background:#111827; color:#fff; }
.demohal .btn.secondary { background:#fff; color:#111827; }
.demohal .tabs button.active { background:#111827; color:#fff; }
.demohal .input { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; width: 100%; }
.demohal .card { background: var(--card); color: var(--cardText); border-radius: 14px; padding: 14px; box-shadow: 0 6px 18px rgba(17,24,39,0.15); }
.demohal .muted { color: var(--muted); }
.demohal .grid { display:grid; grid-template-columns: 1fr; gap:12px; }
@media (min-width: 768px) { .demohal .grid.cols-3 { grid-template-columns: repeat(3, 1fr); } }
.demohal .pill { display:inline-flex; align-items:center; gap:8px; border:1px solid var(--border); border-radius:999px; padding:6px 10px; font-size:12px; }
.demohal .kbd { border:1px solid var(--border); border-radius:6px; padding:0 6px; font-size:12px; }
.demohal iframe { border: 0; }
`;

/************************
 * Utilities / helpers  *
 ************************/
const trimSlashes = (s) => (s || "").replace(/\/+$/, "");
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const entries = (obj) =>
  obj && typeof obj === "object" && !Array.isArray(obj) ? Object.entries(obj) : [];
const values = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);

function useQueryParam(name) {
  const [val, setVal] = useState(() => new URLSearchParams(window.location.search).get(name));
  useEffect(() => {
    const onPop = () => setVal(new URLSearchParams(window.location.search).get(name));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [name]);
  return val;
}

/** Fetch with timeout + JSON safety */
async function fetchJSON(url, opts = {}) {
  const { timeoutMs = 15000, ...rest } = opts;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, ...rest });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { _raw: text }; }
    if (!res.ok) {
      const msg = (json && (json.message || json.error)) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(id);
  }
}

/** Lightweight local button so this file is self-contained */
function DemoButton({ item, idx = 0, onClick }) {
  const title = (item?.title || item?.label || "Demo").trim();
  const description = (item?.description || "").trim();
  return (
    <button
      onClick={onClick}
      className="card"
      aria-label={`Demo ${idx + 1}: ${title}`}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      {description ? (
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{description}</div>
      ) : null}
    </button>
  );
}

export default function AskAssistant(props) {
  // ---- Config ----
  const envBase = trimSlashes(import.meta?.env?.VITE_API_BASE);
  const propBase = trimSlashes(props?.apiBase);
  const globalBase = trimSlashes(
    typeof window !== "undefined" ? window.__DEMOHAL_API_BASE__ : ""
  );
  const apiBase = propBase || envBase || globalBase; // DO NOT default to "" to avoid calling UI origin

  const qpAlias = useQueryParam("alias");
  const qpBotId = useQueryParam("bot_id");
  const alias = (props?.alias || qpAlias || "").trim();
  const preferredBotId = (props?.botId || qpBotId || "").trim();

  const debugOn = (props?.debug ?? false) || (useQueryParam("debug") === "1");

  // ---- State ----
  const [mode, setMode] = useState("ask"); // "ask" | "browse" | "finished"
  const [status, setStatus] = useState({ phase: "init", level: "info", message: "" });
  const [bot, setBot] = useState(null);
  const [botId, setBotId] = useState("");
  const [allDemos, setAllDemos] = useState([]);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [askRecs, setAskRecs] = useState([]);
  const [related, setRelated] = useState({});

  // Keep last error for debug
  const lastErrorRef = useRef(null);

  // ---- Boot: resolve bot ----
  useEffect(() => {
    let cancelled = false;

    async function resolveBot() {
      // Guard: require apiBase
      if (!apiBase) {
        setStatus({
          phase: "config",
          level: "error",
          message:
            "Missing apiBase. Pass apiBase as a prop, set VITE_API_BASE, or define window.__DEMOHAL_API_BASE__.",
        });
        return;
      }

      try {
        setStatus({ phase: "boot", level: "info", message: "Resolving bot…" });

        // 1) Try by bot_id if provided
        if (preferredBotId) {
          const url = `${apiBase}/bot-by-id?bot_id=${encodeURIComponent(preferredBotId)}`;
          const j = await fetchJSON(url);
          const b = j?.bot || j;
          if (!cancelled && b?.id) {
            setBot(b);
            setBotId(b.id);
            setStatus({ phase: "ready", level: "success", message: "Bot resolved by id." });
            return;
          }
        }

        // 2) Try by alias
        if (alias) {
          const url = `${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`;
          const j = await fetchJSON(url);
          const b = j?.bot || j;
          if (!cancelled && b?.id) {
            setBot(b);
            setBotId(b.id);
            setStatus({ phase: "ready", level: "success", message: "Bot resolved by alias." });
            return;
          }
        }

        // 3) If both missing or failed
        setStatus({
          phase: "error",
          level: "error",
          message:
            "Unable to resolve bot. Provide ?bot_id=… or ?alias=… and ensure apiBase points to your Flask backend.",
        });
      } catch (e) {
        lastErrorRef.current = e;
        setStatus({
          phase: "error",
          level: "error",
          message: e?.message || "Failed resolving bot.",
        });
      }
    }

    resolveBot();
    return () => {
      cancelled = true;
    };
  }, [apiBase, alias, preferredBotId]);

  // ---- Load browse list when we have a bot ----
  useEffect(() => {
    if (!botId || !apiBase) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus({ phase: "browse", level: "info", message: "Loading demos…" });
        const url = `${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`;
        const j = await fetchJSON(url);
        const demos = asArray(j?.demos);
        if (!cancelled) {
          setAllDemos(demos);
          setStatus({ phase: "ready", level: "success", message: "Demos loaded." });
        }
      } catch (e) {
        lastErrorRef.current = e;
        if (!cancelled) setStatus({ phase: "error", level: "error", message: e?.message || "Browse error" });
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
    if (!apiBase || !botId) return;

    try {
      const url = `${apiBase}/related-demos-grouped?bot_id=${encodeURIComponent(
        botId
      )}&demo_id=${encodeURIComponent(demo.id || "")}&limit=60`;
      const j = await fetchJSON(url);
      const groups = j?.groups || {};
      setRelated(groups);
    } catch (e) {
      lastErrorRef.current = e;
      setRelated({});
    }
  };

  // ---- Ask flow ----
  const onAsk = async () => {
    const q = (input || "").trim();
    if (!q || !botId || !apiBase) return;
    setAnswer("");
    setAskRecs([]);
    try {
      const url = `${apiBase}/demo-hal`;
      const body = { bot_id: botId, user_question: q };
      const j = await fetchJSON(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setAnswer((j?.response_text || "").trim());
      const demos = asArray(j?.demos || j?.buttons);
      setAskRecs(demos);
      setMode("ask");
    } catch (e) {
      lastErrorRef.current = e;
      setStatus({ phase: "error", level: "error", message: e?.message || "Ask error" });
    }
  };

  // ---- Simple header ----
  const Header = () => (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>DemoHAL</div>
      <div className="row tabs">
        <button
          className={`btn secondary ${mode === "browse" ? "active" : ""}`}
          onClick={() => setMode("browse")}
        >
          Browse Demos
        </button>
        <button
          className={`btn secondary ${mode === "finished" ? "active" : ""}`}
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
      return base.filter((d) => (d?.title || "").toLowerCase().includes(needle));
    }, [q, allDemos]);

    return (
      <div className="stack">
        <p className="muted" style={{ fontSize: 14 }}>
          Here are all demos in our library. Just click one to view.
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search demos…"
          className="input"
        />
        <div className="grid cols-3">
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
      <div className="stack">
        {entries(related).map(([groupName, raw]) => {
          const rows = values(raw);
          if (!rows.length) return null;
          return (
            <section key={groupName}>
              <p style={{ fontStyle: "italic", marginBottom: 6 }}>{groupName}</p>
              <div className="grid cols-3">
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
    <div className="demohal" data-version="2025-08-16">
      <style dangerouslySetInnerHTML={{ __html: FALLBACK_CSS }} />

      {/* Status / config pill */}
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div className="pill">
            <span style={{ width: 8, height: 8, borderRadius: 99, background: status.level === "error" ? "#ef4444" : status.level === "success" ? "#10b981" : "#f59e0b" }} />
            <span>{status.phase}</span>
            {status.message ? <span className="muted">· {status.message}</span> : null}
          </div>
          {debugOn ? (
            <div className="pill">
              <span className="kbd">debug</span>
              <span>on</span>
            </div>
          ) : null}
        </div>

        <div className="stack">
          <Header />

          {/* Ask box */}
          <div className="row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="input"
              onKeyDown={(e) => e.key === "Enter" && onAsk()}
            />
            <button onClick={onAsk} className="btn">Ask</button>
          </div>

          {/* Modes */}
          {mode === "finished" ? (
            <div style={{ padding: "48px 0", textAlign: "center" }} className="muted">
              Thanks for exploring! We’ll design this screen next.
            </div>
          ) : mode === "browse" ? (
            <BrowsePanel />
          ) : (
            <div className="stack">
              {/* Welcome or answer */}
              {!answer ? (
                <div className="muted">
                  Hello. We’re here to help. Ask anything about our demos or products below.
                </div>
              ) : (
                <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{answer}</div>
              )}

              {/* Selected video (when present) */}
              {selectedDemo?.url ? (
                <div>
                  <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg)", paddingTop: 8, paddingBottom: 12 }}>
                    <iframe
                      style={{ width: "100%", aspectRatio: "471 / 272", borderRadius: 12, boxShadow: "0 4px 12px rgba(107,114,128,0.3)" }}
                      src={selectedDemo.url}
                      title={selectedDemo.title || "Selected demo"}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ) : null}

              {/* Ask-mode recommended demos */}
              {asArray(askRecs).length ? (
                <>
                  <p style={{ fontStyle: "italic", marginTop: 8, marginBottom: 6 }}>Recommended Demos</p>
                  <div className="grid cols-3">
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

          {/* Debug panel */}
          {debugOn ? (
            <div style={{ marginTop: 12 }}>
              <details open>
                <summary style={{ cursor: "pointer", userSelect: "none" }}>Debug</summary>
                <pre style={{ fontSize: 12, color: "#374151", background: "#f9fafb", padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, whiteSpace: "pre-wrap" }}>
{JSON.stringify(
  {
    status,
    apiBase,
    alias,
    preferredBotId,
    botId,
    bot: bot ? { id: bot.id, name: bot.name } : null,
    allDemos: asArray(allDemos).length,
    selectedDemo: selectedDemo ? { id: selectedDemo.id, title: selectedDemo.title } : null,
    relatedGroups: Object.keys(related || {}).length,
    askRecs: asArray(askRecs).length,
    inputLen: (input || "").length,
    lastError: lastErrorRef.current ? { message: lastErrorRef.current.message, status: lastErrorRef.current.status } : null,
  },
  null,
  2
)}
                </pre>
              </details>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
