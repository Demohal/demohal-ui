// ---------------------------------------------
// File: src/components/views/ContentTemplate.jsx
import React from "react";

export default function ContentTemplate({ title = "Template", children }) {
  return (
    <div className="text-[var(--message-fg,#111827)]">
      <div className="font-semibold mb-2">{title}</div>
      {children || <p>This is a content-only view. It does not know about the shell.</p>}
    </div>
  );
}
