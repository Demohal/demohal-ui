// src/features/reco/RecoTest.jsx
import React from "react";
import RecommendedDemosPanel from "../../components/RecommendedDemosPanel";

export default function RecoTest() {
  const API_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || "";
  const params = new URLSearchParams(window.location.search);
  const alias = params.get("alias") || "demo";
  const demoId = params.get("demo_id") || "";
  const [botId, setBotId] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/bot-by-alias?alias=${encodeURIComponent(alias)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        const b = json?.bot || json; // resilient to {bot:{...}} or flat
        const id =
          b?.id ||
          b?.bot_id ||
          b?.uuid ||
          b?.uid ||
          Object.entries(b || {}).find(([k, v]) => /id$/i.test(k) && typeof v === "string")?.[1] ||
          "";
        if (alive) setBotId(id);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [API_BASE, alias]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>Recommendations Test</h1>
      <div style={{ marginBottom: 12, opacity: .8 }}>
        Alias: <code>{alias}</code> &nbsp; Demo ID: <code>{demoId || "(none)"}</code> &nbsp; Bot ID:{" "}
        <code>{botId || "(resolving…)"}</code>
      </div>

      {botId && demoId ? (
        <RecommendedDemosPanel
          botId={botId}
          demoId={demoId}
          onPick={(d) => (d?.url ? window.open(d.url, "_blank", "noopener") : null)}
        />
      ) : (
        <div style={{ opacity: .7 }}>
          Provide <code>?alias=demo&amp;demo_id=&lt;some-demo-id&gt;</code> in the URL to see recommendations.
        </div>
      )}
    </div>
  );
}
