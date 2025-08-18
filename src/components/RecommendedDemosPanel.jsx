// src/components/RecommendedDemosPanel.jsx
import React from "react";
import css from "./RecommendedDemosPanel.module.css";

/**
 * RecommendedDemosPanel
 * Props:
 *  - botId: string (required)
 *  - demoId: string (required)
 *  - limit?: number (default 8)
 *  - onPick?: (demo) => void  (optional; default opens demo.url in a new tab)
 */
export default function RecommendedDemosPanel({ botId, demoId, limit = 8, onPick }) {
  const API_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || "";
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!botId || !demoId) return;
    const ac = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `${API_BASE}/recommend-demos?bot_id=${encodeURIComponent(
        botId
      )}&demo_video_id=${encodeURIComponent(demoId)}&limit=${limit}`,
      { signal: ac.signal }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => setData(json))
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e.message || e));
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [API_BASE, botId, demoId, limit]);

  const toItems = (rows = []) =>
    rows.map((d) => ({
      id: d.id,
      title:
        (d.title && String(d.title)) ||
        (d.description ? String(d.description).slice(0, 60) : "Untitled demo"),
      url: d.url || "",
      description: d.description || "",
    }));

  const handlePick = (d) => {
    if (onPick) return onPick(d);
    if (d?.url) window.open(d.url, "_blank", "noopener");
  };

  if (!botId || !demoId) return null;

  return (
    <aside className={css.panel} aria-label="Recommended demos">
      <div className={css.header}>Recommended next</div>

      {loading && <div className={css.msg}>Loading…</div>}
      {error && <div className={css.error}>Error: {error}</div>}

      {data && (data.industries?.length > 0 || data.supergroups?.length > 0) ? (
        <div className={css.groups}>
          {data.industries?.map((g) => (
            <section key={`ind-${g.bot_industry_id}`} className={css.group}>
              <div className={css.groupTitle}>More in {g.title}</div>
              <div className={css.grid}>
                {toItems(g.demos).map((d) => (
                  <button key={d.id} className={css.demoBtn} onClick={() => handlePick(d)}>
                    <span className={css.demoTitle}>{d.title}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          {data.supergroups?.map((g) => (
            <section key={`sg-${g.bot_function_supergroup_id}`} className={css.group}>
              <div className={css.groupTitle}>{g.title}</div>
              <div className={css.grid}>
                {toItems(g.demos).map((d) => (
                  <button key={d.id} className={css.demoBtn} onClick={() => handlePick(d)}>
                    <span className={css.demoTitle}>{d.title}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        !loading && !error && <div className={css.msg}>No recommendations yet.</div>
      )}
    </aside>
  );
}
