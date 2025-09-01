// src/hooks/usePricing.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Pricing flow: load questions, collect answers, compute estimate.
 *
 * Endpoints:
 *   GET  /pricing/questions?bot_id=...
 *   POST /pricing/estimate  body: { bot_id, answers }
 *
 * Options:
 *   apiBase     string   backend base (default dev)
 *   botId       string   required to operate
 *   autoCompute boolean  compute estimate automatically once all required answers exist (default: true)
 */
export default function usePricing({
  apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com",
  botId,
  autoCompute = true,
} = {}) {
  const [questions, setQuestions] = useState([]);
  const [uiCopy, setUiCopy] = useState({});
  const [answers, setAnswers] = useState({});
  const [estimate, setEstimate] = useState(null);

  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [estimating, setEstimating] = useState(false);

  const [errorQuestions, setErrorQuestions] = useState("");
  const [errorEstimate, setErrorEstimate] = useState("");

  const initializedRef = useRef(false);

  const loadQuestions = useCallback(async () => {
    if (!botId) return;
    setLoadingQuestions(true);
    setErrorQuestions("");
    setEstimate(null);
    try {
      const res = await fetch(`${apiBase}/pricing/questions?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load pricing questions");
      setUiCopy(data.ui_copy || {});
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setAnswers({}); // reset when reloading
    } catch (e) {
      setErrorQuestions("Unable to load price estimator.");
    } finally {
      setLoadingQuestions(false);
    }
  }, [apiBase, botId]);

  const setAnswer = useCallback((qKey, value) => {
    setAnswers((prev) => ({ ...prev, [qKey]: value }));
    setEstimate(null); // invalidate previous estimate when answers change
    setErrorEstimate("");
  }, []);

  const toggleMulti = useCallback((qKey, key) => {
    setAnswers((prev) => {
      const curr = Array.isArray(prev[qKey]) ? prev[qKey] : [];
      const exists = curr.includes(key);
      const next = exists ? curr.filter((k) => k !== key) : [...curr, key];
      return { ...prev, [qKey]: next };
    });
    setEstimate(null);
    setErrorEstimate("");
  }, []);

  const clearAnswers = useCallback(() => {
    setAnswers({});
    setEstimate(null);
    setErrorEstimate("");
  }, []);

  const requiredEstimationQs = useMemo(
    () => questions.filter((q) => q.group === "estimation" && q.required !== false),
    [questions]
  );

  const haveAllRequired = useMemo(() => {
    if (!requiredEstimationQs.length) return false;
    return requiredEstimationQs.every((q) => {
      const v = answers[q.q_key];
      return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
    });
  }, [requiredEstimationQs, answers]);

  const nextQuestion = useMemo(() => {
    for (const q of requiredEstimationQs) {
      const v = answers[q.q_key];
      const empty =
        (q.type === "multi_choice" && Array.isArray(v) && v.length === 0) ||
        v === undefined ||
        v === null ||
        v === "";
      if (empty) return q;
    }
    return null;
  }, [requiredEstimationQs, answers]);

  const computeEstimate = useCallback(async () => {
    if (!botId || !haveAllRequired) return;
    setEstimating(true);
    setErrorEstimate("");
    try {
      const res = await fetch(`${apiBase}/pricing/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, answers }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to compute estimate");
      setEstimate(data);
    } catch (e) {
      setErrorEstimate("Unable to compute estimate.");
      setEstimate(null);
    } finally {
      setEstimating(false);
    }
  }, [apiBase, botId, answers, haveAllRequired]);

  // auto-load once per mount when botId present
  useEffect(() => {
    if (!botId || initializedRef.current) return;
    initializedRef.current = true;
    loadQuestions();
  }, [botId, loadQuestions]);

  // auto compute when all required are presen
