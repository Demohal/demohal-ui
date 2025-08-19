# =====================================================================
# BEGIN FILE: app/routes.py  (DemoHAL – Instrumented + Prompt-Slimmed)
# =====================================================================

# ===== SECTION 1: IMPORTS & GLOBAL CONFIG =============================
import os
import json
import time
import uuid
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

import httpx
from flask import Blueprint, jsonify, request, current_app
from supabase import create_client, Client
from openai import OpenAI
# ===== END SECTION 1 ==================================================


# ===== SECTION 2: BLUEPRINT & CLIENTS =================================
demo_hal_bp = Blueprint("demo_hal_bp", __name__)

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_API_KEY")
    or ""
)

_WRITER_MODEL = os.getenv("WRITER_MODEL", "gpt-4o-mini")
_EMBED_MODEL  = os.getenv("EMBED_MODEL", "text-embedding-3-small")

# Function-based rec knobs (env)
ASK_FUNC_MIN_RESULTS = int(os.getenv("ASK_FUNC_MIN_RESULTS", "3"))
ASK_FUNC_MAX_RESULTS = int(os.getenv("ASK_FUNC_MAX_RESULTS", "12"))  # UI can still show fewer/more

# Prompt size controls
ASK_INCLUDE_CANON = os.getenv("ASK_INCLUDE_CANON", "true").lower() == "true"
ASK_FUNC_CANON_K = int(os.getenv("ASK_FUNC_CANON_K", "80"))  # max lines from canon to include

# OpenAI per-request timeout
_OA_TIMEOUT = float(os.getenv("OA_TIMEOUT", "25"))

_sb: Optional[Client] = None
def sb() -> Client:
    global _sb
    if _sb is None:
        if not _SUPABASE_URL or not _SUPABASE_KEY:
            raise RuntimeError("Supabase client not configured")
        _sb = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    return _sb

_oa = OpenAI()  # requires OPENAI_API_KEY
# ===== END SECTION 2 ==================================================


# ===== SECTION 3: EMBEDDINGS & SMALL UTILS ============================
def get_embedding(text: str) -> List[float]:
    if not text:
        return []
    t0 = time.time()
    try:
        r = _oa.with_options(timeout=_OA_TIMEOUT).embeddings.create(
            model=_EMBED_MODEL, input=text[:8000]
        )
        emb = r.data[0].embedding
        _log(f"[emb] ok {len(text)} chars in {time.time()-t0:.2f}s")
        return emb
    except (httpx.TimeoutException, httpx.ReadTimeout, httpx.ConnectTimeout, TimeoutError) as e:
        _log(f"[emb] timeout after {time.time()-t0:.2f}s: {e}")
    except Exception as e:
        _log(f"[emb] error after {time.time()-t0:.2f}s: {e}")
    return []


def _log(msg: str):
    try:
        current_app.logger.warning(msg)
    except Exception:
        print(msg)


def _norm(s: str) -> str:
    if not s:
        return ""
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in s).split())


def _get_s(row: Dict[str, Any], *keys: str) -> str:
    """Return first non-empty trimmed string value for the given keys."""
    for k in keys:
        v = row.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _estimate_prompt_tokens(messages: List[Dict[str, Any]]) -> int:
    try:
        import tiktoken  # optional; ignore if unavailable
        enc = tiktoken.get_encoding("cl100k_base")
        return sum(len(enc.encode(m.get("content", ""))) for m in messages if isinstance(m, dict))
    except Exception:
        return -1

# ===== END SECTION 3 ==================================================


# ===== SECTION 4: BOT & CANON HELPERS =================================
@lru_cache(maxsize=64)
def _cached_canon(bot_id: str, _salt: int) -> List[Dict[str, Any]]:
    """Cache bot function canon for ~TTL controlled by _salt (e.g., minute-bucket)."""
    t0 = time.time()
    rows = (
        sb().table("bot_functions").select("id, title").eq("bot_id", bot_id).execute()
    ).data or []
    _log(f"[canon] fetch rows={len(rows)} in {time.time()-t0:.2f}s")
    return rows


def _narrow_function_canon(user_text: str, canon: List[Dict[str, Any]], k: int) -> List[Dict[str, Any]]:
    """Return up to k canon rows most related to user_text (simple token overlap)."""
    q = set(_norm(user_text).split())
    scored: List[Tuple[int, Dict[str, Any]]] = []
    for c in canon:
        t = _norm(c.get("title") or "")
        if not t:
            continue
        score = len(q & set(t.split()))
        scored.append((score, c))
    scored.sort(key=lambda x: (-x[0], _norm(x[1].get("title") or "")))
    out = [c for s, c in scored if s > 0][:k]
    return out or canon[:k]


def _fetch_bot(bot_id: str) -> Dict[str, Any]:
    r = (sb().table("bots").select("*").eq("id", bot_id).limit(1).execute())
    rows = r.data or []
    return rows[0] if rows else {}


def _load_function_canon(bot_id: str) -> List[Dict[str, Any]]:
    # Minimal fields: id, title; avoid guessing extra columns
    r = (
        sb().table("bot_functions").select("id,title,bot_id").eq("bot_id", bot_id).order("title").execute()
    )
    rows = r.data or []
    canon = [{"id": x["id"], "title": x["title"]} for x in rows if x.get("id") and x.get("title")]
    return canon


def _fetch_context_chunks(bot_id: str, question: str, max_chars: int = 9000) -> str:
    """Optional: build RAG context for the prose ONLY (not for recs)."""
    try:
        emb = get_embedding(question)
        mr = sb().rpc(
            "match_demo_knowledge_v2",
            {"bot_id": bot_id, "match_count": 200, "match_threshold": 0.00, "query_embedding": emb},
        ).execute()
        rows = mr.data or []
    except Exception as e:
        _log(f"[ask] context rpc error: {e}")
        rows = []

    ids = [x.get("id") for x in rows if x.get("id")]
    if not ids:
        return ""
    meta = (
        sb().table("demo_knowledge").select("id,content").in_("id", ids).execute().data
    ) or []
    m = {r["id"]: r.get("content") or "" for r in meta}

    parts, used = [], 0
    for rid in ids:
        c = (m.get(rid) or "").strip()
        if not c:
            continue
        c = c[:1000]
        if used + len(c) + 20 > max_chars:
            break
        parts.append(c)
        used += len(c) + 2
    return "\n\n---\n".join(parts)
# ===== END SECTION 4 ==================================================


# ===== SECTION 5: DEMO METADATA, GROUPING & RECS ======================

def _hydrate_demo_metadata(bot_id: str, demo_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Fetch * metadata for demos by id, safe against schema variance."""
    if not demo_ids:
        return {}
    try:
        rows = (
            sb().table("demo_videos").select("*").eq("bot_id", bot_id).in_("id", demo_ids).execute().data
        ) or []
    except Exception as e:
        _log(f"[_hydrate_demo_metadata] error: {e}")
        rows = []
    return {r["id"]: r for r in rows if r.get("id")}


def _as_button(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "title": row.get("title"),
        "url": row.get("url"),
        "description": row.get("description"),
    }


def _group_demo_buttons(rows: List[Dict[str, Any]], preferred_industry: Optional[str] = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Return (sections, flat_buttons) where sections are ordered Industry → Supergroup.
    Skips the "General Business" supergroup.
    """
    industries: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    supergroups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for r in rows:
        if not r or not r.get("id"):
            continue
        ind = _get_s(r, "industry", "industry_name", "demo_industry", "tag_industry")
        sg = _get_s(r, "supergroup", "supergroup_name", "demo_supergroup", "tag_supergroup")
        btn = _as_button(r)
        if ind:
            industries[ind].append(btn)
        if sg and _norm(sg) != _norm("General Business"):
            supergroups[sg].append(btn)

    ind_names = sorted(industries.keys(), key=lambda x: _norm(x))
    if preferred_industry:
        pi_norm = _norm(preferred_industry)
        for name in list(ind_names):
            if _norm(name) == pi_norm:
                ind_names.remove(name)
                ind_names.insert(0, name)
                break

    sections: List[Dict[str, Any]] = []

    for name in ind_names:
        sections.append({
            "kind": "industry",
            "title": name,
            "help_text": f"Demos tailored for the {name} industry.",
            "buttons": industries[name],
        })

    for name in sorted(supergroups.keys(), key=lambda x: _norm(x)):
        sections.append({
            "kind": "supergroup",
            "title": name,
            "help_text": f"Related demos by topic: {name}.",
            "buttons": supergroups[name],
        })

    if not sections:
        flat = [_as_button(r) for r in rows if r.get("id")]
        if flat:
            sections.append({
                "kind": "all",
                "title": "All demos",
                "help_text": "Browse available demos.",
                "buttons": flat,
            })

    flat_buttons: List[Dict[str, Any]] = []
    for s in sections:
        flat_buttons.extend(s.get("buttons", []))

    return sections, flat_buttons


# ---- RECOMMENDATIONS -------------------------------------------------
def _recommend_demos_by_functions(bot_id: str, used_function_ids: List[str]) -> List[Dict[str, Any]]:
    _log(f"[recs] start bot={bot_id} ids_in={len(used_function_ids)}")
    if not used_function_ids:
        _log("[recs] no function ids; returning min-results backfill")
        backfill = (
            sb().table("demo_videos")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .order("title")
            .limit(ASK_FUNC_MIN_RESULTS)
            .execute()
        ).data or []
        return [
            {
                "id": r["id"],
                "title": r.get("title"),
                "url": r.get("url"),
                "description": r.get("description"),
                "industry": r.get("industry"),
                "industry_name": r.get("industry_name"),
                "supergroup": r.get("supergroup"),
                "supergroup_name": r.get("supergroup_name"),
                "tag_industry": r.get("tag_industry"),
                "tag_supergroup": r.get("tag_supergroup"),
            }
            for r in backfill
            if r.get("id")
        ]

    dvbf = (
        sb().table("demo_videos_bot_functions")
        .select("demo_video_id,bot_function_id")
        .in_("bot_function_id", used_function_ids)
        .execute()
    ).data or []
    if not dvbf:
        _log("[recs] join table returned 0; falling back to min-results backfill")
        backfill = (
            sb().table("demo_videos")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .order("title")
            .limit(ASK_FUNC_MIN_RESULTS)
            .execute()
        ).data or []
        return [
            {
                "id": r["id"],
                "title": r.get("title"),
                "url": r.get("url"),
                "description": r.get("description"),
                "industry": r.get("industry"),
                "industry_name": r.get("industry_name"),
                "supergroup": r.get("supergroup"),
                "supergroup_name": r.get("supergroup_name"),
                "tag_industry": r.get("tag_industry"),
                "tag_supergroup": r.get("tag_supergroup"),
            }
            for r in backfill
            if r.get("id")
        ]

    from collections import defaultdict as _dd

    overlap = _dd(int)
    for row in dvbf:
        did, fid = row.get("demo_video_id"), row.get("bot_function_id")
        if did and fid:
            overlap[did] += 1

    demo_ids = list(overlap.keys())
    dv = (
        sb().table("demo_videos")
        .select("*")
        .in_("id", demo_ids)
        .eq("bot_id", bot_id)
        .eq("active", True)
        .execute()
    ).data or []

    cards = [
        {
            "id": r["id"],
            "title": r.get("title"),
            "url": r.get("url"),
            "description": r.get("description"),
            "industry": r.get("industry"),
            "industry_name": r.get("industry_name"),
            "supergroup": r.get("supergroup"),
            "supergroup_name": r.get("supergroup_name"),
            "tag_industry": r.get("tag_industry"),
            "tag_supergroup": r.get("tag_supergroup"),
            "_overlap": overlap.get(r["id"], 0),
        }
        for r in dv
        if r.get("id")
    ]

    cards.sort(key=lambda x: (-x.get("_overlap", 0), (x.get("title") or "")))
    maxn = max(ASK_FUNC_MAX_RESULTS, ASK_FUNC_MIN_RESULTS)
    cards = cards[:maxn]
    for c in cards:
        c.pop("_overlap", None)

    if len(cards) < ASK_FUNC_MIN_RESULTS:
        need = ASK_FUNC_MIN_RESULTS - len(cards)
        have = {c["id"] for c in cards}
        extra = (
            sb().table("demo_videos")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .order("title")
            .limit(need * 4)
            .execute()
        ).data or []
        for r in extra:
            if r.get("id") in have:
                continue
            cards.append(
                {
                    "id": r["id"],
                    "title": r.get("title"),
                    "url": r.get("url"),
                    "description": r.get("description"),
                    "industry": r.get("industry"),
                    "industry_name": r.get("industry_name"),
                    "supergroup": r.get("supergroup"),
                    "supergroup_name": r.get("supergroup_name"),
                    "tag_industry": r.get("tag_industry"),
                    "tag_supergroup": r.get("tag_supergroup"),
                }
            )
            have.add(r.get("id"))
            if len(cards) >= ASK_FUNC_MIN_RESULTS:
                break

    _log(f"[recs] done cards={len(cards)}")
    return cards

# ===== END SECTION 5 ==================================================


# ===== SECTION 6: PUBLIC ENDPOINTS (BOT, BROWSE) ======================
@demo_hal_bp.get("/bot-by-alias")
def bot_by_alias():
    try:
        alias = (request.args.get("alias") or "").strip()
        t0 = time.time()
        r = (
            sb().table("bots").select("*").eq("alias", alias).eq("active", True).limit(1).execute()
        )
        rows = r.data or []
        _log(f"[bot-by-alias] {alias!r} fetch {time.time()-t0:.2f}s rows={len(rows)}")
        if not rows:
            return jsonify({"error": "not found"}), 404
        return jsonify({"bot": rows[0]})
    except Exception as e:
        _log(f"[bot-by-alias] error: {e}")
        return jsonify({"error": "server error"}), 500


@demo_hal_bp.get("/browse-demos")
def browse_demos():
    """Return grouped demo buttons: Industry → Supergroup. Skips 'General Business'.
    Optional query param `industry` to prioritize a specific industry section first.
    """
    try:
        bot_id = (request.args.get("bot_id") or "").strip()
        preferred_industry = (request.args.get("industry") or "").strip()
        if not bot_id:
            return jsonify({"demos": [], "sections": [], "buttons": []})

        try:
            t0 = time.time()
            r = (
                sb().table("demo_videos")
                .select("*")
                .eq("bot_id", bot_id)
                .eq("active", True)
                .order("title")
                .execute()
            )
            rows = r.data or []
            _log(f"[browse-demos] demos fetch {time.time()-t0:.2f}s rows={len(rows)}")
        except Exception as e:
            _log(f"[browse-demos] select error, falling back minimal cols: {e}")
            r = (
                sb().table("demo_videos")
                .select("id,bot_id,title,url,description,active")
                .eq("bot_id", bot_id)
                .eq("active", True)
                .order("title")
                .execute()
            )
            rows = r.data or []

        sections, flat_buttons = _group_demo_buttons(
            rows, preferred_industry=preferred_industry or None
        )
        return jsonify(
            {
                "demos": flat_buttons,  # backward compatible
                "buttons": flat_buttons,  # explicit for UI
                "sections": sections,  # NEW grouped structure
                "type": "grouped_buttons",  # optional hint to UI
            }
        )
    except Exception as e:
        _log(f"[browse-demos] error: {e}")
        return jsonify({"demos": [], "buttons": [], "sections": []})
# ===== END SECTION 6 ==================================================


# ===== SECTION 7: /demo-hal route (INSTRUMENTED + GROUPED)  =====

@demo_hal_bp.post("/demo-hal")
def demo_hal():
    """
    Ask-the-Assistant entrypoint.
    - Builds a sales-friendly answer using the writer system prompt.
    - Extracts function IDs (or titles) the writer claims it used.
    - Maps those functions to demos via join table and returns UI-ready *grouped* buttons.
    - Includes detailed timing logs and prompt size metrics.
    """
    cid = uuid.uuid4().hex[:8]
    t0 = time.time()
    _log(f"[{cid}] START /demo-hal")

    try:
        payload = request.get_json(silent=True) or {}
        bot_id: str = (payload.get("bot_id") or "").strip()
        user_text: str = (
            payload.get("text")
            or payload.get("question")
            or payload.get("user_question")
            or ""
        ).strip()
        preferred_industry = (
            payload.get("industry")
            or payload.get("visitor_industry")
            or payload.get("preferred_industry")
            or ""
        ).strip() or None

        if not bot_id or not user_text:
            return jsonify({"error": "bot_id and text are required"}), 400

        # --- Load bot config (writer prompt + ask rec settings)
        t = time.time()
        bot_rows = (
            sb()
            .table("bots")
            .select(
                "id, alias, writer_system, ask_rec_threshold, ask_rec_min_results, ask_rec_candidate_count"
            )
            .eq("id", bot_id)
            .limit(1)
            .execute()
        ).data or []
        _log(f"[{cid}] sb:bot {time.time()-t:.2f}s")
        if not bot_rows:
            _log(f"[{cid}] bot not found: {bot_id}")
            return jsonify({"error": "bot not found"}), 404

        bot = bot_rows[0]
        writer_system: str = (bot.get("writer_system") or "").strip()
        bot_thr = bot.get("ask_rec_threshold")
        bot_min = bot.get("ask_rec_min_results") or ASK_FUNC_MIN_RESULTS
        bot_cand = bot.get("ask_rec_candidate_count") or 300
        _log(f"[{cid}] bot={bot.get('alias')} thr={bot_thr} min={bot_min} cand={bot_cand}")

        # --- Canon: bot functions (ID -> Title) with 5-min cache, then narrow to K
        salt = int(time.time() // 300)  # 5-minute TTL
        t = time.time()
        canon = _cached_canon(bot_id, salt)
        _log(f"[{cid}] canon fetched {time.time()-t:.2f}s rows={len(canon)}")
        if not canon:
            _log(f"[{cid}] no bot_functions; returning empty buttons")
            return jsonify(
                {
                    "type": "message_with_buttons",
                    "response_text": "",
                    "demos": [],
                    "buttons": [],
                    "sections": [],
                }
            ), 200

        ncanon = _narrow_function_canon(user_text, canon, ASK_FUNC_CANON_K)
        canon_lines = [f"{c['id']}::{c.get('title','')}" for c in ncanon]
        canon_blob = "\n".join(canon_lines)

        # --- Build messages for the writer (no duplicated titles list)
        system_rules = ((writer_system + "\n\n") if writer_system else "") + (
            "Return JSON with fields:\n"
            " - response_text: string (your final answer to the user).\n"
            " - used_function_ids: array of function UUIDs you relied on (use ONLY IDs from the canon provided).\n"
        )

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_rules},
            {"role": "user", "content": f"User question:\n{user_text}"},
        ]
        if ASK_INCLUDE_CANON:
            messages.append(
                {
                    "role": "user",
                    "content": (
                        f"Function canon (subset {len(ncanon)}/{len(canon)}). "
                        "Reply using only IDs from this list (format 'id::title'):\n"
                        f"{canon_blob}"
                    ),
                }
            )
        else:
            _log(f"[{cid}] canon omitted (ASK_INCLUDE_CANON=false)")

        msg_chars = len(json.dumps(messages, ensure_ascii=False))
        tok = _estimate_prompt_tokens(messages)
        _log(f"[{cid}] prompt chars={msg_chars} tokens≈{tok if tok>=0 else 'n/a'}")

        # --- CALL WRITER (JSON mode), parse IDs or Titles, with logging
        response_text = ""
        used_function_ids: List[str] = []
        mapped_titles: List[str] = []

        try:
            t = time.time()
            r = _oa.with_options(timeout=_OA_TIMEOUT).chat.completions.create(
                model=_WRITER_MODEL,
                messages=messages,
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = r.choices[0].message.content or "{}"
            _log(f"[{cid}] openai:chat {time.time()-t:.2f}s (clip): {content[:200]}")
            obj = json.loads(content)
            response_text = (obj.get("response_text") or "").strip()

            raw_list = (
                obj.get("used_function_ids")
                or obj.get("used_functions")
                or obj.get("functions")
                or []
            )
            _log(f"[{cid}] raw used_functions len={len(raw_list)}")

            id_to_title = {c["id"]: c["title"] for c in canon}
            title_to_id = {_norm(c["title"]): c["id"] for c in canon if c.get("title")}

            picked: set[str] = set()
            for itm in raw_list:
                if isinstance(itm, str):
                    if itm in id_to_title:
                        picked.add(itm)
                    else:
                        mapped = title_to_id.get(_norm(itm))
                        if mapped:
                            picked.add(mapped)
                elif isinstance(itm, dict):
                    cand = itm.get("id") or itm.get("function_id")
                    if isinstance(cand, str) and cand in id_to_title:
                        picked.add(cand)
                    else:
                        tname = itm.get("title") or itm.get("name")
                        if isinstance(tname, str):
                            mapped = title_to_id.get(_norm(tname))
                            if mapped:
                                picked.add(mapped)

            used_function_ids = list(picked)
            _log(f"[{cid}] after JSON mapping ids={len(used_function_ids)}")
            mapped_titles = [id_to_title[i] for i in used_function_ids if i in id_to_title]
            _log(f"[{cid}] used_functions ids={used_function_ids}")
            _log(f"[{cid}] used_functions titles={mapped_titles}")

        except (httpx.TimeoutException, httpx.ReadTimeout, httpx.ConnectTimeout, TimeoutError) as e:
            _log(f"[{cid}] writer timeout after {time.time()-t:.2f}s: {e}")
            return (
                jsonify(
                    {
                        "type": "message_with_buttons",
                        "response_text": "Sorry—my model is taking too long to respond. Please try again in a moment.",
                        "demos": [],
                        "buttons": [],
                        "sections": [],
                        "error": "model_timeout",
                    }
                ),
                504,
            )
        except Exception as e:
            _log(f"[{cid}] writer JSON failed: {e}")
            try:
                t = time.time()
                r = _oa.with_options(timeout=_OA_TIMEOUT).chat.completions.create(
                    model=_WRITER_MODEL, messages=messages, temperature=0.2
                )
                response_text = (r.choices[0].message.content or "").strip()
                _log(f"[{cid}] writer fallback text in {time.time()-t:.2f}s")
            except Exception as e2:
                _log(f"[{cid}] writer fallback failed: {e2}")
                response_text = "Here’s how we can help at a high level."

        # --- Fallback: scan prose for canon titles if still empty
        if not used_function_ids and response_text:
            norm_rt = _norm(response_text)
            id_hits: List[str] = []
            for c in canon:
                tname = _norm(c.get("title") or "")
                if tname and tname in norm_rt:
                    id_hits.append(c["id"])
            used_function_ids = id_hits
            _log(f"[{cid}] prose match ids={len(used_function_ids)}")

        # --- Build recommendation *cards* from functions (with internal backfill)
        t = time.time()
        cards = _recommend_demos_by_functions(bot_id, used_function_ids)
        _log(f"[{cid}] recs build {time.time()-t:.2f}s -> {len(cards)} cards")

        # --- Ensure grouping metadata present (hydrate if missing)
        missing_meta_ids = [
            c.get("id")
            for c in cards
            if c
            and c.get("id")
            and not any(
                k in c
                for k in (
                    "industry",
                    "industry_name",
                    "demo_industry",
                    "tag_industry",
                    "supergroup",
                    "supergroup_name",
                    "demo_supergroup",
                    "tag_supergroup",
                )
            )
        ]
        if missing_meta_ids:
            t = time.time()
            meta_map = _hydrate_demo_metadata(bot_id, missing_meta_ids)
            for c in cards:
                if not c or not c.get("id"):
                    continue
                m = meta_map.get(c["id"]) or {}
                for k in (
                    "industry",
                    "industry_name",
                    "demo_industry",
                    "tag_industry",
                    "supergroup",
                    "supergroup_name",
                    "demo_supergroup",
                    "tag_supergroup",
                ):
                    if k in m and k not in c:
                        c[k] = m[k]
            _log(f"[{cid}] hydrate meta {time.time()-t:.2f}s for {len(missing_meta_ids)} ids")

        sections, flat_buttons = _group_demo_buttons(
            cards, preferred_industry=preferred_industry
        )
        _log(f"[{cid}] returning sections={len(sections)} buttons={len(flat_buttons)} total={time.time()-t0:.2f}s")

        return (
            jsonify(
                {
                    "type": "message_with_buttons",
                    "response_text": response_text,
                    "demos": flat_buttons,  # backward-compatible
                    "buttons": flat_buttons,  # UI buttons
                    "sections": sections,  # NEW grouped structure (Industry → Supergroup)
                    "debug": {
                        "used_function_ids": used_function_ids,
                        "used_function_titles": mapped_titles,
                        "preferred_industry": preferred_industry,
                        "prompt_chars": msg_chars,
                        "prompt_tokens": tok if tok >= 0 else None,
                        "canon_rows": len(canon),
                        "canon_subset": len(ncanon),
                        "cid": cid,
                    },
                }
            ),
            200,
        )

    except Exception as e:
        _log(f"[{cid}] fatal error: {e}")
        return jsonify({"error": "internal_error"}), 500

# ===== END SECTION 7 =====


# =====================================================================
# END FILE: app/routes.py
# =====================================================================
