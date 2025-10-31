// TopicPicker.jsx - Dropdown component for selecting demo/doc topics
import React from "react";

export default function TopicPicker({ topics, selectedTopic, onTopicChange, label = "Filter by topic" }) {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="w-full mb-3">
      <label className="block text-sm font-semibold mb-2 text-[var(--helper-fg)]">
        {label}
      </label>
      <select
        value={selectedTopic || ""}
        onChange={(e) => onTopicChange(e.target.value || null)}
        className="w-full rounded-[0.75rem] px-4 py-3 text-base
                   bg-[var(--card-bg)] text-[var(--message-fg)]
                   border border-[var(--border-default)]
                   focus:outline-none focus:ring-2 focus:ring-[var(--send-color)] focus:ring-opacity-50
                   hover:brightness-95 transition-all"
      >
        <option value="">All Topics</option>
        {topics.map((topic) => (
          <option key={topic.topic_key || topic.id} value={topic.topic_key || topic.id}>
            {topic.topic_name || topic.name || topic.topic_key}
          </option>
        ))}
      </select>
    </div>
  );
}
