// src/components/screens/ViewDoc.jsx
import React from "react";

/**
 * ViewDoc — embeds a selected document.
 *
 * Props:
 *  title   string
 *  url     string
 */
export default function ViewDoc({ title = "", url = "" }) {
  if (!url) return <div className="text-sm text-gray-600">No document selected.</div>;

  return (
    <div className="w-full flex-1 flex flex-col">
      <div className="bg-white pt-2 pb-2">
        <iframe
          className="w-full h-[65vh] md:h-[78vh] rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
          src={url}
          title={title || "Selected Document"}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
