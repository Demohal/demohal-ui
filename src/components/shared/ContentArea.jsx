import React from "react";

/**
 * ContentArea
 * Only renders the body between banner+tabs and the Ask bar.
 * Defaults safely to "ask" so you never get an empty panel.
 */
export default function ContentArea({ activeTab = "ask" }) {
  const id = ["ask", "demos", "docs", "price", "meeting"].includes(activeTab)
    ? activeTab
    : "ask";

  if (id === "ask") {
    return (
      <div className="space-y-4">
        <div className="text-black text-sm sm:text-base font-semibold">
          Welcome to DemoHAL where you can Let Your Product Sell Itself. From here you can ask
          technical or business related questions, watch short video demos based on your interest,
          review the document library for technical specifications, case studies, and other
          materials, book a meeting, or even get a price quote. You can get started by watching
          this short video, or simply by asking your first question.
        </div>

        {/* 16:9 video embed placeholder */}
        <div className="rounded-xl border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden">
          <div style={{ position: "relative", paddingTop: "56.25%" }}>
            <iframe
              title="Intro Video"
              src="https://www.youtube.com/embed/7JQGJgQ8M98"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    );
  }

  if (id === "demos") {
    return <Placeholder title="Browse Demos" />;
  }
  if (id === "docs") {
    return <Placeholder title="Browse Documents" />;
  }
  if (id === "price") {
    return <Placeholder title="Price Estimate" />;
  }
  if (id === "meeting") {
    return <Placeholder title="Schedule Meeting" />;
  }

  return null;
}

function Placeholder({ title }) {
  return (
    <div className="h-[60vh] rounded-xl border border-dashed border-gray-300 grid place-items-center text-gray-500">
      <div>{title} content goes here…</div>
    </div>
  );
}
