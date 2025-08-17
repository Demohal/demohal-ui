
/* src/features/ask/DemoHalUI.jsx */
import React from "react";
import DemoGrid from "../../components/DemoGrid";
import BrandLogo from "../../components/BrandLogo";
import { useBot } from "../../hooks/useBot";
import { useDemos } from "../../hooks/useDemos";
import { toDemo } from "../../lib/normalize";

export default function DemoHalUI() {
  const API_BASE = import.meta.env?.VITE_API_URL || "/api";
  const alias = new URLSearchParams(window.location.search).get("alias") || "";

  const { bot, botId, error: botErr } = useBot(API_BASE, alias);
  const { demos, loading: demosLoading } = useDemos(API_BASE, botId);

  const [view, setView] = React.useState("browse"); // 'browse' | 'video'
  const [selected, setSelected] = React.useState(null);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <header className="flex items-center gap-3 mb-3">
        <BrandLogo brand={bot?.theme} />
        <h1 className="text-xl font-semibold">{bot?.name || "DemoHal"}</h1>
      </header>

      {botErr && <div className="text-red-600 mb-3">{botErr}</div>}

      {view === "browse" && (
        <>
          <h2 className="mb-2 text-sm opacity-70">Browse demos</h2>
          {demosLoading ? (
            <div className="opacity-70">Loading…</div>
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
        <div className="mt-4 space-y-4">
          <div
            className="aspect-video w-full rounded-lg overflow-hidden"
            style={{ border: "1px solid rgba(0,0,0,.1)", background: "rgba(0,0,0,.05)" }}
          >
            {selected.url ? (
              <iframe
                src={selected.url}
                title={selected.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="p-6 opacity-70">No video URL available</div>
            )}
          </div>

          <button
            className="mt-2 px-3 py-2 rounded"
            style={{ border: "1px solid rgba(0,0,0,.2)" }}
            onClick={() => setView("browse")}
          >
            Back to browse
          </button>
        </div>
      )}
    </div>
  );
}
