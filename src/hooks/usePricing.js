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

  // ------------ loading & answering ------------

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
    } catch {
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

  // ------------ progression & estimation ------------

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
    } catch {
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

  // ------------ mirror lines (human text recap) ------------

  // Pull options from multiple possible shapes
  const getOptionsArray = (q) => {
    const tries = [
      q?.options,
      q?.choices,
      q?.ui_options,
      q?.estimation_options,
      q?.tiers,
      q?.price_tiers,
      q?.price_tiers_v2,
      q?.values,
      q?.items,
      q?.ui?.options,
    ];
    for (const arr of tries) {
      if (Array.isArray(arr) && arr.length) return arr;
    }
    // Map-like fallbacks → synthesize array
    const maps = [
      q?.value_label_map,
      q?.label_map,
      q?.price_tiers_map,
      q?.price_tiers_v2_map,
      q?.tiers_map,
    ];
    for (const m of maps) {
      if (m && typeof m === "object") {
        return Object.entries(m).map(([k, v]) => ({ key: k, label: v }));
      }
    }
    return [];
  };

  // Normalize option identity/labels across shapes (supports price_tiers_v2)
  const resolveOptKey = (opt) =>
    opt?.key ?? opt?.value ?? opt?.tier_key ?? opt?.id ?? opt?.code ?? opt?.slug;

  const resolveOptLabel = (opt) =>
    opt?.label ??
    opt?.tier_label ??       // price_tiers_v2
    opt?.display_name ??     // common alias
    opt?.name ??
    opt?.title ??
    opt?.display ??
    opt?.text ??
    "";

  const norm = (s) => String(s ?? "").trim();
  const lower = (s) => norm(s).toLowerCase();

  // Build index for case-insensitive matching by key OR label
  const buildIndex = (opts) => {
    const byKey = new Map();
    const byKeyL = new Map();
    const byLabel = new Map();
    const byLabelL = new Map();
    for (const o of opts || []) {
      const k = norm(resolveOptKey(o));
      const l = norm(resolveOptLabel(o));
      if (k) {
        byKey.set(k, o);
        byKeyL.set(lower(k), o);
      }
      if (l) {
        byLabel.set(l, o);
        byLabelL.set(lower(l), o);
      }
    }
    return { byKey, byKeyL, byLabel, byLabelL };
  };

  // Prefer map labels if present
  const labelFromMaps = (q, ans) => {
    const s = norm(
      ans && typeof ans === "object"
        ? ans.key ?? ans.value ?? ans.tier_key ?? ans.id ?? ans.code ?? ans.slug ?? ans.label ?? ans.tier_label
        : ans
    );
    const candidates = [q?.value_label_map, q?.label_map, q?.price_tiers_map, q?.price_tiers_v2_map, q?.tiers_map];
    for (const m of candidates) {
      if (m && typeof m === "object") {
        if (m[s]) return m[s];
        const ci = Object.entries(m).find(([k]) => lower(k) === lower(s));
        if (ci) return ci[1];
      }
    }
    return null;
  };

  // Always resolve to a human label, regardless of q.type
  const humanLabelForAnswer = (q, ans) => {
    // 1) Direct maps first
    const mapped = labelFromMaps(q, ans);
    if (mapped) return mapped;

    // 2) Options/index lookup by key or label (case-insensitive)
    const opts = getOptionsArray(q);
    if (opts.length) {
      const idx = buildIndex(opts);

      // If the answer is an object, try all plausible fields
      if (ans && typeof ans === "object") {
        const tryVals = [
          ans.key, ans.value, ans.tier_key, ans.id, ans.code, ans.slug,
          ans.label, ans.tier_label, ans.name, ans.title, ans.display, ans.text,
        ];
        for (const v of tryVals) {
          if (!v) continue;
          const s = norm(v);
          const sl = lower(v);
          const found =
            idx.byKey.get(s) || idx.byKeyL.get(sl) || idx.byLabel.get(s) || idx.byLabelL.get(sl);
          if (found) return resolveOptLabel(found);
        }
      } else {
        const s = norm(ans);
        const sl = lower(ans);
        const found =
          idx.byKey.get(s) || idx.byKeyL.get(sl) || idx.byLabel.get(s) || idx.byLabelL.get(sl);
        if (found) return resolveOptLabel(found);
      }
    }

    // 3) Fallback to raw value
    return norm(ans);
  };

  const mirrorLines = useMemo(() => {
    if (!questions?.length) return [];
    const lines = [];

    for (const q of questions) {
      const ans = answers[q.q_key];
      if (ans === undefined || ans === null || ans === "" || (Array.isArray(ans) && ans.length === 0)) continue;

      let label = "";
      if (Array.isArray(ans)) {
        const parts = ans.map((a) => humanLabelForAnswer(q, a)).filter(Boolean);
        label = parts.join(", ");
      } else {
        label = humanLabelForAnswer(q, ans);
      }
      if (!label) continue;

      const keyNorm = lower(q.q_key);
      let line = null;

      if (q.mirror_template) {
        line = q.mirror_template
          .split("{{answer_label_lower}}").join(label.toLowerCase())
          .split("{{answer_label}}").join(label);
      } else if (["edition", "editions", "product", "products", "industry_edition", "industry"].includes(keyNorm)) {
        line = `You have selected ${label}.`;
      } else if (
        [
          "transactions",
          "transaction_volume",
          "monthly_transactions",
          "commercial_transactions",
          "volume",
          "tier",
          "tiers",
          "price_tier",
          "transaction_tier",
          "transaction_tier_key",
        ].includes(keyNorm)
      ) {
        line = `You stated that you execute ${label} commercial transactions per month.`;
      }
      if (line) lines.push(line);
    }

    return lines;
  }, [questions, answers]);

  // ------------ return API ------------

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
