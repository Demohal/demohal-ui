// File: src/components/views/WelcomeView.jsx
import React from "react";

export default function WelcomeView({ welcomeText = "", introVideoUrl = "", showIntroVideo = false }) {
  return (
    <div className="text-[var(--message-fg,#111827)]">
      {welcomeText ? (
        <div className="text-base font-semibold whitespace-pre-line mb-3">{welcomeText}</div>
      ) : null}

      {showIntroVideo && introVideoUrl ? (
        <div className="mt-1">
          <iframe
            title="intro"
            src={introVideoUrl}
            className="w-full aspect-video rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : null}
    </div>
  );
}
