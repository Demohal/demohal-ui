// src/features/reco/RecoMock.jsx
import React from "react";
import RecommendationsMockPanel from "../../components/RecommendationsMockPanel";

export default function RecoMock() {
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
        const b = json?.bot || json;
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
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <img src="/src/assets/logo.png" alt="DemoHAL" style={{ height: 28 }} />
        <h1 style={{ fontSize: 20, margin: 0 }}>Browse Demos</h1>
      </header>

      {botId && demoId ? (
        <RecommendationsMockPanel
          botId={botId}
          demoId={demoId}
          onPick={(d) => d?.url && window.open(d.url, "_blank", "noopener")}
        />
      ) : (
        <div style={{ opacity: .75 }}>
          Add <code>?alias=demo&amp;demo_id=&lt;some-demo-id&gt;</code> to the URL.
        </div>
      )}
    </div>
  );
}
