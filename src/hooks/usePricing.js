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
 *
 * Returns:
 *   // data
 *   questions        array
 *   uiCopy           object
 *   answers          object
 *   estimate         object|null
 *
 *   // status
 *   loadingQuestions boolean
 *   estimating       boolean
 *   errorQuestions   string|""
 *   errorEstimate    string|""
 *
 *   // helpers
 *   loadQuestions()        => Promise<void>
 *   setAnswer(qKey, value) => void         // sets choice or manual value
 *   toggleMulti(qKey, key) => void         // toggles key in array for multi_choice
 *   clearAnswers()         => void
 *   computeEstimate()      => Promise<void>
 *   haveAllRequired        boolean
 *   nextQuestion           object|null     // first unanswered required "estimation" group question
 *   mirrorLines            string[]        // human-readable summary lines
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

  // auto compute when all required are present
  useEffect(() => {
    if (!autoCompute) return;
    if (haveAllRequired) computeEstimate();
  }, [autoCompute, haveAllRequired, computeEstimate]);

  // ------- mirror lines (UX helper) -------
  const mirrorLines = useMemo(() => {
    if (!questions?.length) return [];
    const lines = [];
    for (const q of questions) {
      const ans = answers[q.q_key];
      if (ans === undefined || ans === null || ans === "" || (Array.isArray(ans) && ans.length === 0)) continue;

      const opts = q.options || [];
      let label = "";
      if (q.type === "choice") {
        const o = opts.find((o) => o.key === ans);
        label = o?.label || String(ans);
      } else if (q.type === "multi_choice") {
        const picked = Array.isArray(ans) ? ans : [];
        label = opts.filter((o) => picked.includes(o.key)).map((o) => o.label).join(", ");
      } else {
        label = String(ans);
      }
      if (!label) continue;

      // Default templating behavior if q.mirror_template not supplied
      const norm = (s) => (s || "").toLowerCase().replace(/[\s-]+/g, "_");
      const key = norm(q.q_key);
      let line = null;
      if (q.mirror_template) {
        line = q.mirror_template.split("{{answer_label_lower}}").join(label.toLowerCase()).split("{{answer_label}}").join(label);
      } else if (["edition", "editions", "product", "products", "industry_edition", "industry"].includes(key)) {
        line = `You have selected ${label}.`;
      } else if (["transactions", "transaction_volume", "volume", "tier", "tiers"].includes(key)) {
        line = `You stated that you execute ${label.toLowerCase()} commercial transactions per month.`;
      }
      if (line) lines.push(line);
    }
    return lines;
  }, [questions, answers]);

  return {
    // data
    questions,
    uiCopy,
    answers,
    estimate,

    // status
    loadingQuestions,
    estimating,
    errorQuestions,
    errorEstimate,

    // helpers
    loadQuestions,
    setAnswer,
    toggleMulti,
    clearAnswers,
    computeEstimate,
    haveAllRequired,
    nextQuestion,
    mirrorLines,
  };
}
