// src/features/ask/DemoHalUI.jsx
import React from "react";
import css from "./DemoHalUI.module.css";
import DemoGrid from "../../components/DemoGrid";
import BrandLogo from "../../components/BrandLogo";
import { useBot } from "../../hooks/useBot";
import { useDemos } from "../../hooks/useDemos";
import { toDemo } from "../../lib/normalize";

export default function DemoHalUI() {
  const API_BASE = import.meta.env?.VITE_API_URL || "/api";
  const alias = new URLSearchParams(window.location.search).get("alias") || "demo";

  const { bot, botId, error: botErr } = useBot(API_BASE, alias);
  const { demos, loading: demosLoading, error: demosErr } = useDemos(API_BASE, botId);

  const [view, setView] = React.useState("browse"); // 'browse' | 'video'
  const [selected, setSelected] = React.useState(null);

  return (
    <div className={css.page}>
      <header className={css.header}>
        <BrandLogo brand={bot?.theme} height={24} />
        <div className={css.brand}>{bot?.name || "DemoHal"}</div>
      </header>

      <main className={css.content}>
        {/* small, readable errors if any */}
        {botErr && <div style={{ color: "#b00020", marginBottom: 8 }}>Bot error: {String(botErr)}</div>}
        {demosErr && <div style={{ color: "#b00020", marginBottom: 8 }}>Demos error: {String(demosErr)}</div>}

        {view === "browse" && (
          <>
            <div className={css.sectionTitle}>Browse demos</div>
            {demosLoading ? (
              <div style={{ opacity: 0.7 }}>Loading…</div>
            ) : (
              <DemoGrid
                items={demos}
                onPick={(d) => {
                  const dd = toDemo(d);
                  setSelected(dd);
                  setView("video");
                }}
              />
            )}
          </>
        )}

        {view === "video" && selected && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                aspectRatio: "16 / 9",
                width: "100%",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,.1)",
                background: "rgba(0,0,0,.05)",
              }}
            >
              {selected.url ? (
                <iframe
                  src={selected.url}
                  title={selected.title}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div style={{ padding: 24, opacity: 0.7 }}>No video URL available</div>
              )}
            </div>

            <button
              style={{ marginTop: 8, padding: "8px 12px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8 }}
              onClick={() => setView("browse")}
            >
              Back to browse
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
