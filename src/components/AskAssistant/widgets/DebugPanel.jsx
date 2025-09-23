import React from "react";

export default function DebugPanel({ debug }) {
  if (!debug) return null;
  const ac = debug.active_context || {};
  return (
    <div className="mt-3 p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-default)] text-xs whitespace-pre-wrap">
      <div className="font-bold mb-1">Debug</div>
      <div><b>Scope:</b> {String(debug.request_scope || "")}</div>
      <div><b>Non-specific:</b> {String(debug.nonspecific)}</div>
      <div><b>Demo ID:</b> {debug.demo_id || "—"} <b>Doc ID:</b> {debug.doc_id || "—"}</div>
      <div className="mt-2"><b>Active Context Enabled:</b> {String(ac.enabled)}</div>
      {ac.text ? (
        <details className="mt-1">
          <summary className="cursor-pointer">Active Context</summary>
          <pre className="mt-1">{ac.text}</pre>
        </details>
      ) : null}
      {debug.system_preview ? (
        <details className="mt-2">
          <summary className="cursor-pointer">System Preview</summary>
          <pre className="mt-1">{debug.system_preview}</pre>
        </details>
      ) : null}
    </div>
  );
}
