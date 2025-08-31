// src/components/RecommendationsMockPanel.jsx
import React from "react";
import css from "./RecommendationsMockPanel.module.css";

/**
 * RecommendationsMockPanel (matches your mockup)
 * - Fetches /recommend-demos and renders grouped headings:
 *   • “Demos that talk about the {Industry} Industry:”
 *   • “Demos that talk about {Supergroup}:”
 * - Clicking a tile opens the demo URL in a new tab (or use onPick)
 */
export default function RecommendationsMockPanel({ botId, demoId, limit = 8, onPick }) {
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

  const handlePick = (d) => {
    if (onPick) return onPick(d);
    if (d?.url) window.open(d.url, "_blank", "noopener");
  };

  const tiles = (list = []) =>
    list.map((d) => (
      <button key={d.id} className={css.tile} onClick={() => handlePick(d)} title={d.title}>
        <span className={css.tileText}>{d.title || "Untitled demo"}</span>
      </button>
    ));

  if (!botId || !demoId) return null;

  return (
    <div className={css.wrap}>
      {loading && <div className={css.msg}>Loading recommendations…</div>}
      {error && <div className={css.err}>Error: {error}</div>}

      {!loading && !error && data && (
        <>
          {(data.industries || []).map((g) => (
            <section key={`ind-${g.bot_industry_id}`} className={css.section}>
              <h3 className={css.heading}>
                <em>Demos that talk about the {g.title} Industry:</em>
              </h3>
              <div className={css.grid}>{tiles(g.demos)}</div>
            </section>
          ))}

          {(data.supergroups || []).map((g) => (
            <section key={`sg-${g.bot_function_supergroup_id}`} className={css.section}>
              <h3 className={css.heading}>
                <em>Demos that talk about {g.title}:</em>
              </h3>
              <div className={css.grid}>{tiles(g.demos)}</div>
            </section>
          ))}

          {(!data.industries || data.industries.length === 0) &&
            (!data.supergroups || data.supergroups.length === 0) && (
              <div className={css.msg}>No recommendations yet.</div>
            )}
        </>
      )}
    </div>
  );
}
