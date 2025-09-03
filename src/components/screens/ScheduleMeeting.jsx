// src/components/screens/ScheduleMeeting.jsx
import React, { useMemo } from "react";

/**
 * ScheduleMeeting — renders scheduling UI based on agent config.
 *
 * Props:
 *  agent      { schedule_header?, calendar_link_type?, calendar_link? } | null
 *  loading    boolean
 *  error      string|""
 *  onRefresh  () => void           // optional, to re-fetch agent
 */
export default function ScheduleMeeting({ agent = null, loading = false, error = "", onRefresh = null }) {
  const embedDomain = useMemo(
    () => (typeof window !== "undefined" ? window.location.hostname : ""),
    []
  );

  if (loading) return <div className="text-sm text-gray-600">Loading scheduling…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!agent) {
    return (
      <div className="text-sm text-gray-600">
        No scheduling link is configured.{onRefresh ? (
          <>
            {" "}
            <button className="underline text-blue-600" onClick={onRefresh}>Retry</button>.
          </>
        ) : null}
      </div>
    );
  }

  const type = String(agent.calendar_link_type || "").toLowerCase();
  const link = agent.calendar_link || "";

  return (
    <div className="w-full flex-1 flex flex-col">
      <div className="bg-white pt-2 pb-2">
        {agent.schedule_header ? (
          <div className="mb-2 text-sm italic text-gray-600 whitespace-pre-line">{agent.schedule_header}</div>
        ) : null}

        {type === "embed" && link ? (
          <iframe
            title="Schedule a Meeting"
            src={`${link}?embed_domain=${embedDomain}&embed_type=Inline`}
            style={{ width: "100%", height: "60vh", maxHeight: "640px" }}
            className="rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
          />
        ) : type === "external" && link ? (
          <div className="text-sm text-gray-700">
            We opened the scheduling page in a new tab. If it didn’t open,&nbsp;
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              click here to open it
            </a>.
          </div>
        ) : (
          <div className="text-sm text-gray-600">No scheduling link is configured.</div>
        )}
      </div>
    </div>
  );
}
