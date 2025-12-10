// DocIframe.jsx — document viewer
import React from "react";

export default function DocIframe({ doc }) {
  const iframeSrc = React.useMemo(() => {
    const html = doc?._iframe_html || "";
    if (!html) return null;
    const m =
      html.match(/src\s*=\s*"([^"]+)"/i) ||
      html.match(/src\s*=\s*'([^']+)'/i);
    return m ? m[1] : null;
  }, [doc?._iframe_html]);

  const src = iframeSrc || doc?.url || "";

  return (
    <div className="bg-[var(--card-bg)] pt-2 pb-2">
      <iframe
        className="w-full h-[65vh] md:h-[78vh] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
        src={src}
        title={doc?.title || "Document"}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="fullscreen"
      />
    </div>
  );
}
