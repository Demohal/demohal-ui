// src/components/screens/AskView.jsx
import React from "react";

/**
 * AskView — content area for the Ask screen.
 *
 * Props:
 *  welcomeMessage   string
 *  showIntroVideo   boolean
 *  introVideoUrl    string
 *  lastQuestion     string
 *  loading          boolean
 *  responseText     string
 *  recommendations  array<{ id,title,url,description,functions_text }>
 *  onPick           (item) => void
 */
export default function AskView({
  welcomeMessage = "",
  showIntroVideo = false,
  introVideoUrl = "",
  lastQuestion = "",
  loading = false,
  responseText = "",
  recommendations = [],
  onPick = () => {},
}) {
  return (
    <div className="w-full flex-1 flex flex-col space-y-4">
      {/* Intro / Welcome */}
      {!lastQuestion && !loading && (
        <div className="space-y-3">
          <div className="text-black text-base font-bold whitespace-pre-line">{welcomeMessage}</div>
          {showIntroVideo && introVideoUrl ? (
            <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <iframe
                src={introVideoUrl}
                title="Intro Video"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Current question + response */}
      {lastQuestion ? <p className="text-base text-black italic text-center mb-2">"{lastQuestion}"</p> : null}
      <div className="text-left mt-2">
        {loading ? (
          <p className="text-gray-500 font-semibold animate-pulse">Thinking…</p>
        ) : lastQuestion ? (
          <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
        ) : null}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-3 mb-2">
            <p className="italic text-gray-600">Recommended demos</p>
            <span />
          </div>
          <div className="flex flex-col gap-3">
            {recommendations.map((it) => (
              <button
                key={it.id || it.url || it.title}
                onClick={() => onPick(it)}
                className="w-full text-left rounded-xl px-4 py-3 shadow transition-colors text-white border border-gray-600
                           bg-gradient-to-b from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600"
                title={it.description || ""}
              >
                <div className="font-extrabold text-xs sm:text-sm">{it.title}</div>
                {it.description ? (
                  <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{it.description}</div>
                ) : it.functions_text ? (
                  <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{it.functions_text}</div>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
