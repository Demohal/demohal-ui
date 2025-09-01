// src/components/ask/AskScreen.jsx
import React from "react";

/**
 * AskScreen (shell)
 * - Mirrors the old app's Ask landing view:
 *   heading/welcome copy + a responsive 16:9 YouTube embed
 * - No data fetching; pure presentational shell.
 */

const INTRO_EMBED = "https://www.youtube.com/embed/dQw4w9WgXcQ"; // TODO: replace with your real intro embed

export default function AskScreen() {
  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        {/* Welcome / heading copy */}
        <div className="text-black text-[15px] leading-relaxed font-semibold">
          Welcome to DemoHAL where you can Let Your Product Sell Itself. From here you can ask
          technical or business related questions, watch short video demos based on your interest,
          review the document library for technical specifications, case studies, and other
          materials, book a meeting, or even get a price quote. You can get started by watching this
          short video, or simply by asking your first question.
        </div>

        {/* 16:9 responsive video container */}
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          <iframe
            title="DemoHAL Intro Video"
            src={INTRO_EMBED}
            className="absolute top-0 left-0 w-full h-full rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.25)]"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
