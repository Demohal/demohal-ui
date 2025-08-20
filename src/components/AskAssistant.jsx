// src/components/AskAssistant.jsx — MVP: flat list + anchored video + inline search tooltip (rev4)

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ArrowUpCircleIcon,
  MagnifyingGlassCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";

function Row({ item, onPick }) {
  return (
    <button
      onClick={() => onPick(item)}
      className="w-full text-center bg-gradient-to-b from-gray-600 to-gray-700 text-white rounded-xl border border-gray-700 px-4 py-3 shadow hover:from-gray-500 hover:to-gray-600 transition-colors"
    >
      {/* Title reduced ~25% and centered */}
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.functions_text ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {item.functions_text}
        </div>
      ) : null}
    </button>
  );
}

export default function AskAssistant() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  const [bot, setBot] = useState(null);
  const [botId, setBotId] = useState("");
  const [fatal, setFatal] = useState("");

  const [mode, setMode] = useState("ask"); // ask | browse | finished
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const INITIAL_MSG = "Hello. Ask a question to get started.";
  const [responseText, setResponseText] = useState(INITIAL_MSG);
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]); // flat list from /demo-hal
  const [browseItems, setBrowseItems] = useState([]); // flat list from /browse-demos
  const [selected, setSelected] = useState(null); // {title,url,...}

  // Anchoring logic
  const [isAnchored, setIsAnchored] = useState(false);

  // Search tooltip state
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState(""); // committed query
  const [searchDraft, setSearchDraft] = useState(""); // type-ahead buffer
  const searchInputRef = useRef(null);

  const contentRef = useRef(null);

  // alias
  const alias = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return (qs.get("alias") || qs.get("a") || "").trim();
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!alias) {
        setFatal("Missing alias in URL.");
        return;
      }
      try {
        const res = await fetch(
          `${apiBase}/bot-by-alias?alias=${encodeURIComponent(alias)}`
        );
        if (!res.ok) throw new Error("Bad alias");
        const data = await res.json();
        if (!cancel) {
          setBot(data.bot);
          setBotId(data.bot?.id || "");
        }
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase]);

  // When anchored, release on first scroll
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !selected) return;
    const onScroll = () => {
      if (el.scrollTop > 8 && isAnchored) setIsAnchored(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [selected, isAnchored]);

  // Focus search input when tooltip opens
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  async function sendMessage() {
    if (!input.trim() || !botId) return;
    const outgoing = input.trim();
    setInput("");
    setSelected(null);
    setMode("ask");
    setLoading(true);
    try {
      const res = await axios.post(`${apiBase}/demo-hal`, {
        bot_id: botId,
        user_question: outgoing,
      });
      const data = res.data || {};
      setResponseText(data.response_text || "");
      const arr = Array.isArray(data.items) ? data.items : [];
      setItems(arr);
      setLastQuestion(outgoing);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch (e) {
      setResponseText("Sorry—something went wrong.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function openBrowse() {
    if (!botId) return;
    s
