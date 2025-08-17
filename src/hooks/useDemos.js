import { useEffect, useState } from "react";
import { listDemos } from "../lib/api";
import { toDemo } from "../lib/normalize";

export function useDemos(apiBase, botId) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!botId) return;
    let alive = true;
    setLoading(true);
    listDemos(apiBase, botId)
      .then((rows) => alive && setDemos((rows || []).map(toDemo)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [apiBase, botId]);

  return { demos, loading, error };
}
