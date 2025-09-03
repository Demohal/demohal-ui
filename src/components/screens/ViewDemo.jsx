// src/components/screens/ViewDemo.jsx
import React from "react";

/**
 * ViewDemo — embeds a selected demo (video).
 *
 * Props:
 *  title   string
 *  url     string (already normalized/embeddable)
 */
export default function ViewDemo({ title = "", url = "" }) {
  if (!url) {
    return <div className="text-sm text-gray-600">No demo selected.</div>;
  }

  return (
    <div className="w-full flex-1 flex flex-col">
      <div className="bg-white pt-2 pb-2">
        <iframe
          style={{ width: "100%", aspectRatio: "471 / 272" }}
          src={url}
          title={title || "Selected Demo"}
          className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
