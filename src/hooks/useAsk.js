// src/hooks/useAsk.js
import { useCallback, useState } from "react";

/**
 * Ask flow state + sender.
 *
 * POST /demo-hal
 *   body: { bot_id, user_question }
 *
 * Returns:
 *   input, setInput
 *   lastQuestion
 *   responseText
 *   recommendations   // normalized array for demo/doc buttons
 *   loading, error
 *   send(question?)   // uses param or current input
 *   clear()           // resets lastQuestion/response/recommendations
 */
export default function useAsk({
  apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com",
  botId,
} = {}) {
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizeRecs = useCallback((payload) => {
    const src = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.buttons)
      ? payload.buttons
      : Array.isArray(payload)
      ? payload
      : [];

    return src
      .map((it) => {
        const id = it.id ?? it.button_id ?? it.value ?? it.url ?? it.title;
        const title =
          it.title ??
          it.button_title ??
          (typeof it.label === "string" ? it.label.replace(/^Watch the \"|\" demo$/g, "") : it.label) ??
          "";
        const url = it.url ?? it.value ?? it.button_value ?? "";
        const description = it.description ?? it.summary ?? it.functions_text ?? "";
        const action = it.action ?? it.button_action ?? "demo";
        return {
          id,
          title,
          url,
          description,
          action,
          functions_text: it.functions_text ?? description,
        };
      })
      .filter((b) => {
        const act = (b.action || "").toLowerCase();
        const lbl = (b.title || "").toLowerCase();
        return act !== "continue" && act !== "options" && lbl !== "continue" && lbl !== "show me options";
      });
  }, []);

  const send = useCallback(
    async (question) => {
      const q = (question ?? input).trim();
      if (!q || !botId) return;

      setLoading(true);
      setError("");
      setLastQuestion(q);
      setResponseText("");
      setRecommendations([]);

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 30000);

      try {
        const res = await fetch(`${apiBase}/demo-hal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botId, user_question: q }),
          signal: controller.signal,
        });
        const data = await res.json();

        setResponseText(data?.response_text || "");
        setRecommendations(normalizeRecs(data));
        setInput("");
      } catch (e) {
        setError("Failed to get a response.");
      } finally {
        clearTimeout(t);
        setLoading(false);
      }
    },
    [apiBase, botId, input, normalizeRecs]
  );

  const clear = useCallback(() => {
    setLastQuestion("");
    setResponseText("");
    setRecommendations([]);
    setError("");
  }, []);

  return {
    input,
    setInput,
    lastQuestion,
    responseText,
    recommendations,
    loading,
    error,
    send,
    clear,
  };
}
