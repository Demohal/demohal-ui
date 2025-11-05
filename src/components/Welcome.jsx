# =====================================================================
# app/routes.py — DemoHAL API (v2 RAG + Perspective Controls)
# =====================================================================
#
# CHANGES (Perspective Refactor):
#   - Removed persona-based logic (personas_v2) for retrieval & prompt shaping.
#   - Added Perspective system (single directive added to system prompt).
#   - Perspective sources (precedence):
#        1. Request body: body.perspective
#        2. Session context: activity_sessions_v2.context.perspective
#        3. Visitor form fill: visitors_v2.formfill_fields (array with field_key=perspective)
#        4. Default "general"
#   - Persist perspective to session context (not rewriting visitor automatically unless via formfill POST).
#   - Form fill config (/formfill-config) now guarantees a "perspective" single_select field
#     (collected + required) with canonical options; visitor default normalized (lowercase) or "general".
#   - /visitor-formfill POST normalizes and validates perspective (fallback to "general").
#   - /demo-hal prompt now includes perspective directive (PERSPECTIVE_PROMPTS) and logs 'perspective'.
#   - Knob defaults (retrieval & generation) now static (no persona table lookup).
#
# NOTE:
#   Existing schema uses visitors_v2.formfill_fields as an array:
#       [{field_key, field_value}, ...]
#   This file merges new perspective updates seamlessly with existing structure.
#
# =====================================================================

import os
import re
import time
import json
import uuid
import hmac
import base64
import hashlib
from typing import Any, Dict, List, Optional, Tuple
from flask import Blueprint, jsonify, request, current_app, g
from flask_cors import cross_origin
from supabase import create_client, Client
from openai import OpenAI
from urllib.parse import urlparse
import bcrypt
from datetime import datetime, timezone, timedelta

# -----------------------------------------------------------------------------
# Blueprint & clients
# -----------------------------------------------------------------------------

SESSION_IDLE_TIMEOUT_MINUTES = int(os.getenv("SESSION_IDLE_TIMEOUT_MINUTES", "30"))
SESSION_SWEEP_SECRET = os.getenv("SESSION_SWEEP_SECRET", "").strip()

demo_hal_bp = Blueprint("demo_hal_bp", __name__)

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_API_KEY") or ""
if not _SUPABASE_URL or not _SUPABASE_KEY:
    raise RuntimeError("Supabase config missing")

_sb: Optional[Client] = None
def sb() -> Client:
    global _sb
    if _sb is None:
        _sb = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    return _sb

# OpenAI
_oa = OpenAI()
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-ada-002")  # 1536-dim
CHAT_MODEL  = os.getenv("CHAT_MODEL", "gpt-4o")

# -----------------------------------------------------------------------------
# Perspective (cached constants)
# -----------------------------------------------------------------------------
PERSPECTIVE_PROMPTS: Dict[str, str] = {
    "general": "Provide a balanced answer that highlights the overall value, combining strategic, operational, financial, technical, and user benefits.",
    "financial": "Frame your answer in financial terms: emphasize ROI, cost savings, resource allocation efficiency, and overall business value.",
    "operational": "Frame your answer in operational terms: emphasize workflow efficiency, integration with existing systems, reliability, and uptime.",
    "executive": "Frame your answer in executive terms: emphasize strategic alignment, business growth, risk mitigation, and innovation potential.",
    "technical": "Frame your answer in technical terms: emphasize security, compliance, scalability, integration ease, and technical soundness.",
    "user": "Frame your answer in end-user terms: emphasize ease of use, adoption likelihood, productivity improvements, and support resources.",
    "sales": "Frame your answer in Sales / Marketing terms: emphasize impact on customer experience, reputation, references, and competitive advantage.",
    "compliance": "Frame your answer in compliance terms: emphasize legal soundness, regulatory requirements, data governance, and contractual protections.",
}
ALLOWED_PERSPECTIVES = set(PERSPECTIVE_PROMPTS.keys())

PERSPECTIVE_OPTIONS = [
    {"key": "general",     "label": "General"},
    {"key": "financial",   "label": "Financial"},
    {"key": "operational", "label": "Operational"},
    {"key": "executive",   "label": "Owner / Executive"},
    {"key": "technical",   "label": "Technical / IT"},
    {"key": "user",        "label": "User / Functional"},
    {"key": "sales",       "label": "Sales / Marketing"},
    {"key": "compliance",  "label": "Governance / Compliance"},
]

def _infer_perspective(bot_id: str, session_id: str, visitor_id: str, body: dict) -> str:
    """
    Precedence:
      1. Request body
      2. Visitor form fill (most up to date)
      3. Session context
      4. Default 'general'
    Rationale: a mid-session form fill change should immediately take effect
               without needing a new request param.
    """
    # 1. Request body override
    p = (body.get("perspective") or "").strip().lower()
    if p in ALLOWED_PERSPECTIVES:
        return p

    # 2. Visitor stored value
    try:
        if visitor_id:
            vr = (
                sb().table("visitors_v2")
                .select("formfill_fields")
                .eq("id", visitor_id)
                .limit(1).execute()
            )
            row = (vr.data or [None])[0]
            if row and isinstance(row.get("formfill_fields"), list):
                for f in row["formfill_fields"]:
                    if isinstance(f, dict) and f.get("field_key") == "perspective":
                        vp = (f.get("field_value") or "").lower()
                        if vp in ALLOWED_PERSPECTIVES:
                            return vp
    except Exception:
        pass

    # 3. Session context fallback
    try:
        if session_id:
            sr = (
                sb().table("activity_sessions_v2")
                .select("context")
                .eq("id", session_id)
                .limit(1).execute()
            )
            srow = (sr.data or [None])[0]
            if srow and isinstance(srow.get("context"), dict):
                ctxp = (srow["context"].get("perspective") or "").lower()
                if ctxp in ALLOWED_PERSPECTIVES:
                    return ctxp
    except Exception:
        pass

    return "general"


def _persist_session_perspective(session_id: str, perspective: str):
    """Idempotently store perspective in session context."""
    if not session_id or perspective not in ALLOWED_PERSPECTIVES:
        return
    try:
        sr = (
            sb().table("activity_sessions_v2")
            .select("context")
            .eq("id", session_id)
            .limit(1).execute()
        )
        row = (sr.data or [None])[0]
        ctx = {}
        if row and isinstance(row.get("context"), dict):
            ctx = dict(row["context"])
        if ctx.get("perspective") == perspective:
            return
        ctx["perspective"] = perspective
        ctx["updated_at"] = time.time()
        sb().table("activity_sessions_v2").update({"context": ctx}).eq("id", session_id).execute()
    except Exception as e:
        _log(f"[persist_session_perspective] {e}")

def _keyword_fallback(bot_id: str, question: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Lexical fallback: simple token (>=3 chars) scan over content.
    Scores by repeated hits; returns synthetic similarity (sim) for ordering.
    """
    try:
        tokens = set(re.findall(r"[a-zA-Z0-9]{3,}", (question or "").lower()))
        if not tokens:
            return []
        tokens = list(tokens)[:10]  # cap
        results: Dict[str, Dict[str, Any]] = {}
        for tk in tokens:
            pattern = f"%{tk}%"
            try:
                r = (
                    sb().table("knowledge_v2")
                    .select("id,title,content")
                    .eq("bot_id", bot_id)
                    .eq("active", True)
                    .ilike("content", pattern)
                    .limit(limit)
                    .execute()
                )
                for row in (r.data or []):
                    rid = str(row.get("id"))
                    if rid not in results:
                        results[rid] = {
                            "id": rid,
                            "title": row.get("title"),
                            "content": row.get("content"),
                            "hits": 1,
                        }
                    else:
                        results[rid]["hits"] += 1
            except Exception as e:
                _log(f"[keyword_fallback:{tk}] {e}")
        ranked = sorted(results.values(), key=lambda x: x["hits"], reverse=True)
        out = []
        for r in ranked[:limit]:
            sim = min(0.55, 0.30 + 0.05 * r["hits"])  # bounded synthetic similarity
            out.append({"id": r["id"], "title": r["title"], "content": r["content"], "sim": sim})
        return out
    except Exception as e:
        _log(f"[keyword_fallback] {e}")
        return []


def _expand_if_low_coverage(bot_id: str, current_hits: List[Dict[str, Any]], question: str, target: int) -> List[Dict[str, Any]]:
    """
    If we have some semantic hits but too few, add lexical expansions up to target.
    """
    if not current_hits or len(current_hits) >= target:
        return []
    existing = {h["id"] for h in current_hits if h.get("id")}
    lexical = _keyword_fallback(bot_id, question, limit=target * 2)
    out = []
    for h in lexical:
        if h["id"] not in existing:
            out.append(h)
            existing.add(h["id"])
        if len(current_hits) + len(out) >= target:
            break
    return out

# -----------------------------------------------------------------------------
# Logging & small utils
# -----------------------------------------------------------------------------
def _log(msg: str):
    try:
        current_app.logger.warning(msg)
    except Exception:
        print(msg)

def _now() -> str:
    return f"{time.time():.3f}"

def _short(text: str, n: int) -> str:
    if not text:
        return ""
    s = re.sub(r"\s+", " ", str(text)).strip()
    return s if len(s) <= n else s[: n - 3] + "..."

def _parse_iso_dt(s: Optional[str]) -> Optional[datetime]:
    if not s or not isinstance(s, str):
        return None
    try:
        # Normalize potential 'Z'
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

# -----------------------------------------------------------------------------
# Force-bot configuration (domain-aware)
# -----------------------------------------------------------------------------
FORCE_BOT_DOMAIN = os.getenv("FORCE_BOT_DOMAIN", "demohal.bot").strip().lower()
FORCE_BOT_ID     = os.getenv("FORCE_BOT_ID", "").strip()

def _detect_caller_domain(req) -> str:
    try:
        origin = (req.headers.get("Origin") or "").strip()
        if origin:
            return (urlparse(origin).netloc or "").lower()
    except Exception:
        pass
    try:
        ref = (req.headers.get("Referer") or "").strip()
        if ref:
            return (urlparse(ref).netloc or "").lower()
    except Exception:
        pass
    xfwd = (req.headers.get("X-Forwarded-Host") or "").strip().lower()
    if xfwd:
        return xfwd
    host = (request.headers.get("Host") or "").strip().lower()
    return host

@demo_hal_bp.before_app_request
def _apply_force_bot_if_applicable():
    try:
        g.caller_domain = _detect_caller_domain(request)
        g.forced_bot_id = FORCE_BOT_ID if g.caller_domain == FORCE_BOT_DOMAIN and FORCE_BOT_ID else ""
    except Exception:
        g.caller_domain = ""
        g.forced_bot_id = ""

@demo_hal_bp.after_app_request
def _annotate_response(resp):
    try:
        if getattr(g, "caller_domain", None):
            resp.headers["X-DemoHAL-Domain"] = g.caller_domain
        if getattr(g, "forced_bot_id", ""):
            resp.headers["X-DemoHAL-Forced-Bot"] = g.forced_bot_id
    except Exception:
        pass
    return resp

# -----------------------------------------------------------------------------
# CORS helper
# -----------------------------------------------------------------------------
def _corsify(resp):
    try:
        origin = request.headers.get("Origin")
        hdrs = resp.headers
        if origin:
            hdrs["Access-Control-Allow-Origin"] = origin
            hdrs["Vary"] = "Origin"
        else:
            hdrs["Access-Control-Allow-Origin"] = "*"
        hdrs["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, X-Requested-With, X-Session-Id, X-Visitor-Id"
        )
        hdrs["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        hdrs["Access-Control-Allow-Credentials"] = "true"
        hdrs["Access-Control-Max-Age"] = "86400"
        hdrs["Access-Control-Expose-Headers"] = "X-DemoHAL-Domain, X-DemoHAL-Forced-Bot"
    except Exception as e:
        _log(f"[corsify] {e}")
    return resp

# -----------------------------------------------------------------------------
# Existing selectors & small helpers
# -----------------------------------------------------------------------------
AGENT_SELECT_FIELDS = (
    "id, name, email, calendar_link, calendar_link_type, schedule_header, active, alias, created_at"
)

def _fetch_all_demos(bot_id: str) -> List[Dict[str, Any]]:
    FIELDS = "id, title, description, url, active, topic"
    try:
        res = (
            sb().table("demos_v2").select(FIELDS)
            .eq("bot_id", bot_id).eq("active", True).order("title")
            .execute()
        )
        return res.data or []
    except Exception as e:
        _log(f"[_fetch_all_demos] {e}")
        return []

def _fetch_all_documents(bot_id: str) -> List[Dict[str, Any]]:
    FIELDS = "id, title, description, url, active, topic"
    try:
        res = (
            sb().table("documents_v2").select(FIELDS)
            .eq("bot_id", bot_id).eq("active", True).order("title")
            .execute()
        )
        return res.data or []
    except Exception as e:
        _log(f"[_fetch_all_documents] {e}")
        return []

# --- PATCH: helpers for formfill array↔map conversions ---
def _ff_arr_to_map(arr):
    """Convert visitors_v2.formfill_fields array → flat map { key: value }."""
    out = {}
    try:
        if isinstance(arr, list):
            for x in arr:
                if isinstance(x, dict) and x.get("field_key"):
                    out[x["field_key"]] = x.get("field_value") or ""
    except Exception as e:
        _log(f"[_ff_arr_to_map] {e}")
    return out

def _ff_merge_map_into_arr(base_arr, new_map):
    """Merge a flat map into an array-of-objects by field_key; return array.
    Deterministic order by field_key for stable diffs.
    """
    by_key = {}
    try:
        if isinstance(base_arr, list):
            for x in base_arr:
                if isinstance(x, dict) and x.get("field_key"):
                    by_key[x["field_key"]] = {
                        "field_key": x["field_key"],
                        "field_value": x.get("field_value") or "",
                    }
        for k, v in (new_map or {}).items():
            if not k:
                continue
            by_key[k] = {"field_key": k, "field_value": (v if v is not None else "")}
        return [by_key[k] for k in sorted(by_key.keys())]
    except Exception as e:
        _log(f"[_ff_merge_map_into_arr] {e}")
        # fallback to minimal encoding
        return [{"field_key": k, "field_value": (v if v is not None else "")} for k, v in sorted((new_map or {}).items())]
# --- END PATCH ---

# -----------------------------------------------------------------------------
# Client name (used in system prompt)
# -----------------------------------------------------------------------------
def _fetch_client_name_for_bot(bot_id: str) -> str:
    """bots_v2 -> client_id -> clients_v2.name"""
    try:
        br = sb().table("bots_v2").select("client_id").eq("id", bot_id).limit(1).execute()
        row = (br.data or [{}])[0]
        cid = row.get("client_id")
        if not cid:
            return "Your Company"
        cr = sb().table("clients_v2").select("name").eq("id", cid).limit(1).execute()
        crow = (cr.data or [{}])[0]
        return (crow.get("name") or "Your Company").strip()
    except Exception as e:
        _log(f"[_fetch_client_name_for_bot] {e}")
        return "Your Company"

# -----------------------------------------------------------------------------
# Embedding & KB retrieval
# -----------------------------------------------------------------------------
def _embed(text: str) -> List[float]:
    """OpenAI embedding using text-embedding-ada-002 (1536-d)."""
    try:
        resp = _oa.embeddings.create(model=EMBED_MODEL, input=text)
        return resp.data[0].embedding
    except Exception as e:
        _log(f"[embed] {e}")
        return [0.0] * 1536

def _kb_retrieve(bot_id: str, q_vec: List[float], top_k: int, min_score: float) -> List[Dict[str, Any]]:
    """
    Retrieve from knowledge_v2 via RPC `match_knowledge_v2`.
    Accepts either:
      - distance in `score` or `distance`  -> sim = 1 - distance
      - similarity in `similarity` or `sim` -> sim = similarity
    """
    try:
        res = sb().rpc(
            "match_knowledge_v2",
            {
                "p_bot_id": bot_id,
                "query_embedding": q_vec,
                "match_count": int(max(1, top_k * 3)),
            },
        ).execute()
        rows = res.data or []
        out: List[Dict[str, Any]] = []
        for r in rows:
            sim = None
            if "similarity" in r and r["similarity"] is not None:
                sim = float(r["similarity"])
            elif "sim" in r and r["sim"] is not None:
                sim = float(r["sim"])
            else:
                dist = r.get("score", r.get("distance", r.get("cosine_distance")))
                if dist is not None:
                    sim = 1.0 - float(dist)
            if sim is None:
                continue
            if sim > 1.0:
                sim = 1.0
            if sim < -1.0:
                sim = -1.0
            if sim >= float(min_score):
                out.append({
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "content": r.get("content"),
                    "sim": sim
                })
        out.sort(key=lambda x: x["sim"], reverse=True)
        return out[:top_k]
    except Exception as e:
        _log(f"[_kb_retrieve:rpc_fallback] {e}")

    # Fallback
    try:
        r = (
            sb().table("knowledge_v2")
            .select("id,title,content")
            .eq("bot_id", bot_id).eq("active", True)
            .limit(top_k)
            .execute()
        )
        rows = r.data or []
        return [{"id": rr["id"], "title": rr.get("title") or "", "content": rr.get("content") or "", "sim": 0.5} for rr in rows]
    except Exception as e:
        _log(f"[_kb_retrieve:fallback_error] {e}")
        return []

# --- Recommendation selection (word overlap) ---
STOPWORDS = set([
    "the","and","for","with","you","your","has","that","this","also","more","first","fully","without",
    "across","every","their","they","them","of","in","on","to","as","is","it","at","by","be","or",
    "from","but","was","are","an","so","can","if","all","we","our","not","will","about","after",
    "before","which","into","how","when","what","who","where","why","should","could","would",
    "support","supports"
])

# Replace this function:
def _select_recommendations(
    demos,
    docs,
    kb_hits,
    limit: int = 6,
):
    """Rank demos/docs by word-overlap tokens derived from KB hits or question tokens, ignoring stopwords."""
    def _tokenize(s: str):
        s = (s or "").lower()
        out = []
        buf = []
        for ch in s:
            if ch.isalnum():
                buf.append(ch)
            else:
                if len(buf) >= 3:
                    word = "".join(buf)
                    if word not in STOPWORDS:
                        out.append(word)
                buf = []
        if len(buf) >= 3:
            word = "".join(buf)
            if word not in STOPWORDS:
                out.append(word)
        return set(out)

    key_terms = set()
    for h in (kb_hits or []):
        key_terms |= _tokenize(f"{h.get('title','')} {h.get('content','')}")
    if not key_terms:
        try:
            body = request.get_json(silent=True) or {}
            q = body.get("user_question") or body.get("question") or ""
        except Exception:
            q = ""
        if q:
            key_terms = _tokenize(q)

    def _score_item(title: str, desc: str = "") -> int:
        return len(_tokenize(f"{title} {desc}") & key_terms)

    demos_scored = sorted(
        ({"row": d, "s": _score_item(d.get("title", ""), d.get("description", ""))} for d in (demos or [])),
        key=lambda x: x["s"],
        reverse=True,
    )
    docs_scored = sorted(
        ({"row": d, "s": _score_item(d.get("title", ""), d.get("description", ""))} for d in (docs or [])),
        key=lambda x: x["s"],
        reverse=True,
    )
    demo_recs = [x["row"] for x in demos_scored if x["s"] > 0][:4]
    doc_recs  = [x["row"] for x in docs_scored if x["s"] > 0][:2]
    return demo_recs, doc_recs

_knowledge_cache: Dict[str, List[Dict[str, Any]]] = {}
def _preload_knowledge(bot_id: str):
    try:
        res = (
            sb().table("knowledge_v2").select("id, content, active")
            .eq("bot_id", bot_id).eq("active", True).limit(50).execute()
        )
        _knowledge_cache[bot_id] = res.data or []
    except Exception as e:
        _log(f"[preload_knowledge] {e}")
        _knowledge_cache[bot_id] = []

def _rank_demos_by_question(demos: List[Dict[str, Any]], question: str, k: int = 24) -> List[Dict[str, Any]]:
    if not demos:
        return []
    q_words = set(re.findall(r"[a-z0-9]+", (question or "").lower()))
    def score(d: Dict[str, Any]) -> int:
        text = f"{d.get('title','')} {d.get('description','')}".lower()
        words = set(re.findall(r"[a-z0-9]+", text))
        return len(q_words & words)
    return sorted(demos, key=score, reverse=True)[:k]

def _to_demo_item(d: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": d.get("id"),
        "title": d.get("title") or "",
        "url": d.get("url") or "",
        "description": d.get("description") or "",
        "active": d.get("active", True),
        "topic": d.get("topic") or "",
    }

def _to_demo_button(item: Dict[str, Any]) -> Dict[str, Any]:
    title = item.get("title") or ""
    url   = item.get("url") or ""
    desc  = item.get("description") or ""
    label = f'Watch the "{title}" demo'
    return {
        "label": label,
        "action": "demo",
        "value": url,
        "title": title,
        "description": desc,
        "button_label": label,
        "button_action": "demo",
        "button_value": url,
        "button_title": title,
        "summary": desc,
        "id": item.get("id"),
        "topic": item.get("topic") or "",
    }

def _to_doc_item(d: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": d.get("id"),
        "title": d.get("title") or "",
        "url": d.get("url") or "",
        "description": d.get("description") or "",
        "active": d.get("active", True),
        "topic": d.get("topic") or "",
    }

def _to_doc_button(item: Dict[str, Any]) -> Dict[str, Any]:
    title = item.get("title") or ""
    url   = item.get("url") or ""
    return {
        "button_label": f'Read "{title}"',
        "button_value": url,
        "button_title": title,
        "button_action": "document",
        "topic": item.get("topic") or "",
    }

# -----------------------------------------------------------------------------
# Canonical bot resolver & brand
# -----------------------------------------------------------------------------
@demo_hal_bp.get("/bot-settings")
def bot_settings():
    """
    Include formfill_intro so the FE can display personalized form fill intro text.
    """
    try:
        alias  = (request.args.get("alias")  or "").strip()
        bot_id = (request.args.get("bot_id") or "").strip()

        SELECT_FIELDS = (
            "id,client_id,alias,company_name,description,active,created_at,"
            "prompt_override,has_demos,has_docs,"
            "show_browse_demos,show_browse_docs,show_schedule_meeting,show_price_estimate,"
            "welcome_message,intro_video_url,show_intro_video,"
            "pricing_intro,pricing_outro,pricing_custom_notice,"
            "logo_url,first_question,formfill_intro,website,topics,"
            "banner_url,use_banner_url"
        )

        bot_row = None
        if bot_id:
            r = (
                sb().table("bots_v2")
                .select(SELECT_FIELDS)
                .eq("id", bot_id)
                .eq("active", True)
                .limit(1)
                .execute()
            )
            rows = r.data or []
            bot_row = rows[0] if rows else None
        elif alias:
            r = (
                sb().table("bots_v2")
                .select(SELECT_FIELDS)
                .eq("alias", alias)
                .eq("active", True)
                .limit(1)
                .execute()
            )
            rows = r.data or []
            bot_row = rows[0] if rows else None

        if not bot_row:
            return _corsify(jsonify({"ok": False, "error": "bot_not_found"})), 404

        bot_id = str(bot_row["id"])
        visitor = get_or_create_visitor(bot_id)
        session = None

        if visitor and visitor.get("id"):
            entry_ctx = {
                "entry_url": request.args.get("entry_url"),
                "referrer":  request.headers.get("Referer") or request.args.get("referrer"),
                "utm": {
                    "source":   request.args.get("utm_source"),
                    "medium":   request.args.get("utm_medium"),
                    "campaign": request.args.get("utm_campaign"),
                    "term":     request.args.get("utm_term"),
                    "content":  request.args.get("utm_content"),
                },
            }
            entry_ctx["utm"] = {k: v for k, v in (entry_ctx["utm"] or {}).items() if v} or None

            client_session_id = (request.args.get("session_id") or request.headers.get("X-Session-Id") or "").strip()
            if client_session_id:
                try:
                    sr = (
                        sb().table("activity_sessions_v2")
                        .select("id, bot_id, visitor_id, started_at, ended_at")
                        .eq("id", client_session_id)
                        .eq("bot_id", bot_id)
                        .eq("visitor_id", visitor["id"])
                        .limit(1)
                        .execute()
                    )
                    srows = sr.data or []
                    session = srows[0] if srows else None
                except Exception:
                    pass

            if not session:
                try:
                    sr = (
                        sb().table("activity_sessions_v2")
                        .select("id, bot_id, visitor_id, started_at, ended_at, last_event_at")
                        .eq("bot_id", bot_id)
                        .eq("visitor_id", visitor["id"])
                        .is_("ended_at", None)
                        .order("started_at", desc=True)
                        .limit(1)
                        .execute()
                    )
                    srows = sr.data or []
                    if srows:
                        candidate = srows[0]
                        try:
                            from datetime import datetime, timezone, timedelta
                            ref_iso = candidate.get("last_event_at") or candidate.get("started_at")
                            dt = None
                            if isinstance(ref_iso, str):
                                dt = datetime.fromisoformat(ref_iso.replace("Z", "+00:00"))
                            if dt and (datetime.now(timezone.utc) - dt) <= timedelta(minutes=30):
                                session = candidate
                        except Exception:
                            session = candidate
                except Exception:
                    pass

            if not session:
                session = create_session(bot_id, visitor["id"], entry=entry_ctx)
                try:
                    sb().rpc("inc_visitor_visit_count", {"p_visitor_id": visitor["id"]}).execute()
                except Exception:
                    try:
                        sb().table("visitors_v2").update({
                            "visit_count": (visitor.get("visit_count") or 1) + 1,
                            "last_seen_at": "now()"
                        }).eq("id", visitor["id"]).execute()
                    except Exception:
                        pass

            try:
                if session and session.get("id"):
                    ev_count = 0
                    try:
                        ev_count = (
                            sb().table("activity_events_v2")
                            .select("id", count="exact")
                            .eq("session_id", session["id"])
                            .execute()
                        ).count or 0
                    except Exception:
                        pass
                    if ev_count == 0:
                        log_event(
                            bot_id=bot_id,
                            session_id=session["id"],
                            visitor_id=visitor["id"],
                            event_type="init",
                            payload={
                                "version": os.getenv("APP_VERSION") or "unknown",
                                "screen": "ask",
                                "entry_params": {
                                    "alias": alias or None,
                                    "entry_url": entry_ctx.get("entry_url"),
                                    "referrer": entry_ctx.get("referrer"),
                                    "utm": entry_ctx.get("utm"),
                                },
                            },
                        )
            except Exception:
                pass

        resp = {
            "ok": True,
            "bot": {
                "id": bot_id,
                "alias": bot_row.get("alias"),
                "company_name": bot_row.get("company_name"),
                "description": bot_row.get("description"),
                "active": bot_row.get("active"),
                "created_at": bot_row.get("created_at"),
                "prompt_override": bot_row.get("prompt_override"),
                "has_demos": bot_row.get("has_demos"),
                "has_docs": bot_row.get("has_docs"),
                "show_browse_demos": bot_row.get("show_browse_demos"),
                "show_browse_docs": bot_row.get("show_browse_docs"),
                "show_schedule_meeting": bot_row.get("show_schedule_meeting"),
                "show_price_estimate": bot_row.get("show_price_estimate"),
                "welcome_message": bot_row.get("welcome_message"),
                "intro_video_url": bot_row.get("intro_video_url"),
                "show_intro_video": bot_row.get("show_intro_video"),
                "logo_url": bot_row.get("logo_url"),
                "pricing_intro": bot_row.get("pricing_intro"),
                "pricing_outro": bot_row.get("pricing_outro"),
                "pricing_custom_notice": bot_row.get("pricing_custom_notice"),
                "first_question": bot_row.get("first_question"),
                "formfill_intro": bot_row.get("formfill_intro"),
                "website": bot_row.get("website"),
                "topics": bot_row.get("topics"),
                "banner_url": bot_row.get("banner_url"),
                "use_banner_url": bot_row.get("use_banner_url"),
            },
            "visitor_id": (visitor or {}).get("id"),
            "session_id": (session or {}).get("id"),
        }
        return _corsify(jsonify(resp)), 200
    except Exception as e:
        _log(f"[/bot-settings] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

@demo_hal_bp.get("/brand")
def get_brand():
    # (UNCHANGED)
    try:
        bot_id = (request.args.get("bot_id") or "").strip()
        if not bot_id:
            return jsonify({"ok": False, "error": "bot_id_required"}), 400

        r2 = (
            sb().table("brand_tokens_v2")
            .select("token_key, value")
            .eq("bot_id", bot_id)
            .execute()
        )
        kv_rows = r2.data or []

        TOKEN_TO_CSS = {
            "banner.background":            "--banner-bg",
            "banner.foreground":            "--banner-fg",
            "page.background":              "--page-bg",
            "content.area.background":      "--card-bg",

            "message.text.foreground":      "--message-fg",
            "helper.text.foreground":       "--helper-fg",
            "mirror.text.foreground":       "--mirror-fg",

            "tab.background":               "--tab-bg",
            "tab.foreground":               "--tab-fg",

            "demo.button.background":       "--demo-button-bg",
            "demo.button.foreground":       "--demo-button-fg",

            "doc.button.background":        "--doc-button-bg",
            "doc.button.foreground":        "--doc-button-fg",

            "price.button.background":      "--price-button-bg",
            "price.button.foreground":      "--price-button-fg",

            "send.button.background":       "--send-color",

            "border.default":               "--border-default",
        }

        css_vars: Dict[str, str] = {}
        for row in kv_rows:
            tk = (row.get("token_key") or "").strip().lower()
            val = (row.get("value") or "").strip()
            css_name = TOKEN_TO_CSS.get(tk)
            if css_name and val:
                css_vars[css_name] = val

        assets: Dict[str, Any] = {}
        try:
            br = (
                sb().table("bots_v2")
                .select("logo_url")
                .eq("id", bot_id).limit(1).execute()
            )
            brow = (br.data or [{}])[0]
            if brow.get("logo_url"):
                assets["logo_url"] = brow["logo_url"]
        except Exception as _e:
            _log(f"[brand:assets-fallback] {_e}")

        return jsonify({"ok": True, "css_vars": css_vars, "assets": assets})
    except Exception as e:
        _log(f"[brand] fatal: {e}")
        return jsonify({"ok": False, "error": "server_error"}), 500

# ---------------------------------------------------------------------
# ThemeLab AUTH (bcrypt + signed cookie)
# ---------------------------------------------------------------------
THEMELAB_COOKIE_NAME = os.getenv("THEMELAB_COOKIE_NAME", "th_session")
THEMELAB_TTL_SECONDS = int(os.getenv("THEMELAB_TTL_SECONDS", "7200"))  # 2h

def _cookie_secret() -> bytes:
    s = os.getenv("THEMELAB_COOKIE_SECRET") or current_app.config.get("SECRET_KEY") or "change-me"
    return s.encode("utf-8")

def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

def _b64u_dec(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)

def _sign(data: bytes) -> str:
    mac = hmac.new(_cookie_secret(), data, hashlib.sha256).digest()
    return _b64u(mac)

def _mint_themelab_token(bot_id: str, ttl: int = THEMELAB_TTL_SECONDS) -> str:
    payload = {"bot_id": bot_id, "exp": int(time.time()) + int(ttl), "v": 1}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = _sign(raw)
    return f"{_b64u(raw)}.{sig}"

def _verify_themelab_token(token: str, expect_bot: Optional[str] = None) -> bool:
    try:
        p, s = token.split(".", 1)
        raw = _b64u_dec(p)
        if _sign(raw) != s:
            return False
        payload = json.loads(raw.decode("utf-8"))
        if expect_bot and payload.get("bot_id") != expect_bot:
            return False
        if int(payload.get("exp", 0)) < int(time.time()):
            return False
        return True
    except Exception:
        return False

def _is_secure_request() -> bool:
    if request.is_secure:
        return True
    xf_proto = (request.headers.get("X-Forwarded-Proto") or "").lower()
    return xf_proto == "https" or os.getenv("COOKIE_SECURE", "1") == "1"

def _get_themelab_hash(bot_id: str) -> Optional[str]:
    try:
        r = (
            sb().table("bots_v2")
            .select("themelab_secret_hash")
            .eq("id", bot_id)
            .limit(1)
            .execute()
        )
        rows = r.data or []
        if not rows:
            return None
        return rows[0].get("themelab_secret_hash") or None
    except Exception as e:
        _log(f"[get_themelab_hash] {e}")
        return None

def _require_themelab(bot_id: str):
    th = _get_themelab_hash(bot_id)
    if not th:
        return jsonify({"ok": False, "error": "themelab_disabled"}), 403
    token = request.cookies.get(THEMELAB_COOKIE_NAME, "")
    if not token or not _verify_themelab_token(token, expect_bot=bot_id):
        return jsonify({"ok": False, "error": "auth_required"}), 401
    return None

@demo_hal_bp.route("/themelab/login", methods=["POST", "OPTIONS"])
def themelab_login():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    try:
        payload = request.get_json(force=True, silent=True) or {}
        bot_id = (payload.get("bot_id") or "").strip()
        pwd = (payload.get("password") or "").encode("utf-8")
        if not bot_id or not pwd:
            return _corsify(jsonify({"ok": False, "error": "bot_id_and_password_required"})), 400

        h = _get_themelab_hash(bot_id)
        if not h:
            return _corsify(jsonify({"ok": False, "error": "themelab_disabled"})), 403

        ok = False
        try:
            ok = bcrypt.checkpw(pwd, h.encode("utf-8"))
        except Exception as e:
            _log(f"[themelab_login:checkpw] {e}")

        if not ok:
            return _corsify(jsonify({"ok": False, "error": "invalid_password"})), 401

        tok = _mint_themelab_token(bot_id)
        resp = jsonify({"ok": True})
        resp.set_cookie(
            THEMELAB_COOKIE_NAME,
            tok,
            max_age=THEMELAB_TTL_SECONDS,
            httponly=True,
            secure=_is_secure_request(),
            samesite="None",
            path="/",
        )
        return _corsify(resp)
    except Exception as e:
        _log(f"[themelab_login] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

@demo_hal_bp.post("/themelab/logout")
def themelab_logout():
    resp = jsonify({"ok": True})
    resp.set_cookie(
        THEMELAB_COOKIE_NAME, "", expires=0, httponly=True,
        secure=_is_secure_request(), samesite="None", path="/",
    )
    return _corsify(resp)

@demo_hal_bp.route("/themelab/status", methods=["GET", "OPTIONS"])
def themelab_status():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    bot_id = (request.args.get("bot_id") or "").strip()
    h = _get_themelab_hash(bot_id)
    if not h:
        return _corsify(jsonify({"ok": False, "error": "themelab_disabled"})), 403
    tok = request.cookies.get(THEMELAB_COOKIE_NAME, "")
    if tok and _verify_themelab_token(tok, expect_bot=bot_id):
        return _corsify(jsonify({"ok": True})), 200
    return _corsify(jsonify({"ok": False, "error": "unauthorized"})), 401

# ---------------------------------------------------------------------
# Client-controlled tokens (ColorBox support)
# ---------------------------------------------------------------------
@demo_hal_bp.route("/brand/client-tokens", methods=["GET", "OPTIONS"])
def brand_client_tokens():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    bot_id = (request.args.get("bot_id") or "").strip()
    if not bot_id:
        return _corsify(jsonify({"ok": False, "error": "missing_bot_id"})), 400
    guard = _require_themelab(bot_id)
    if guard is not None:
        resp, code = guard
        return _corsify(resp), code
    try:
        r = (
            sb()
            .table("brand_tokens_v2")
            .select("token_key,label,value,screen_key,client_controlled")
            .eq("bot_id", bot_id)
            .eq("client_controlled", True)
            .order("screen_key", desc=False)
            .order("label", desc=False)
            .execute()
        )
        rows = r.data or []
        tokens = [
            {
                "token_key": x.get("token_key"),
                "label": x.get("label"),
                "value": x.get("value"),
                "screen_key": x.get("screen_key") or "welcome",
            }
            for x in rows
        ]
        return _corsify(jsonify({"ok": True, "tokens": tokens})), 200
    except Exception as e:
        _log(f"[brand_client_tokens] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

@demo_hal_bp.route("/brand/client-tokens/save", methods=["POST", "OPTIONS"])
def brand_client_tokens_save():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    payload = request.get_json(force=True, silent=True) or {}
    bot_id = (payload.get("bot_id") or "").strip()
    items = payload.get("updates") or payload.get("tokens") or []
    if not bot_id:
        return _corsify(jsonify({"ok": False, "error": "missing_bot_id"})), 400
    guard = _require_themelab(bot_id)
    if guard is not None:
        resp, code = guard
        return _corsify(resp), code
    updated = 0
    try:
        for it in items:
            k = (it.get("token_key") or "").strip()
            v = (it.get("value") or "")
            if not k:
                continue
            sb().table("brand_tokens_v2") \
                .update({"value": v}) \
                .eq("bot_id", bot_id) \
                .eq("token_key", k) \
                .eq("client_controlled", True) \
                .execute()
            updated += 1
        return _corsify(jsonify({"ok": True, "updated": updated})), 200
    except Exception as e:
        _log(f"[brand_client_tokens_save] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

# (ThemeLab wording/options endpoints unchanged from previous patch)

_WORDING_SELECT = (
    "id, show_browse_demos, show_browse_docs, show_price_estimate, "
    "show_schedule_meeting, show_intro_video, intro_video_url, show_formfill, "
    "welcome_message, pricing_intro, pricing_outro, pricing_custom_notice, "
    "formfill_fields"
)

def _sanitize_bool(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        return v.strip().lower() in ("1", "true", "yes", "y", "on", "t")
    return False

def _extract_standard_formfill(ff_arr):
    KNOWN = {"organization", "company", "website", "title", "phone", "phone_number"}
    out = []
    try:
        for f in ff_arr or []:
            if not isinstance(f, dict):
                continue
            fk = (f.get("field_key") or "").strip()
            if not fk:
                continue
            if bool(f.get("is_standard")) or fk in KNOWN:
                out.append({
                    "field_key": fk,
                    "label": f.get("label") or fk.title(),
                    "is_collected": bool(f.get("is_collected", True)),
                    "is_required": bool(f.get("is_required", False)),
                })
    except Exception as e:
        _log(f"[wording.extract_standard] {e}")
    return out

@demo_hal_bp.route("/themelab/wording-options", methods=["GET","OPTIONS"])
def themelab_wording_options():
    if request.method=="OPTIONS":
        return _corsify(jsonify({"ok":True})),200
    bot_id=(request.args.get("bot_id") or "").strip()
    if not bot_id:
        return _corsify(jsonify({"ok":False,"error":"missing_bot_id"})),400
    guard=_require_themelab(bot_id)
    if guard is not None:
        resp,code=guard
        return _corsify(resp),code
    try:
        r=sb().table("bots_v2").select(
            "id, show_browse_demos, show_browse_docs, show_price_estimate, "
            "show_schedule_meeting, show_intro_video, intro_video_url, show_formfill, "
            "welcome_message, pricing_intro, pricing_outro, pricing_custom_notice, formfill_intro, formfill_fields"
        ).eq("id",bot_id).limit(1).execute()
        row=(r.data or [None])[0]
        if not row:
            return _corsify(jsonify({"ok":False,"error":"bot_not_found"})),404
        fields = row.get("formfill_fields") or []
        if not isinstance(fields,list): fields=[]
        SYNONYMS={"fname":"first_name","lname":"last_name"}
        CANON_LABELS={"first_name":"First Name","last_name":"Last Name"}
        merged={}
        for f in fields:
            if not isinstance(f,dict): continue
            fk = f.get("field_key")
            if not fk: continue
            canonical = SYNONYMS.get(fk,fk)
            existing = merged.get(canonical)
            cur = dict(f)
            cur["field_key"]=canonical
            if canonical=="perspective":
                cur["field_type"]="single_select"
                cur["options"]=[{"key":o["key"],"label":o["label"]} for o in (cur.get("options") or PERSPECTIVE_OPTIONS)]
                # Add default tooltip if missing
                if not cur.get("tooltip"):
                    cur["tooltip"] = "Select the perspective you most care about (optional)"
                if not cur.get("placeholder"):
                    cur["placeholder"] = cur["tooltip"]
            if canonical in CANON_LABELS:
                cur["label"]=CANON_LABELS[canonical]
            if not existing:
                merged[canonical]=cur
            else:
                existing["is_collected"]=existing.get("is_collected") or cur.get("is_collected")
                existing["is_required"]=existing.get("is_required") or cur.get("is_required")
                for k in ("tooltip","placeholder","field_type","options"):
                    if not existing.get(k) and cur.get(k): existing[k]=cur.get(k)
        out=[]
        for k in sorted(merged.keys()):
            f=merged[k]
            out.append({
                "field_key":f.get("field_key"),
                "label":f.get("label") or f.get("field_key"),
                "field_type":f.get("field_type") or "text",
                "is_required":bool(f.get("is_required")),
                "is_collected":bool(f.get("is_collected",True)),
                "options":f.get("options") if isinstance(f.get("options"),list) else None,
                "tooltip":f.get("tooltip"),
                "placeholder":f.get("placeholder"),
            })
        data={
          "ok":True,
          "bot_id":bot_id,
          "options":{
            "show_browse_demos":bool(row.get("show_browse_demos")),
            "show_browse_docs":bool(row.get("show_browse_docs")),
            "show_price_estimate":bool(row.get("show_price_estimate")),
            "show_schedule_meeting":bool(row.get("show_schedule_meeting")),
            "show_intro_video":bool(row.get("show_intro_video")),
            "show_formfill":bool(row.get("show_formfill")),
            "intro_video_url":row.get("intro_video_url") or "",
          },
          "messages":{
            "welcome_message":row.get("welcome_message") or "",
            "formfill_intro":row.get("formfill_intro") or "",
            "pricing_intro":row.get("pricing_intro") or "",
            "pricing_outro":row.get("pricing_outro") or "",
            "pricing_custom_notice":row.get("pricing_custom_notice") or "",
          },
          "standard_fields":out
        }
        return _corsify(jsonify(data)),200
    except Exception as e:
        _log(f"[themelab_wording_options] {e}")
        return _corsify(jsonify({"ok":False,"error":"server_error"})),500

@demo_hal_bp.route("/themelab/wording-options/save", methods=["POST","OPTIONS"])
def themelab_wording_options_save():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    body = request.get_json(silent=True) or {}
    bot_id = (body.get("bot_id") or "").strip()
    if not bot_id:
        return _corsify(jsonify({"ok": False, "error": "missing_bot_id"})), 400
    guard = _require_themelab(bot_id)
    if guard is not None:
        resp, code = guard
        return _corsify(resp), code

    options_in = body.get("options") or {}
    messages_in = body.get("messages") or {}
    std_fields_in = body.get("standard_fields") or []

    OPT_BOOL = {
        "show_browse_demos","show_browse_docs","show_price_estimate",
        "show_schedule_meeting","show_intro_video","show_formfill"
    }
    OPT_STR = {"intro_video_url"}
    MSG_KEYS = {
        "welcome_message","pricing_intro","pricing_outro",
        "pricing_custom_notice","formfill_intro"
    }

    def _b(v):
        if isinstance(v,bool): return v
        if isinstance(v,(int,float)): return bool(v)
        if isinstance(v,str): return v.strip().lower() in ("1","true","yes","on","y","t")
        return False

    patch={}
    for k in OPT_BOOL:
        if k in options_in: patch[k]=_b(options_in[k])
    for k in OPT_STR:
        if k in options_in: patch[k]=(options_in[k] or "").strip()
    for k in MSG_KEYS:
        if k in messages_in: patch[k]=(messages_in[k] or "").strip()

    try:
        if patch:
            sb().table("bots_v2").update(patch).eq("id",bot_id).execute()
    except Exception as e:
        _log(f"[wording_options_save:update] {e}")
        return _corsify(jsonify({"ok": False, "error": "update_failed"})), 500

    try:
        existing_resp = sb().table("bots_v2").select("formfill_fields").eq("id",bot_id).limit(1).execute()
        existing_row = (existing_resp.data or [None])[0] or {}
        existing = existing_row.get("formfill_fields") or []
        if not isinstance(existing,list): existing=[]
    except Exception as e:
        _log(f"[wording_options_save:select_existing] {e}")
        existing=[]

    by_key={}
    for f in existing:
        if isinstance(f,dict) and f.get("field_key"):
            by_key[f["field_key"]]=dict(f)

    SYNONYMS = {"fname":"first_name","lname":"last_name"}
    CANON_LABELS = {"first_name":"First Name","last_name":"Last Name"}

    for sf in std_fields_in:
        if not isinstance(sf,dict): continue
        fk = (sf.get("field_key") or "").strip()
        if not fk: continue
        canonical = SYNONYMS.get(fk,fk)
        base = by_key.get(canonical) or by_key.get(fk) or {"field_key":canonical}
        base["field_key"]=canonical
        if canonical in CANON_LABELS:
            base["label"]= CANON_LABELS[canonical]
        else:
            base.setdefault("label", base.get("label") or canonical.replace("_"," ").title())
        base["is_collected"]=bool(sf.get("is_collected", True))
        base["is_required"]=bool(sf.get("is_required", False))
        if canonical=="perspective":
            base["field_type"]="single_select"
            base["options"]=[{"key":o["key"],"label":o["label"]} for o in (base.get("options") or PERSPECTIVE_OPTIONS)]
        by_key[canonical]=base
        if fk in SYNONYMS and fk in by_key:
            try: del by_key[fk]
            except: pass

    for legacy,canon in SYNONYMS.items():
        if legacy in by_key:
            if canon in by_key:
                by_key[canon]["is_collected"] = by_key[canon].get("is_collected") or by_key[legacy].get("is_collected")
                by_key[canon]["is_required"] = by_key[canon].get("is_required") or by_key[legacy].get("is_required")
            del by_key[legacy]

    final_fields = [by_key[k] for k in sorted(by_key.keys())]

    try:
        sb().table("bots_v2").update({"formfill_fields": final_fields}).eq("id",bot_id).execute()
    except Exception as e:
        _log(f"[wording_options_save:write_ff] {e}")
        return _corsify(jsonify({"ok": False, "error": "ff_write_failed"})), 500

    return _corsify(jsonify({"ok": True,"saved_fields": len(final_fields)})), 200
    
# ---------------------------------------------------------------------
# Activity logging helpers & session/visitor creation (unchanged)
# ---------------------------------------------------------------------
def _first_public_ip(req) -> Optional[str]:
    def is_public(ip: str) -> bool:
        try:
            import ipaddress
            ipobj = ipaddress.ip_address(ip.strip())
            return not (ipobj.is_private or ipobj.is_loopback or ipobj.is_reserved or ipobj.is_multicast)
        except Exception:
            return False
    xff = (req.headers.get("X-Forwarded-For") or "")
    for part in [p.strip() for p in xff.split(",") if p.strip()]:
        if is_public(part):
            return part
    xr = (req.headers.get("X-Real-IP") or "").strip()
    if xr:
        return xr
    return req.remote_addr

def _truncate_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    try:
        import ipaddress
        ipobj = ipaddress.ip_address(ip)
        if isinstance(ipobj, ipaddress.IPv4Address):
            parts = ip.split(".")
            parts[-1] = "0"
            return ".".join(parts)
        if isinstance(ipobj, ipaddress.IPv6Address):
            hextets = ipobj.exploded.split(":")
            return ":".join(hextets[:4] + ["0000"] * 4)
    except Exception:
        return ip
    return ip

def _ua_major(ua: str) -> str:
    s = (ua or "").lower()
    if "chrome" in s and "safari" in s:
        fam = "chrome"
    elif "safari" in s and "chrome" not in s:
        fam = "safari"
    elif "firefox" in s:
        fam = "firefox"
    elif "edg" in s:
        fam = "edge"
    else:
        fam = "other"
    if "windows" in s:
        osf = "windows"
    elif "mac os x" in s or "macintosh" in s:
        osf = "mac"
    elif "android" in s:
        osf = "android"
    elif "iphone" in s or "ipad" in s or "ios" in s:
        osf = "ios"
    else:
        osf = "other"
    return f"{fam}/{osf}"

def _cookie_secret() -> bytes:
    s = os.getenv("THEMELAB_COOKIE_SECRET") or current_app.config.get("SECRET_KEY") or "change-me"
    return s.encode("utf-8")

def _fp_hmac(data: str) -> str:
    mac = hmac.new(_cookie_secret(), data.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode("ascii").rstrip("=")

def _fingerprint_for_bot(bot_id: str, ip_trunc: Optional[str], ua_major: str, lang: str) -> str:
    raw = "|".join([str(bot_id or ""), str(ip_trunc or ""), str(ua_major or ""), str(lang or ""), "fpv1"])
    return _fp_hmac(raw)

def _extract_client_hints(req) -> Dict[str, Any]:
    ua = (req.headers.get("User-Agent") or "")
    lang = (req.headers.get("Accept-Language") or "").split(",")[0].strip()
    ip = _first_public_ip(req)
    return {
        "ip": ip,
        "ip_trunc": _truncate_ip(ip),
        "user_agent": ua,
        "ua_major": _ua_major(ua),
        "accept_language": lang,
    }

def get_or_create_visitor(bot_id: str) -> Optional[Dict[str, Any]]:
    """
    Finds or creates a visitor based on (bot_id + truncated IP + UA major + lang) fingerprint.
    Now also captures optional pid from the request's query string (?pid=...).
    """
    try:
        pid_in = (request.args.get("pid") or "").strip()
        hints = _extract_client_hints(request)
        fp = _fingerprint_for_bot(bot_id, hints["ip_trunc"], hints["ua_major"], hints["accept_language"])
        r = (
            sb().table("visitors_v2")
            .select("id, bot_id, fingerprint, fp_ver, first_ip, last_ip, user_agent, accept_language, visit_count, created_at, last_seen_at, pid")
            .eq("bot_id", bot_id)
            .eq("fingerprint", fp)
            .limit(1)
            .execute()
        )
        row = (r.data or [])
        if row:
            v = row[0]
            patch = {
                "last_ip": hints["ip"],
                "user_agent": hints["user_agent"],
                "accept_language": hints["accept_language"],
                "last_seen_at": "now()",
            }
            # Only update pid if a new pid is provided and differs (do not erase existing)
            if pid_in and (v.get("pid") or "") != pid_in:
                patch["pid"] = pid_in
            try:
                sb().table("visitors_v2").update(patch).eq("id", v["id"]).execute()
            except Exception:
                pass
            v.update(patch)
            return v
        ins = {
            "bot_id": bot_id,
            "fingerprint": fp,
            "fp_ver": 1,
            "first_ip": hints["ip"],
            "last_ip": hints["ip"],
            "user_agent": hints["user_agent"],
            "accept_language": hints["accept_language"],
            "visit_count": 1,
        }
        if pid_in:
            ins["pid"] = pid_in
        cr = sb().table("visitors_v2").insert(ins).execute()
        created = (cr.data or [None])[0]
        return created
    except Exception as e:
        _log(f"[get_or_create_visitor] {e}")
        return None

def create_session(bot_id: str, visitor_id: str, entry: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    entry = entry or {}
    try:
        hints = _extract_client_hints(request)
        ins = {
            "bot_id": bot_id,
            "visitor_id": visitor_id,
            "entry_url": entry.get("entry_url"),
            "referrer": entry.get("referrer"),
            "entry_ip": hints["ip"],
            "entry_user_agent": hints["user_agent"],
            "utm": entry.get("utm") or None,
            "started_at": "now()",
            "event_count": 0,
            "context": {"recent_q": [], "last_item": None, "screen": "ask", "last_estimate": None, "updated_at": time.time()},
        }
        cr = sb().table("activity_sessions_v2").insert(ins).execute()
        return (cr.data or [None])[0]
    except Exception as e:
        _log(f"[create_session] {e}")
        return None

def _update_session_denorm(session_id: str, when_iso: Optional[str] = None):
    try:
        patch = {
            "event_count": sb().rpc("inc_session_event_count", {"p_session_id": session_id}).execute()
        }
    except Exception:
        patch = {}
    try:
        sb().table("activity_sessions_v2").update({
            "event_count": sb().table("activity_events_v2").select("id", count="exact").eq("session_id", session_id).execute().count,
            "last_event_at": "now()" if not when_iso else when_iso,
        }).eq("id", session_id).execute()
    except Exception:
        pass

def update_session_context(session_id: str, event_type: str, payload: Dict[str, Any]):
    try:
        r = sb().table("activity_sessions_v2").select("context").eq("id", session_id).limit(1).execute()
        ctx = ((r.data or [{}])[0].get("context") or {}) if r.data else {}
        if not isinstance(ctx, dict):
            ctx = {}
        recent_q = ctx.get("recent_q") or []
        screen = ctx.get("screen") or "ask"

        if event_type == "ask":
            q = (payload or {}).get("question") or ""
            if q:
                recent_q = (recent_q + [q])[-8:]
            screen = "ask"
            ctx["recent_q"] = recent_q
        elif event_type == "demo_open":
            ctx["last_item"] = {"type": "demo", "id": (payload or {}).get("demo_id"), "title": (payload or {}).get("title")}
            screen = "demo_view"
        elif event_type == "doc_open":
            ctx["last_item"] = {"type": "doc", "id": (payload or {}).get("doc_id"), "title": (payload or {}).get("title")}
            screen = "doc_view"
        elif event_type == "price_estimate":
            keep = {k: (payload or {}).get(k) for k in ["product_id", "tier_id", "total_min", "total_max"]}
            ctx["last_estimate"] = keep

        ctx["screen"] = screen
        ctx["updated_at"] = time.time()
        sb().table("activity_sessions_v2").update({"context": ctx}).eq("id", session_id).execute()
    except Exception as e:
        _log(f"[update_session_context] {e}")

def log_event(bot_id: str, session_id: str, visitor_id: str, event_type: str, payload: Optional[Dict[str, Any]] = None, client_event_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    payload = payload or {}
    try:
        hints = _extract_client_hints(request)
        ins = {
            "bot_id": bot_id,
            "visitor_id": visitor_id,
            "session_id": session_id,
            "event_type": event_type,
            "payload": payload,
            "ip": hints["ip"],
            "user_agent": hints["user_agent"],
            "client_event_id": client_event_id,
        }
        cr = sb().table("activity_events_v2").insert(ins).execute()
        row = (cr.data or [None])[0]
        try:
            update_session_context(session_id, event_type, payload)
        except Exception:
            pass
        try:
            _update_session_denorm(session_id)
        except Exception:
            pass
        return row
    except Exception as e:
        _log(f"[log_event] {e}")
        return None

# ---------------------------------------------------------------------
# Bot alias quick lookup
# ---------------------------------------------------------------------
@demo_hal_bp.get("/bot-by-alias")
def bot_by_alias():
    alias  = (request.args.get("alias")  or "").strip().lower()
    if not alias:
        return jsonify({"ok": False, "error": "alias_required"}), 400
    try:
        r = (
            sb().table("bots_v2")
            .select("id, alias, company_name, active")
            .eq("alias", alias).eq("active", True)
            .limit(1).execute()
        )
        rows = r.data or []
        if not rows:
            return jsonify({"ok": False, "error": "not_found"}), 404
        return jsonify({"ok": True, "bot": rows[0]})
    except Exception as e:
        _log(f"[bot_by_alias] {e}")
        return jsonify({"ok": False, "error": "server_error"}), 500

# ---------------------------------------------------------------------
# /demo-hal (Perspective-enabled)
# ---------------------------------------------------------------------
# Paste this function INTO your existing routes.py, replacing the existing /demo-hal handler.
# It adds legacy 'items' + 'buttons' arrays while preserving 'demo_buttons'/'doc_buttons'.
# Assumes all referenced helpers already exist in the file.

# --- PATCH: /demo-hal with explain=1 full technical report mode ---

def _hash_embedding(vec):
    try:
        # Hash the embedding vector for brevity in report
        if not vec or not isinstance(vec, list):
            return "none"
        b = bytearray()
        for f in vec[:32]:  # just the first 32 floats
            b.extend(bytearray(str(f), 'utf-8'))
        return hashlib.sha256(b).hexdigest()[:12]
    except Exception:
        return "err"

def _tokenize_for_report(s):
    s = (s or "").lower()
    out = []
    buf = []
    for ch in s:
        if ch.isalnum():
            buf.append(ch)
        else:
            if len(buf) >= 3:
                word = "".join(buf)
                if word not in STOPWORDS:
                    out.append(word)
                buf = []
    if len(buf) >= 3:
        word = "".join(buf)
        if word not in STOPWORDS:
            out.append(word)
    return sorted(set(out))

def build_explain_report(
    user_question, params, kb_hits, expanded, lexical_added,
    demos, demo_recs, doc_recs, system_text, kb_context, response_text,
    embedding_vec, perspective
):
    explain_md = []
    explain_md.append(f"# DemoHAL Technical Response Report")
    explain_md.append("")
    explain_md.append(f"### 1. User Question")
    explain_md.append(f"> {user_question}")
    explain_md.append("")
    explain_md.append(f"---\n### 2. Parameters Used")
    for k, v in params.items():
        explain_md.append(f"- {k}: **{v}**")
    explain_md.append("")
    explain_md.append("---")
    explain_md.append("### 3. Knowledge Base Retrieval")
    explain_md.append(f"**Embedding Hash:** `{_hash_embedding(embedding_vec)}`")
    explain_md.append("")
    explain_md.append("| KB ID | Title | Similarity | Snippet | Source |")
    explain_md.append("|-------|-------|-----------|---------|--------|")
    for h in kb_hits:
        explain_md.append(f"| {h.get('id','')} | {h.get('title','')[:36]} | {h.get('sim',0):.2f} | {str(h.get('content',''))[:40].replace('|','\\|')}... | semantic |")
    for h in expanded:
        explain_md.append(f"| {h.get('id','')} | {h.get('title','')[:36]} | {h.get('sim',0):.2f} | {str(h.get('content',''))[:40].replace('|','\\|')}... | expanded |")
    for h in lexical_added:
        explain_md.append(f"| {h.get('id','')} | {h.get('title','')[:36]} | {h.get('sim',0):.2f} | {str(h.get('content',''))[:40].replace('|','\\|')}... | lexical |")
    explain_md.append("")
    explain_md.append("---")
    explain_md.append("### 4. Recommendations Scoring")
    explain_md.append("| Type | Title | Overlap Tokens | Score | Selected? | Reason |")
    explain_md.append("|------|-------|---------------|-------|-----------|--------|")

    key_terms = set()
    for h in kb_hits:
        key_terms |= set(_tokenize_for_report(f"{h.get('title','')} {h.get('content','')}"))
    if not key_terms:
        key_terms = set(_tokenize_for_report(user_question))

    def score_item(item, selected_list):
        tokens = set(_tokenize_for_report(f"{item.get('title','')} {item.get('description','')}"))
        overlap = sorted(tokens & key_terms)
        score = len(overlap)
        selected = item in selected_list
        reason = "Overlap with KB hits/question" if score > 0 else "No relevant overlap"
        return {
            "type": "Demo" if item in demos else "Doc",
            "title": item.get("title", "")[:36],
            "overlap": overlap,
            "score": score,
            "selected": selected,
            "reason": reason
        }

    # Combine both demos and docs in one table
    all_items = list(demos) + list(doc_recs)
    for item in all_items:
        s = score_item(item, demo_recs + doc_recs)
        explain_md.append(
            f"| {s['type']} | {s['title']} | {', '.join(s['overlap'])} | {s['score']} | {'Yes' if s['selected'] else 'No'} | {s['reason']} |"
        )

    explain_md.append("")
    explain_md.append("---")
    explain_md.append("### 5. Prompt Sent to Model")
    explain_md.append("**System Prompt:**")
    explain_md.append("```")
    explain_md.append(system_text)
    explain_md.append("```")
    explain_md.append("")
    explain_md.append("**KB Context:**")
    explain_md.append("```")
    explain_md.append(kb_context)
    explain_md.append("```")
    explain_md.append("")
    explain_md.append(f"**User Prompt:**\n> {user_question}")
    explain_md.append("")
    explain_md.append("---")
    explain_md.append("### 6. LLM Model Output")
    explain_md.append(f"**Model:** {params.get('model','gpt-4o')}")
    explain_md.append(f"**Temperature:** {params.get('temperature',0.2)}")
    explain_md.append("**Output:**")
    explain_md.append(f"> {response_text}")
    explain_md.append("")
    explain_md.append("---")
    explain_md.append("### 7. Summary")
    explain_md.append("The system picked these demos and documents because their titles and descriptions contain keywords that matched both your question and the most relevant knowledge base articles. The answer was generated using only the selected articles, following the perspective you specified.")
    return "\n".join(explain_md)

# --- REPLACEMENT: /demo-hal route with improved language detection (accepting valid short questions) ---

import re
from langdetect import detect, DetectorFactory, LangDetectException
DetectorFactory.seed = 0  # For consistent results

def _is_nonsensical(text):
    # True if: no alphabetic chars, or only one very short word, or all non-word
    if not text or not any(c.isalpha() for c in text):
        return True
    words = re.findall(r'\b[a-zA-Z]{2,}\b', text)
    if len(words) == 0:
        return True
    if len(words) == 1 and len(words[0]) < 4:
        return True
    # Accept common short questions like "Who are you?", "What is X?", etc.
    return False

def _detect_language(text):
    try:
        if _is_nonsensical(text):
            return ("en", 0.0)
        text_stripped = text.strip().lower()
        # Romance language hacks:
        # 1. Explicit Spanish question marks
        if text_stripped.startswith("¿") or "qué hace" in text_stripped:
            return ("es", 1.0)
        # 2. French pattern
        if re.search(r"que fait", text_stripped):
            return ("fr", 1.0)
        # 3. Portuguese: "o que faz", "o que é"
        if re.search(r"o que (faz|é)", text_stripped):
            return ("pt", 1.0)
        # 4. Italian: "cosa fa", "che cosa fa"
        if re.search(r"(cosa fa|che cosa fa)", text_stripped):
            return ("it", 1.0)
        lang = detect(text)
        l = len(text_stripped)
        word_count = len(re.findall(r'\w+', text_stripped))
        if word_count >= 2 or l >= 12:
            return (lang, 0.9)
        return (lang, 0.7)
    except LangDetectException:
        return ("en", 0.0)
    except Exception:
        return ("en", 0.0)

@demo_hal_bp.route("/demo-hal", methods=["POST", "OPTIONS"])
def demo_hal():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    try:
        body = request.get_json(force=True, silent=True) or {}
        bot_id        = (body.get("bot_id") or "").strip() or (g.forced_bot_id or "")
        user_question = (body.get("user_question") or body.get("question") or "").strip()
        session_id    = (body.get("session_id") or request.headers.get("X-Session-Id") or "").strip()
        visitor_id    = (body.get("visitor_id") or request.headers.get("X-Visitor-Id") or "").strip()
        explain_param = (
            (request.args.get("explain") == "1") or
            (body.get("explain") in ("1", 1, "true", True))
        )
        themelab_param = (
            (request.args.get("themelab") == "1") or
            (body.get("themelab") in ("1", 1, "true", True))
        )

        if not bot_id or not user_question:
            return _corsify(jsonify({"ok": False, "error": "missing_params"})), 400

        top_k          = int(body.get("top_k") or 12)
        min_score      = float(body.get("min_relevance_score") or 0.70)
        temperature    = float(body.get("temperature") or 0.20)
        top_p          = float(body.get("top_p") or 0.90)
        presence_pen   = float(body.get("presence_penalty") or 0.20)
        frequency_pen  = float(body.get("frequency_penalty") or 0.10)
        max_out_tokens = int(body.get("max_output_tokens") or 700)
        rec_cap        = int(body.get("max_recommendations") or 6)
        model_name     = CHAT_MODEL

        perspective = _infer_perspective(bot_id, session_id, visitor_id, body)
        if session_id:
            _persist_session_perspective(session_id, perspective)

        client_name = _fetch_client_name_for_bot(bot_id)
        demos = _fetch_all_demos(bot_id)
        docs  = _fetch_all_documents(bot_id)

        # Improved Language detection (allows valid short questions)
        lang_code, lang_conf = _detect_language(user_question)
        # Only allow high confidence, non-English triggers.
        answer_in_lang = (
            lang_code != "en"
            and lang_conf >= 0.8
            and lang_code in {"es", "fr", "de", "it", "pt", "nl", "pl", "ru", "zh-cn", "zh-tw", "ko", "ja"}
        )

        # Retrieval
        q_vec    = _embed(user_question)
        primary  = _kb_retrieve(bot_id, q_vec, top_k=top_k, min_score=min_score)
        relaxed  = []
        if len(primary) < max(2, top_k // 3):
            relaxed = _kb_retrieve(bot_id, q_vec, top_k=top_k, min_score=min_score * 0.85)

        merged, seen = [], set()
        for grp in (primary, relaxed):
            for h in grp:
                if h["id"] not in seen:
                    merged.append(h)
                    seen.add(h["id"])

        if 0 < len(merged) < max(3, top_k // 2):
            expanded = _expand_if_low_coverage(bot_id, merged, user_question, target=top_k)
            for h in expanded:
                if h["id"] not in seen:
                    merged.append(h)
                    seen.add(h["id"])
        else:
            expanded = []

        if len(merged) == 0:
            lexical_added = _keyword_fallback(bot_id, user_question, limit=top_k)
            for h in lexical_added:
                if h["id"] not in seen:
                    merged.append(h)
                    seen.add(h["id"])
        else:
            lexical_added = []

        kb_hits = merged[:top_k]
        no_kb = len(kb_hits) == 0

        kb_context = "\n\n".join(
            f"[{i+1}] {h.get('title','')}\n{h.get('content','')}" for i, h in enumerate(kb_hits)
        )

        directive = PERSPECTIVE_PROMPTS.get(perspective, PERSPECTIVE_PROMPTS["general"])
        system_text = f"""
You are a Sales Assistant for {client_name}.
Perspective directive: {directive}

Use ONLY the KB context provided. If the needed information is missing, answer the best you can and recommend that if they need further details, they should schedule a meeting with our product expert.
Answer-first, with as much detail as you have. Your answer should contain mostly prose with bullet points used sparingly for clarity. No more than three sentences per paragraph. Do NOT mention demos or documents directly in your answer.
Remain positive about {client_name}. Never fabricate details not in the KB context.
""".strip()

        # Append language directive to system prompt if high confidence non-English detected
        if answer_in_lang:
            system_text += f"\n\nAnswer in {lang_code} (the language in which the question was asked)."

        po_in = body.get("prompt_override")
        if isinstance(po_in, str) and po_in.strip():
            system_text = f"{po_in.strip()}\n\n{system_text}"

        if no_kb:
            response_text = "I don’t have enough information to answer that. Feel free to clarify or ask about another topic."
        else:
            messages = [
                {"role": "system", "content": system_text},
                {"role": "user", "content": f"User question:\n{user_question}\n\nKB context:\n{kb_context}\n"},
            ]
            try:
                resp = _oa.chat.completions.create(
                    model=model_name,
                    temperature=temperature,
                    top_p=top_p,
                    presence_penalty=presence_pen,
                    frequency_penalty=frequency_pen,
                    max_tokens=max_out_tokens,
                    messages=messages,
                )
                response_text = (resp.choices[0].message.content or "").strip()
            except Exception as e:
                _log(f"[/demo-hal:model] {e}")
                response_text = "I encountered an issue generating a response. Please try again."

        # Recommendations
        demo_recs, doc_recs = _select_recommendations(demos, docs, kb_hits, limit=rec_cap)

        def _demo_btn(d):
            t = d.get("title") or ""
            return {
                "id": d.get("id"),
                "action": "demo",
                "button_action": "demo",
                "title": t,
                "button_title": t,
                "label": f'Watch the "{t}" demo',
                "button_label": f'Watch the "{t}" demo',
                "summary": d.get("description") or "",
                "description": d.get("description") or "",
                "value": d.get("url") or "",
                "button_value": d.get("url") or "",
            }

        def _doc_btn(d):
            t = d.get("title") or ""
            return {
                "id": d.get("id"),
                "action": "doc",
                "button_action": "doc",
                "title": t,
                "button_title": t,
                "label": f'View the "{t}" document',
                "button_label": f'View the "{t}" document',
                "summary": d.get("description") or "",
                "description": d.get("description") or "",
                "value": d.get("url") or "",
                "button_value": d.get("url") or "",
            }

        demo_buttons = [_demo_btn(x) for x in demo_recs]
        doc_buttons  = [_doc_btn(x) for x in doc_recs]

        # Legacy combined arrays for backward compatibility
        legacy_buttons = demo_buttons + doc_buttons
        legacy_items   = legacy_buttons  # same shape for FE expecting 'items'
              
        # Logging (best effort)
        try:
            if bot_id and (not session_id or not visitor_id):
                v = get_or_create_visitor(bot_id)
                if v and v.get("id"):
                    visitor_id = visitor_id or str(v["id"])
                    try:
                        sr = (
                            sb().table("activity_sessions_v2")
                            .select("id,last_event_at,started_at,ended_at")
                            .eq("bot_id", bot_id)
                            .eq("visitor_id", v["id"])
                            .is_("ended_at", None)
                            .order("started_at", desc=True)
                            .limit(1).execute()
                        )
                        cand = (sr.data or [])
                        if cand:
                            ref = cand[0].get("last_event_at") or cand[0].get("started_at")
                            dt = datetime.fromisoformat(ref.replace("Z","+00:00")) if isinstance(ref,str) else None
                            if not dt or (datetime.now(timezone.utc) - dt) <= timedelta(minutes=30):
                                session_id = session_id or str(cand[0]["id"])
                    except Exception:
                        pass
            if bot_id and session_id and visitor_id:
                log_event(
                    bot_id=bot_id,
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="ask",
                    payload={
                        "question": user_question,
                        "answer_text": response_text,
                        "kb_hit_ids": [h.get("id") for h in kb_hits],
                        "demo_ids": [d.get("id") for d in demo_recs],
                        "doc_ids":  [d.get("id") for d in doc_recs],
                        "perspective": perspective,
                        "no_kb": no_kb,
                        "retrieval_counts": {
                            "final_hits": len(kb_hits),
                            "top_k": top_k,
                            "expanded_added": len(expanded),
                            "lexical_added": len(lexical_added),
                        },
                        "language_detected": lang_code,
                        "lang_confidence": lang_conf,
                        "language_prompted": answer_in_lang,
                    },
                )
        except Exception as e:
            _log(f"[/demo-hal.log_event] {e}")

        # --- EXPLAIN MODE ---
        result = {
            "ok": True,
            "response_text": response_text,
            "demo_buttons": demo_buttons,
            "doc_buttons": doc_buttons,
            "buttons": legacy_buttons,   # legacy
            "items": legacy_items,       # legacy
            "perspective": perspective,
            "no_kb": no_kb,
            "language_detected": lang_code,
            "lang_confidence": lang_conf,
            "language_prompted": answer_in_lang,
        }

        # --- Add recommended_items array for FE ---
        result["recommended_items"] = (
            [ {"type": "demo", **_demo_btn(x), "action": "demo"} for x in demo_recs ] +
            [ {"type": "doc",  **_doc_btn(x),  "action": "doc"}  for x in doc_recs ]
        )
        
        if explain_param:
            params_for_report = {
                "top_k": top_k,
                "min_score": min_score,
                "temperature": temperature,
                "top_p": top_p,
                "presence_penalty": presence_pen,
                "frequency_penalty": frequency_pen,
                "max_output_tokens": max_out_tokens,
                "rec_cap": rec_cap,
                "perspective": perspective,
                "model": model_name,
                "language_detected": lang_code,
                "lang_confidence": lang_conf,
                "language_prompted": answer_in_lang,
            }
            explain_md = build_explain_report(
                user_question=user_question,
                params=params_for_report,
                kb_hits=kb_hits,
                expanded=expanded,
                lexical_added=lexical_added,
                demos=demos,
                demo_recs=demo_recs,
                doc_recs=doc_recs,
                system_text=system_text,
                kb_context=kb_context,
                response_text=response_text,
                embedding_vec=q_vec,
                perspective=perspective
            )
            result["report_markdown"] = explain_md

        if themelab_param:
            result["options"] = {
                "show_browse_demos": bool(body.get("show_browse_demos", True)),
                "show_browse_docs": bool(body.get("show_browse_docs", True)),
                "show_price_estimate": bool(body.get("show_price_estimate", True)),
                "show_schedule_meeting": bool(body.get("show_schedule_meeting", True)),
                "show_intro_video": bool(body.get("show_intro_video", True)),
                "show_formfill": bool(body.get("show_formfill", True)),
                "intro_video_url": body.get("intro_video_url", ""),
            }
            result["messages"] = {
                "welcome_message": body.get("welcome_message", ""),
                "formfill_intro": body.get("formfill_intro", ""),
                "pricing_intro": body.get("pricing_intro", ""),
                "pricing_outro": body.get("pricing_outro", ""),
                "pricing_custom_notice": body.get("pricing_custom_notice", ""),
            }
            result["standard_fields"] = body.get("standard_fields", [])

        return _corsify(jsonify(result)), 200

    except Exception as e:
        _log(f"[/demo-hal] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

# ---------------------------------------------------------------------
# Browse APIs & other endpoints (unchanged except they now co-exist with perspective system)
# ---------------------------------------------------------------------
@demo_hal_bp.route("/browse-demos", methods=["GET", "OPTIONS"])
def browse_demos():
    # (UNCHANGED)
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    try:
        alias      = (request.args.get("alias") or "").strip()
        bot_id_in  = (request.args.get("bot_id") or "").strip()
        session_id = (request.args.get("session_id") or request.headers.get("X-Session-Id") or "").strip()
        visitor_id = (request.args.get("visitor_id") or request.headers.get("X-Visitor-Id") or "").strip()
        bot_id = None
        if bot_id_in:
            bot_id = bot_id_in
        elif alias:
            try:
                br = (
                    sb().table("bots_v2")
                    .select("id,active")
                    .eq("alias", alias)
                    .eq("active", True)
                    .limit(1)
                    .execute()
                )
                botrow = (br.data or [])
                if botrow:
                    bot_id = str(botrow[0]["id"])
            except Exception as e:
                _log(f"[/browse-demos.resolve_bot] {e}")
        if not bot_id:
            return _corsify(jsonify({"ok": False, "error": "bot_not_found"})), 404
        r = (
            sb().table("demos_v2")
            .select("id,title,description,url,active,topic")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .order("title", desc=False)
            .execute()
        )
        rows = r.data or []
        demos = [
            {
                "id": d.get("id"),
                "title": d.get("title"),
                "description": d.get("description"),
                "url": d.get("url"),
                "active": d.get("active"),
                "topic": d.get("topic"),
            }
            for d in (rows or [])
        ]
        def _to_item(d):
            return {
                "id": d.get("id"),
                "action": "demo",
                "button_action": "demo",
                "title": d.get("title"),
                "button_title": d.get("title"),
                "label": f"Watch the \"{d.get('title')}\" demo",
                "button_label": f"Watch the \"{d.get('title')}\" demo",
                "summary": d.get("description") or "",
                "description": d.get("description") or "",
                "value": d.get("url") or "",
                "button_value": d.get("url") or "",
                "topic": d.get("topic") or "",
            }
        items = [_to_item(d) for d in demos]
        try:
            if bot_id and (not session_id or not visitor_id):
                v = get_or_create_visitor(bot_id)
                if v and v.get("id"):
                    visitor_id = visitor_id or str(v["id"])
                    try:
                        sr = (
                            sb().table("activity_sessions_v2")
                            .select("id, last_event_at, started_at, ended_at")
                            .eq("bot_id", bot_id)
                            .eq("visitor_id", v["id"])
                            .is_("ended_at", None)
                            .order("started_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                        cand = (sr.data or [])
                        if cand:
                            from datetime import datetime, timezone, timedelta
                            ref_time = cand[0].get("last_event_at") or cand[0].get("started_at")
                            dt = datetime.fromisoformat(ref_time.replace("Z", "+00:00")) if isinstance(ref_time, str) else None
                            if dt and (datetime.now(timezone.utc) - dt) <= timedelta(minutes=30):
                                session_id = session_id or str(cand[0]["id"])
                    except Exception:
                        pass
            if bot_id and session_id and visitor_id:
                log_event(
                    bot_id=bot_id,
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="browse_demos",
                    payload={"count": len(demos)},
                )
        except Exception as e:
            _log(f"[/browse-demos.log_event] {e}")
        return _corsify(jsonify({"ok": True, "demos": demos, "items": items})), 200
    except Exception as e:
        _log(f"[/browse-demos] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

@demo_hal_bp.route("/browse-docs", methods=["GET", "OPTIONS"])
def browse_docs():
    # (UNCHANGED)
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    try:
        alias      = (request.args.get("alias") or "").strip()
        bot_id_in  = (request.args.get("bot_id") or "").strip()
        session_id = (request.args.get("session_id") or request.headers.get("X-Session-Id") or "").strip()
        visitor_id = (request.args.get("visitor_id") or request.headers.get("X-Visitor-Id") or "").strip()
        bot_id = None
        if bot_id_in:
            bot_id = bot_id_in
        elif alias:
            try:
                br = (
                    sb().table("bots_v2")
                    .select("id,active")
                    .eq("alias", alias)
                    .eq("active", True)
                    .limit(1)
                    .execute()
                )
                botrow = (br.data or [])
                if botrow:
                    bot_id = str(botrow[0]["id"])
            except Exception as e:
                _log(f"[/browse-docs.resolve_bot] {e}")
        if not bot_id:
            return _corsify(jsonify({"ok": False, "error": "bot_not_found"})), 404
        r = (
            sb().table("documents_v2")
            .select("id,title,description,url,active,topic")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .order("title", desc=False)
            .execute()
        )
        rows = r.data or []
        docs = [
            {
                "id": d.get("id"),
                "title": d.get("title"),
                "description": d.get("description"),
                "url": d.get("url"),
                "active": d.get("active"),
                "topic": d.get("topic"),
            }
            for d in (rows or [])
        ]
        def _to_item(d):
            return {
                "id": d.get("id"),
                "action": "doc",
                "button_action": "doc",
                "title": d.get("title"),
                "button_title": d.get("title"),
                "label": f"View the \"{d.get('title')}\" document",
                "button_label": f"View the \"{d.get('title')}\" document",
                "summary": d.get("description") or "",
                "description": d.get("description") or "",
                "value": d.get("url") or "",
                "button_value": d.get("url") or "",
                "topic": d.get("topic") or "",
            }
        items = [_to_item(d) for d in docs]
        try:
            if bot_id and session_id and visitor_id:
                log_event(
                    bot_id=bot_id,
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="browse_docs",
                    payload={"count": len(docs)},
                )
        except Exception as e:
            _log(f"[/browse-docs.log_event] {e}")
        return _corsify(jsonify({"ok": True, "docs": docs, "items": items})), 200
    except Exception as e:
        _log(f"[/browse-docs] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

@demo_hal_bp.route("/render-video-iframe", methods=["POST", "OPTIONS"])
def render_video_iframe():
    # (UNCHANGED)
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    try:
        body = request.get_json(force=True, silent=True) or {}
        bot_id  = (body.get("bot_id") or "").strip()
        alias   = (body.get("alias") or request.args.get("alias") or "").strip()
        if not bot_id and alias:
            try:
                br = (
                    sb().table("bots_v2")
                    .select("id,active")
                    .eq("alias", alias)
                    .eq("active", True)
                    .limit(1)
                    .execute()
                )
                rows = br.data or []
                if rows:
                    bot_id = str(rows[0]["id"])
            except Exception as e:
                _log(f"[/render-video-iframe.resolve_bot] {e}")
        session_id = (body.get("session_id") or request.headers.get("X-Session-Id") or "").strip()
        visitor_id = (body.get("visitor_id") or request.headers.get("X-Visitor-Id") or "").strip()
        item    = body.get("item") or {}
        demo_id = ((body.get("demo_id") or "") or (body.get("id") or "") or (item.get("id") or "")).strip()
        title = ((body.get("title") or "") or (item.get("title") or "") or "Demo").strip()
        url = (
            (body.get("video_url") or "") or
            (body.get("url") or "") or
            (body.get("value") or "") or
            (body.get("button_value") or "") or
            (item.get("url") or "") or
            (item.get("value") or "") or
            (item.get("button_value") or "")
        ).strip()
        if not url and bot_id and demo_id:
            try:
                r = (
                    sb().table("demos_v2")
                    .select("id,title,description,url,active")
                    .eq("bot_id", bot_id)
                    .eq("id", demo_id)
                    .eq("active", True)
                    .limit(1)
                    .execute()
                )
                rows = r.data or []
                if rows:
                    row = rows[0]
                    title = row.get("title") or title
                    url   = row.get("url") or url
            except Exception as e:
                _log(f"[/render-video-iframe.fetch_demo] {e}")
        if not url:
            return _corsify(jsonify({"ok": False, "error": "missing_demo_url"})), 400
        iframe_html = (
            f'<iframe src="{url}" '
            'width="100%" height="480" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" '
            'referrerpolicy="no-referrer-when-downgrade"></iframe>'
        )
        try:
            if bot_id and (not session_id or not visitor_id):
                v = get_or_create_visitor(bot_id)
                if v and v.get("id"):
                    visitor_id = visitor_id or str(v["id"])
                    try:
                        sr = (
                            sb().table("activity_sessions_v2")
                            .select("id,last_event_at,started_at,ended_at")
                            .eq("bot_id", bot_id)
                            .eq("visitor_id", v["id"])
                            .is_("ended_at", None)
                            .order("started_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                        cand = (sr.data or [])
                        if cand:
                            from datetime import datetime, timezone, timedelta
                            ref_time = cand[0].get("last_event_at") or cand[0].get("started_at")
                            dt = datetime.fromisoformat(ref_time.replace("Z", "+00:00")) if isinstance(ref_time, str) else None
                            if dt and (datetime.now(timezone.utc) - dt) <= timedelta(minutes=30):
                                session_id = session_id or str(cand[0]["id"])
                    except Exception:
                        pass
            if bot_id and session_id and visitor_id:
                log_event(
                    bot_id=bot_id,
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="demo_open",
                    payload={"demo_id": demo_id or None, "title": title, "url": url},
                )
        except Exception as e:
            _log(f"[/render-video-iframe.log_event] {e}")
        return _corsify(jsonify({"ok": True, "video_url": url, "iframe_html": iframe_html})), 200
    except Exception as e:
        _log(f"[/render-video-iframe] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

@demo_hal_bp.post("/all-demos")
def all_demos():
    try:
        data = request.get_json(silent=True) or {}
        bot_id = (data.get("bot_id") or "").strip()
        if not bot_id:
            return jsonify({"error": "Missing bot_id"}), 400
        demos = _fetch_all_demos(bot_id)
        items = [_to_demo_item(d) for d in demos if d.get("id") and d.get("url")]
        buttons = [_to_demo_button(it) for it in items]
        return jsonify({"type": "demo_list", "buttons": buttons})
    except Exception as e:
        return jsonify({"error": "Failed to retrieve demos", "details": str(e)}), 500

@demo_hal_bp.post("/all-docs")
def all_docs():
    try:
        data = request.get_json(silent=True) or {}
        bot_id = (data.get("bot_id") or "").strip()
        if not bot_id:
            return jsonify({"error": "Missing bot_id"}), 400
        docs = _fetch_all_documents(bot_id)
        items = [_to_doc_item(d) for d in docs if d.get("id") and d.get("url")]
        buttons = [_to_doc_button(it) for it in items]
        return jsonify({"type": "doc_list", "buttons": buttons})
    except Exception as e:
        return jsonify({"error": "Failed to retrieve documents", "details": str(e)}), 500

@demo_hal_bp.route("/render-doc-iframe", methods=["POST", "OPTIONS"])
def render_doc_iframe():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    try:
        body = request.get_json(force=True, silent=True) or {}
        bot_id     = (body.get("bot_id") or "").strip()
        doc_id     = (body.get("doc_id") or "").strip()
        doc_url    = (body.get("url") or "").strip()
        session_id = (body.get("session_id") or "").strip()
        visitor_id = (body.get("visitor_id") or "").strip()
        doc_row = None
        if bot_id and doc_id:
            try:
                r = (
                    sb().table("documents_v2")
                    .select("id,title,description,url,active")
                    .eq("bot_id", bot_id)
                    .eq("id", doc_id)
                    .eq("active", True)
                    .limit(1)
                    .execute()
                )
                rows = r.data or []
                doc_row = rows[0] if rows else None
            except Exception as e:
                _log(f"[/render-doc-iframe:fetch_doc] {e}")
        title = (doc_row or {}).get("title") or (body.get("title") or "Document")
        url   = (doc_row or {}).get("url") or doc_url
        if not url:
            return _corsify(jsonify({"ok": False, "error": "missing_doc_url"})), 400
        iframe_html = (
            f'<iframe src="{url}" '
            'width="100%" height="720" frameborder="0" allow="fullscreen" '
            'referrerpolicy="no-referrer-when-downgrade"></iframe>'
        )
        try:
            if bot_id and session_id and visitor_id:
                log_event(
                    bot_id=bot_id,
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="doc_open",
                    payload={"doc_id": doc_id or None, "title": title, "url": url},
                )
        except Exception as e:
            _log(f"[/render-doc-iframe.log_event] {e}")
        return _corsify(jsonify({"ok": True, "iframe_html": iframe_html})), 200
    except Exception as e:
        _log(f"[/render-doc-iframe] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

# -----------------------------------------------------------------------------
# Additional endpoints (pricing, agent, calendly) remain unchanged
# -----------------------------------------------------------------------------
_YT_RE = re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{6,})")
def _extract_youtube_id(url: str) -> Optional[str]:
    if not url:
        return None
    m = _YT_RE.search(url)
    return m.group(1) if m else None

# Pricing endpoints unchanged (except they coexist with perspective logic) ...

# (Pricing code omitted here for brevity in comment; it remains as previously provided)
# --- The pricing section from the user's provided file remains unmodified below ---

# =====================================================================
# Pricing — (unchanged relative to previous patch) 
# =====================================================================

def _normalize_pricing_answers(payload: Dict[str, Any]) -> Dict[str, Optional[str]]:
    product_id = None
    tier_id = None
    ans = payload.get("answers")
    if isinstance(ans, dict):
        product_id = (ans.get("product_id") or ans.get("edition") or ans.get("product") or "").strip() or None
        tier_id    = (ans.get("tier_id")    or ans.get("transactions") or ans.get("tier") or "").strip() or None
        return {"product_id": product_id, "tier_id": tier_id}
    if isinstance(ans, list) and len(ans) >= 1:
        a0 = ans[0] or {}
        product_id = (a0.get("answer_value") or a0.get("value") or a0.get("id") or "").strip() or None
        if len(ans) >= 2:
            a1 = ans[1] or {}
            tier_id = (a1.get("answer_value") or a1.get("value") or a1.get("id") or "").strip() or None
        return {"product_id": product_id, "tier_id": tier_id}
    return {"product_id": None, "tier_id": None}

def _get_baseline_products(bot_id: str) -> List[Dict[str, Any]]:
    try:
        r = (
            sb()
            .table("price_products_v2")
            .select("id,label,description,is_included")
            .eq("bot_id", bot_id)
            .eq("is_included", True)
            .order("label", desc=False)
            .execute()
        )
        return r.data or []
    except Exception as e:
        _log(f"[_get_baseline_products] {e}")
        return []

def _get_product_by_id(bot_id: str, product_id: str) -> Optional[Dict[str, Any]]:
    if not product_id:
        return None
    try:
        r = (
            sb()
            .table("price_products_v2")
            .select("id,label,description,is_included")
            .eq("bot_id", bot_id)
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        rows = r.data or []
        return rows[0] if rows else None
    except Exception as e:
        _log(f"[_get_product_by_id] {e}")
        return None

def _get_tier_by_id(bot_id: str, tier_id: str) -> Optional[Dict[str, Any]]:
    if not tier_id:
        return None
    try:
        r = (
            sb()
            .table("price_tiers_v2")
            .select("id,label,is_custom")
            .eq("bot_id", bot_id)
            .eq("id", tier_id)
            .limit(1)
            .execute()
        )
        rows = r.data or []
        return rows[0] if rows else None
    except Exception as e:
        _log(f"[_get_tier_by_id] {e}")
        return None

def _get_matrix_row(product_id: str, tier_id: str) -> Dict[str, Any]:
    try:
        r = (
            sb()
            .table("price_matrix_v2")
            .select("currency_code,price_min,price_max")
            .eq("product_id", product_id)
            .eq("tier_id", tier_id)
            .limit(1)
            .execute()
        )
        row = (r.data or [{}])[0]
        if row:
            return {
                "currency_code": row.get("currency_code") or "USD",
                "price_min": row.get("price_min") if row.get("price_min") is not None else 0.0,
                "price_max": row.get("price_max") if row.get("price_max") is not None else 0.0,
            }
    except Exception as e:
        _log(f"[_get_matrix_row] {e}")
    return {"currency_code": "USD", "price_min": 0.0, "price_max": 0.0}

@demo_hal_bp.get("/pricing/questions")
def pricing_questions():
    # (UNCHANGED from provided file)
    try:
        alias    = (request.args.get("alias") or "").strip()
        bot_id_q = (request.args.get("bot_id") or "").strip()
        bot_row = None
        if bot_id_q:
            r = (
                sb().table("bots_v2")
                .select("id,active")
                .eq("id", bot_id_q)
                .eq("active", True)
                .limit(1)
                .execute()
            )
            bot_row = (r.data or [None])[0]
        elif alias:
            r = (
                sb().table("bots_v2")
                .select("id,active")
                .eq("alias", alias)
                .eq("active", True)
                .limit(1)
                .execute()
            )
            bot_row = (r.data or [None])[0]
        if not bot_row:
            return jsonify({"ok": False, "error": "bot_not_found"}), 404
        bot_id = str(bot_row["id"])
        try:
            pr = (
                sb().table("price_products_v2")
                .select("id,label,is_included")
                .eq("bot_id", bot_id)
                .order("label", desc=False)
                .execute()
            )
            products = pr.data or []
        except Exception as e:
            _log(f"[pricing_questions:v2 products] {e}")
            products = []
        product_options = [
            {"id": str(p["id"]), "label": p.get("label") or ""}
            for p in products if p.get("id")
        ]
        any_not_included = any(not bool(p.get("is_included")) for p in products)
        all_included = (len(products) > 0) and not any_not_included
        def _fetch_tiers():
            try:
                tr = (
                    sb().table("price_tiers_v2")
                    .select("id,label,min_inclusive")
                    .eq("bot_id", bot_id)
                    .order("min_inclusive", desc=False)
                    .execute()
                )
                return tr.data or []
            except Exception as e:
                _log(f"[pricing_questions:v2 tiers:min_inclusive missing -> fallback label] {e}")
                try:
                    tr = (
                        sb().table("price_tiers_v2")
                        .select("id,label,min_inclusive")
                        .eq("bot_id", bot_id)
                        .order("label", desc=False)
                        .execute()
                    )
                    return tr.data or []
                except Exception as e2:
                    _log(f"[pricing_questions:v2 tiers fallback failed] {e2}")
                    return []
        tiers = _fetch_tiers()
        tier_options = [
            {"id": str(t["id"]), "label": t.get("label") or ""}
            for t in tiers if t.get("id")
        ]
        try:
            copy_r = (
                sb().table("bots_v2")
                .select("pricing_intro,pricing_outro,pricing_custom_notice")
                .eq("id", bot_id).limit(1).execute()
            )
            copy_row = (copy_r.data or [{}])[0]
        except Exception as e:
            _log(f"[pricing_questions:v2 copy] {e}")
            copy_row = {}
        pricing_intro = copy_row.get("pricing_intro") or ""
        pricing_outro = copy_row.get("pricing_outro") or ""
        pricing_custom_notice = copy_row.get("pricing_custom_notice") or ""
        qdefs = []
        try:
            qd = (
                sb().table("price_questions_v2")
                .select("id,prompt,mirror_template,sort_order")
                .eq("bot_id", bot_id)
                .order("sort_order", desc=False)
                .limit(2)
                .execute()
            )
            qdefs = qd.data or []
        except Exception as e:
            _log(f"[pricing_questions:v2 qdefs sort_order missing] {e}")
            try:
                qd = (
                    sb().table("price_questions_v2")
                    .select("id,prompt,mirror_template")
                    .eq("bot_id", bot_id)
                    .limit(2)
                    .execute()
                )
                qdefs = qd.data or []
            except Exception as e2:
                _log(f"[pricing_questions:v2 qdefs fallback failed] {e2}")
                qdefs = []
        default_product_prompt = "Choose a product"
        default_tier_prompt = "Choose a tier"
        product_q_def = qdefs[0] if qdefs else None
        tier_q_def = qdefs[1] if len(qdefs) > 1 else (qdefs[0] if qdefs else None)
        product_prompt = (product_q_def or {}).get("prompt") or default_product_prompt
        tier_prompt = (tier_q_def or {}).get("prompt") or default_tier_prompt
        product_mirror = (product_q_def or {}).get("mirror_template") or ""
        tier_mirror = (tier_q_def or {}).get("mirror_template") or ""
        questions = []
        if all_included:
            questions.append({
                "id": "q_tier",
                "q_key": "tier",
                "type": "single_select",
                "prompt": tier_prompt,
                "help_text": None,
                "required": True,
                "options": tier_options,
                "mirror_template": tier_mirror,
            })
        else:
            questions.append({
                "id": "q_product",
                "q_key": "product",
                "type": "single_select",
                "prompt": product_prompt,
                "help_text": None,
                "required": True,
                "options": product_options,
                "mirror_template": product_mirror,
            })
            questions.append({
                "id": "q_tier",
                "q_key": "tier",
                "type": "single_select",
                "prompt": tier_prompt,
                "help_text": None,
                "required": True,
                "options": tier_options,
                "mirror_template": tier_mirror,
            })
        return jsonify({
            "ok": True,
            "bot_id": bot_id,
            "pricing_intro": pricing_intro,
            "pricing_outro": pricing_outro,
            "pricing_custom_notice": pricing_custom_notice,
            "questions": questions,
        }), 200
    except Exception as e:
        _log(f"[pricing_questions:v2 fatal] {e}")
        return jsonify({"ok": False, "error": "server_error"}), 500

@demo_hal_bp.post("/pricing/estimate")
def pricing_estimate():
    # (UNCHANGED)
    try:
        payload    = request.get_json(force=True, silent=True) or {}
        bot_id     = (payload.get("bot_id") or "").strip()
        session_id = (payload.get("session_id") or "").strip()
        visitor_id = (payload.get("visitor_id") or "").strip()
        if not bot_id:
            return jsonify({"ok": False, "error": "bot_id_required"}), 400
        sel = _normalize_pricing_answers(payload)
        product_id = sel.get("product_id")
        tier_id    = sel.get("tier_id")
        tier_row = _get_tier_by_id(bot_id, tier_id) if tier_id else None
        if not tier_row:
            return jsonify({"ok": False, "error": "tier_id_required"}), 400
        if bool(tier_row.get("is_custom")):
            try:
                qr = (
                    sb().table("price_questions_v2")
                    .select("id,mirror_template")
                    .eq("bot_id", bot_id)
                    .order("sort_order", desc=False)
                    .limit(2)
                    .execute()
                )
                qrows = qr.data or []
            except Exception as e:
                _log(f"[pricing_estimate:mirror:custom] {e}")
                qrows = []
            product_row_local = _get_product_by_id(bot_id, product_id) if product_id else None
            product_label = (product_row_local.get("label") if product_row_local else "") or ""
            tier_label    = (tier_row.get("label") or "") if tier_row else ""
            def _sub(tpl: Optional[str], label: str) -> str:
                return (tpl or "").replace("{{answer_label}}", label)
            mirror_text = []
            if len(qrows) >= 1 and product_label:
                mirror_text.append({"q_key": "product", "text": _sub(qrows[0].get("mirror_template"), product_label)})
            if len(qrows) >= 2:
                mirror_text.append({"q_key": "tier", "text": _sub(qrows[1].get("mirror_template"), tier_label)})
            return jsonify({"ok": True, "custom": True, "mirror_text": mirror_text}), 200
        product_row = _get_product_by_id(bot_id, product_id) if product_id else None
        baselines = _get_baseline_products(bot_id)
        line_items: List[Dict[str, Any]] = []
        for b in baselines:
            m = _get_matrix_row(b["id"], tier_id)
            line_items.append({
                "label": b.get("label") or "",
                "currency_code": m["currency_code"],
                "price_min": float(m["price_min"] or 0.0),
                "price_max": float(m["price_max"] or 0.0),
            })
        if product_row and not bool(product_row.get("is_included")):
            m = _get_matrix_row(product_row["id"], tier_id)
            line_items.append({
                "label": product_row.get("label") or "",
                "currency_code": m["currency_code"],
                "price_min": float(m["price_min"] or 0.0),
                "price_max": float(m["price_max"] or 0.0),
            })
        currency = "USD"
        if line_items:
            currency = line_items[0].get("currency_code") or "USD"
        total_min = sum(float(li.get("price_min") or 0.0) for li in line_items)
        total_max = sum(float(li.get("price_max") or 0.0) for li in line_items)
        try:
            qr = (
                sb().table("price_questions_v2")
                .select("id,mirror_template")
                .eq("bot_id", bot_id)
                .order("sort_order", desc=False)
                .limit(2)
                .execute()
            )
            qrows = qr.data or []
        except Exception as e:
            _log(f"[pricing_estimate:mirror] {e}")
            qrows = []
        product_label = (product_row.get("label") if product_row else "") or ""
        tier_label    = (tier_row.get("label") or "")
        def _sub(tpl: Optional[str], label: str) -> str:
            return (tpl or "").replace("{{answer_label}}", label)
        mirror_text = []
        if len(qrows) >= 1 and product_label:
            mirror_text.append({"q_key": "product", "text": _sub(qrows[0].get("mirror_template"), product_label)})
        if len(qrows) >= 2:
            mirror_text.append({"q_key": "tier", "text": _sub(qrows[1].get("mirror_template"), tier_label)})
        try:
            if bot_id and session_id and visitor_id:
                log_event(
                    bot_id=bot_id,
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="price_estimate",
                    payload={
                        "product_id": product_id or None,
                        "tier_id": tier_id or None,
                        "custom": False,
                        "total_min": total_min,
                        "total_max": total_max,
                        "currency_code": currency,
                    },
                )
        except Exception as e:
            _log(f"[/pricing/estimate.log_event] {e}")
        return jsonify({
            "ok": True,
            "custom": False,
            "currency_code": currency,
            "total_min": total_min,
            "total_max": total_max,
            "line_items": line_items,
            "mirror_text": mirror_text,
        }), 200
    except Exception as e:
        _log(f"[/pricing/estimate] {e}")
        return jsonify({"ok": False, "error": "server_error"}), 500

def _session_context_set_agent(session_id: str, agent_id: str, agent_alias: Optional[str]):
    """
    Idempotently store agent_id (+ alias) in session context.
    """
    if not session_id or not agent_id:
        return
    try:
        r = (
            sb().table("activity_sessions_v2")
            .select("context")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        row = (r.data or [None])[0]
        ctx = {}
        if row and isinstance(row.get("context"), dict):
            ctx = dict(row["context"])
        changed = False
        if ctx.get("agent_id") != agent_id:
            ctx["agent_id"] = agent_id
            changed = True
        if agent_alias and ctx.get("agent_alias") != agent_alias:
            ctx["agent_alias"] = agent_alias
            changed = True
        if changed:
            ctx["updated_at"] = time.time()
            sb().table("activity_sessions_v2").update({"context": ctx}).eq("id", session_id).execute()
    except Exception as e:
        _log(f"[_session_context_set_agent] {e}")


@demo_hal_bp.route("/agent", methods=["GET", "OPTIONS"])
def get_agent():
    """
    Retrieve an active scheduling agent for a bot.

    Features:
      - Supports ?agent=<alias> to select by agents_v2.alias (scoped to bot_id).
      - Case-insensitive lookup (stores alias normalized) unless strict_case=1 provided.
      - Optional strict behavior: if &strict=1 and requested alias not found -> 404 (no fallback).
      - Default (non-strict): fallback to first active agent if alias not found.
      - Records agent_id / agent_alias into activity_sessions_v2.context when session_id present.
      - Logs schedule_open event (includes requested_alias vs resolved alias).

    Query Params:
      bot_id (required)
      agent  (optional alias)
      strict=1 (optional) -> disable fallback if alias not found
      strict_case=1 (optional) -> treat alias comparison case-sensitively
      session_id / visitor_id (optional, for logging & context enrichment)

    Response:
      200: {"ok": true, "agent": {...}}
      404: {"ok": false, "error": "agent_not_found"}
      400: {"ok": false, "error": "bot_id_required"}
    """
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    try:
        bot_id       = (request.args.get("bot_id") or "").strip()
        agent_alias  = (request.args.get("agent") or "").strip()
        strict       = (request.args.get("strict") or "").strip().lower() in ("1", "true", "yes", "y")
        strict_case  = (request.args.get("strict_case") or "").strip().lower() in ("1", "true", "yes", "y")

        if not bot_id:
            return _corsify(jsonify({"ok": False, "error": "bot_id_required"})), 400

        agent = None
        alias_requested = agent_alias or None
        alias_normalized = agent_alias if strict_case else agent_alias.lower()

        # Attempt alias lookup first (if provided)
        if agent_alias:
            try:
                q = (
                    sb().table("agents_v2")
                    .select(AGENT_SELECT_FIELDS)
                    .eq("bot_id", bot_id)
                    .eq("active", True)
                )
                # Case handling
                if strict_case:
                    q = q.eq("alias", agent_alias)
                else:
                    # Fetch possible matches then normalize locally (ilike would work too, but this avoids
                    # potential collation differences and lets us keep a small code path)
                    # If you expect many rows, consider .ilike("alias", agent_alias)
                    pass
                res = q.execute()
                rows = res.data or []
                if not strict_case:
                    rows = [r for r in rows if (r.get("alias") or "").lower() == alias_normalized]
                if rows:
                    agent = rows[0]
            except Exception as e:
                _log(f"[get_agent:alias_lookup] {e}")

        # Fallback if alias not found and not strict
        if not agent and (not agent_alias or not strict):
            try:
                r_any = (
                    sb().table("agents_v2")
                    .select(AGENT_SELECT_FIELDS)
                    .eq("bot_id", bot_id)
                    .eq("active", True)
                    .limit(1)
                    .execute()
                )
                rows_any = r_any.data or []
                if rows_any:
                    agent = rows_any[0]
            except Exception as e:
                _log(f"[get_agent:fallback_lookup] {e}")

        if not agent:
            return _corsify(jsonify({"ok": False, "error": "agent_not_found"})), 404

        session_id = (request.args.get("session_id") or request.headers.get("X-Session-Id") or "").strip()
        visitor_id = (request.args.get("visitor_id") or request.headers.get("X-Visitor-Id") or "").strip()

        # If session or visitor missing, attempt same visitor/session reuse logic as elsewhere.
        try:
            if bot_id and (not session_id or not visitor_id):
                v = get_or_create_visitor(bot_id)
                if v and v.get("id"):
                    visitor_id = visitor_id or str(v["id"])
                    try:
                        sr = (
                            sb().table("activity_sessions_v2")
                            .select("id,last_event_at,started_at,ended_at")
                            .eq("bot_id", bot_id)
                            .eq("visitor_id", v["id"])
                            .is_("ended_at", None)
                            .order("started_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                        cand = (sr.data or [])
                        if cand:
                            from datetime import datetime, timezone, timedelta
                            ref_time = cand[0].get("last_event_at") or cand[0].get("started_at")
                            dt = datetime.fromisoformat(ref_time.replace("Z", "+00:00")) if isinstance(ref_time, str) else None
                            if dt and (datetime.now(timezone.utc) - dt) <= timedelta(minutes=30):
                                session_id = session_id or str(cand[0]["id"])
                    except Exception:
                        pass
        except Exception as e:
            _log(f"[get_agent:visitor_session_resolve] {e}")

        # Persist agent in session context if possible
        try:
            if session_id and agent.get("id"):
                _session_context_set_agent(session_id, str(agent["id"]), agent.get("alias"))
        except Exception as e:
            _log(f"[get_agent:context_store] {e}")

        # Log schedule_open event
        try:
            if bot_id and session_id and visitor_id:
                log_event(
                    bot_id=bot_id,
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="schedule_open",
                    payload={
                        "calendar_link_type": agent.get("calendar_link_type"),
                        "calendar_link": agent.get("calendar_link"),
                        "agent_id": agent.get("id"),
                        "agent_alias": agent.get("alias"),
                        "requested_alias": alias_requested,
                        "strict": strict,
                        "strict_case": strict_case,
                        "fallback_used": bool(alias_requested and agent.get("alias") and (agent.get("alias") != alias_requested) and not strict),
                    },
                )
        except Exception as e:
            _log(f"[get_agent.log_event] {e}")

        return _corsify(jsonify({"ok": True, "agent": agent})), 200
    except Exception as e:
        _log(f"[get_agent] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

@demo_hal_bp.route("/calendly/webhook", methods=["POST", "OPTIONS"])
def calendly_webhook():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    return _corsify(jsonify({
        "ok": False,
        "error": "calendly_webhook_disabled",
        "message": "Use /calendly/js-event from the browser postMessage."
    })), 410

@demo_hal_bp.route("/calendly/js-event", methods=["POST", "OPTIONS"])
def calendly_js_event():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    def _to_str(v):
        try:
            if v is None:
                return ""
            if isinstance(v, str):
                return v.strip()
            if isinstance(v, (int, float)):
                return str(v)
            if isinstance(v, dict):
                for k in ("id", "value"):
                    if k in v and isinstance(v[k], (str, int, float)):
                        return str(v[k]).strip()
                return json.dumps(v, separators=(",", ":" ))[:128]
            if isinstance(v, (list, tuple)) and v:
                return _to_str(v[0])
            return str(v)
        except Exception:
            return ""
    try:
        body = request.get_json(force=True, silent=True) or {}
        if "data" in body and isinstance(body["data"], dict) and not any(k in body for k in ("bot_id", "session_id", "visitor_id", "payload")):
            body = body["data"]
        bot_id     = _to_str(body.get("bot_id"))
        session_id = _to_str(body.get("session_id"))
        visitor_id = _to_str(body.get("visitor_id"))
        payload    = body.get("payload") or {}
        if not (bot_id and session_id and visitor_id):
            return _corsify(jsonify({"ok": False, "error": "missing_ids"})), 400
        ev_in_payload = payload.get("event")
        ev = _to_str(ev_in_payload).lower()
        if ev == "calendly.event_canceled":
            ev_type = "meeting_canceled"
        else:
            ev_type = "meeting_scheduled"
        log_event(
            bot_id=bot_id,
            session_id=session_id,
            visitor_id=visitor_id,
            event_type=ev_type,
            payload={"source": "js", **payload},
        )
        return _corsify(jsonify({"ok": True})), 200
    except Exception as e:
        _log(f"[/calendly/js-event] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

# ---------- Formfill Endpoints (Perspective injection) ----------

@demo_hal_bp.route("/formfill-config", methods=["GET", "OPTIONS"])
def formfill_config():
    """
    Return full formfill definition + visitor defaults (spec rev):
      - Returns ALL stored formfill_fields.
      - Ensures core fields (first_name, last_name, email, perspective) exist.
      - Perspective includes canonical options.
      - No is_standard flag; FE decides which to show (collected) or hide.
    """
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200

    bot_id = (request.args.get("bot_id") or "").strip()
    alias  = (request.args.get("alias") or "").strip()
    visitor_id = (request.args.get("visitor_id") or "").strip()

    if not bot_id and not alias:
        return _corsify(jsonify({"ok": False, "error": "missing bot_id or alias"})), 400

    try:
        if not bot_id and alias:
            br = (
                sb().table("bots_v2")
                .select("id")
                .eq("alias", alias)
                .eq("active", True)
                .limit(1).execute()
            )
            brow = (br.data or [None])[0]
            if not brow:
                return _corsify(jsonify({"ok": False, "error": "invalid_alias"})), 404
            bot_id = brow["id"]

        r = (
            sb().table("bots_v2")
            .select("show_formfill,formfill_fields")
            .eq("id", bot_id)
            .limit(1).execute()
        )
        bot_row = (r.data or [None])[0]
        if not bot_row:
            return _corsify(jsonify({"ok": False, "error": "bot_not_found"})), 404

        show_formfill = bool(bot_row.get("show_formfill"))
        fields_arr = bot_row.get("formfill_fields") or []
        if not isinstance(fields_arr, list):
            fields_arr = []

        by_key = {}
        for f in fields_arr:
            if isinstance(f, dict) and f.get("field_key"):
                by_key[f["field_key"]] = dict(f)

        def ensure_core(fk, label, ftype, opts=None):
            """
            Ensure a core field exists. If it already exists, augment missing
            structural attributes but do not overwrite user-customized label,
            tooltip, or placeholder unless they are absent.
            """
            default_tooltips = {
                "first_name": "Your first name",
                "last_name": "Your last name",
                "email": "Your work email",
                "perspective": "Select the perspective you most care about (optional)",
            }
            if fk not in by_key:
                by_key[fk] = {
                    "field_key": fk,
                    "label": label,
                    "field_type": ftype,
                    "is_collected": True,
                    "is_required": True,
                }
                if opts is not None:
                    by_key[fk]["options"] = opts
                # Inject tooltip & placeholder for perspective (and others if desired)
                if fk in default_tooltips:
                    by_key[fk]["tooltip"] = default_tooltips[fk]
                    # Optional: also set placeholder explicitly
                    by_key[fk].setdefault("placeholder", default_tooltips[fk])
            else:
                # Preserve existing, just enforce structural parts
                if fk == "perspective":
                    by_key[fk]["field_type"] = "single_select"
                    by_key[fk]["options"] = PERSPECTIVE_OPTIONS
                    if not by_key[fk].get("tooltip"):
                        by_key[fk]["tooltip"] = default_tooltips["perspective"]
                    if not by_key[fk].get("placeholder"):
                        by_key[fk]["placeholder"] = default_tooltips["perspective"]

        # Ensure core fields (unchanged order)
        ensure_core("first_name", "First Name", "text")
        ensure_core("last_name", "Last Name", "text")
        ensure_core("email", "Email", "email")
        ensure_core("perspective", "Perspective", "single_select", PERSPECTIVE_OPTIONS)

        normalized = []
        for k in sorted(by_key.keys()):
            f = by_key[k]
            normalized.append({
                "field_key": f.get("field_key"),
                "label": f.get("label") or f.get("field_key"),
                "tooltip": f.get("tooltip"),
                "placeholder": f.get("placeholder"),
                "field_type": f.get("field_type") or "text",
                "is_required": bool(f.get("is_required", False)),
                "is_collected": bool(f.get("is_collected", True)),
                "options": f.get("options") if isinstance(f.get("options"), list) else None,
            })

        visitor_values = {}
        if visitor_id:
            vr = (
                sb().table("visitors_v2")
                .select("formfill_fields")
                .eq("id", visitor_id)
                .limit(1).execute()
            )
            vrow = (vr.data or [None])[0]
            arr = (vrow.get("formfill_fields") if vrow else []) or []
            visitor_values = _ff_arr_to_map(arr)

        pv = (visitor_values.get("perspective") or "").lower()
        visitor_values["perspective"] = pv if pv in ALLOWED_PERSPECTIVES else "general"

        return _corsify(jsonify({
            "ok": True,
            "show_formfill": show_formfill,
            "fields": normalized,
            "visitor_values": visitor_values,
            "bot_id": bot_id,
        })), 200

    except Exception as e:
        _log(f"[formfill_config] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500
        
@demo_hal_bp.route("/visitor-formfill", methods=["GET", "OPTIONS"])
def visitor_formfill_get():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    visitor_id = (request.args.get("visitor_id") or "").strip()
    if not visitor_id:
        return _corsify(jsonify({"ok": False, "error": "missing_visitor_id"})), 400
    try:
        resp = (
            sb().table("visitors_v2")
            .select("formfill_fields")
            .eq("id", visitor_id)
            .limit(1)
            .execute()
        )
        row = (getattr(resp, "data", None) or [None])[0]
        arr = (row.get("formfill_fields") if row else []) or []
        vals = _ff_arr_to_map(arr)
        pv = (vals.get("perspective") or "").lower()
        if pv not in ALLOWED_PERSPECTIVES:
            vals["perspective"] = "general"
        else:
            vals["perspective"] = pv
        return _corsify(jsonify({"ok": True, "values": vals})), 200
    except Exception as e:
        _log(f"[visitor_formfill_get] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

def _update_latest_session_context_fields(visitor_id: str, bot_id: Optional[str], values_map: Dict[str, str]):
    """
    Merge updated visitor formfill values into the latest open session context.
    Also sync perspective directly if present.
    """
    if not visitor_id:
        return
    try:
        q = (
            sb().table("activity_sessions_v2")
            .select("id,context,started_at,last_event_at")
            .eq("visitor_id", visitor_id)
            .is_("ended_at", None)
            .order("started_at", desc=True)
            .limit(1)
        )
        if bot_id:
            q = q.eq("bot_id", bot_id)
        r = q.execute()
        row = (r.data or [None])[0]
        if not row:
            return
        ctx = row.get("context")
        if not isinstance(ctx, dict):
            ctx = {}
        ff_map = ctx.get("formfill_values")
        if not isinstance(ff_map, dict):
            ff_map = {}
        ff_map.update(values_map)
        ctx["formfill_values"] = ff_map
        if "perspective" in values_map and values_map["perspective"] in ALLOWED_PERSPECTIVES:
            ctx["perspective"] = values_map["perspective"]
        ctx["updated_at"] = time.time()
        sb().table("activity_sessions_v2").update({"context": ctx}).eq("id", row["id"]).execute()
    except Exception as e:
        _log(f"[update_latest_session_context_fields] {e}")


@demo_hal_bp.route("/visitor-formfill", methods=["POST", "OPTIONS"])
def visitor_formfill_post():
    """
    Upserts visitor formfill values. Perspective normalized to allowed set.
    Accepts arbitrary keys present in formfill fields configuration.
    """
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200

    data = request.get_json(silent=True) or {}
    visitor_id = (data.get("visitor_id") or "").strip()
    values = data.get("values") or {}
    bot_id = (data.get("bot_id") or "").strip()

    if not visitor_id or not isinstance(values, dict):
        return _corsify(jsonify({"ok": False, "error": "missing_visitor_id_or_values"})), 400

    if "perspective" in values:
        pv = (values.get("perspective") or "").strip().lower()
        values["perspective"] = pv if pv in ALLOWED_PERSPECTIVES else "general"

    try:
        r = (
            sb().table("visitors_v2")
            .select("formfill_fields,bot_id")
            .eq("id", visitor_id)
            .limit(1).execute()
        )
        row = (r.data or [None])[0]
        base_arr = (row.get("formfill_fields") if row else []) or []
        merged = _ff_merge_map_into_arr(base_arr, values)
        sb().table("visitors_v2").update({"formfill_fields": merged}).eq("id", visitor_id).execute()

        full_map = _ff_arr_to_map(merged)
        _update_latest_session_context_fields(visitor_id, bot_id or (row or {}).get("bot_id"), full_map)

        if "perspective" in values:
            try:
                sr = (
                    sb().table("activity_sessions_v2")
                    .select("id")
                    .eq("visitor_id", visitor_id)
                    .is_("ended_at", None)
                    .order("started_at", desc=True)
                    .limit(1).execute()
                )
                srow = (sr.data or [None])[0]
                effective_bot_id = bot_id or (row or {}).get("bot_id")
                if srow and srow.get("id") and effective_bot_id:
                    log_event(
                        bot_id=effective_bot_id,
                        session_id=srow["id"],
                        visitor_id=visitor_id,
                        event_type="perspective_change",
                        payload={"new": values["perspective"]},
                    )
            except Exception as e:
                _log(f"[visitor_formfill_post:log_perspective_change] {e}")

        return _corsify(jsonify({"ok": True})), 200
    except Exception as e:
        _log(f"[visitor_formfill_post] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

def _now_utc_iso() -> str:
    return datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()

def _end_session(session_id: str, cause: str, reason: Optional[str] = None) -> bool:
    """
    Idempotently end a session and emit a session_end event.
    cause: 'explicit' | 'sweep'
    reason: arbitrary string (e.g. 'unload', 'hidden', 'pagehide', 'inactivity')
    Returns True iff we actually set ended_at (i.e. session was open).
    """
    if not session_id:
        return False
    try:
        # Fetch full row (we need bot_id, visitor_id, timestamps)
        r = (
            sb().table("activity_sessions_v2")
            .select("id, bot_id, visitor_id, started_at, last_event_at, ended_at")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        row = (r.data or [None])[0]
        if not row:
            return False
        if row.get("ended_at"):
            # Already ended -> no new event
            return False

        # Perform idempotent update (server now)
        sb().table("activity_sessions_v2") \
            .update({"ended_at": "now()"}) \
            .eq("id", session_id) \
            .is_("ended_at", None) \
            .execute()

        # Re-fetch ended_at (optional; or rely on now())
        try:
            r2 = (
                sb().table("activity_sessions_v2")
                .select("ended_at")
                .eq("id", session_id)
                .limit(1)
                .execute()
            )
            ended_iso = ((r2.data or [{}])[0]).get("ended_at")
        except Exception:
            ended_iso = None

        started_dt = _parse_iso_dt(row.get("started_at"))
        last_dt = _parse_iso_dt(row.get("last_event_at")) or started_dt
        ended_dt = _parse_iso_dt(ended_iso) or datetime.utcnow().replace(tzinfo=timezone.utc)

        duration_sec = None
        inactivity_sec = None
        if started_dt and ended_dt:
            duration_sec = max(0, int((ended_dt - started_dt).total_seconds()))
        if last_dt and ended_dt:
            inactivity_sec = max(0, int((ended_dt - last_dt).total_seconds()))

        payload = {
            "cause": cause,                    # 'explicit' or 'sweep'
            "reason": reason or ("inactivity" if cause == "sweep" else None),
            "duration_sec": duration_sec,
            "inactivity_sec": inactivity_sec,
            "last_event_at": row.get("last_event_at"),
        }

        bot_id = row.get("bot_id")
        visitor_id = row.get("visitor_id")
        if bot_id and visitor_id:
            try:
                # Use log_event so denorm fields & last_event_at refresh still pipeline through existing logic
                log_event(
                    bot_id=bot_id,
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="session_end",
                    payload=payload,
                )
            except Exception as e:
                _log(f"[session_end:log_event_error] {e}")

        _log(f"[session_end] session={session_id} cause={cause} reason={reason} duration={duration_sec}s inactivity={inactivity_sec}s")
        return True
    except Exception as e:
        _log(f"[session_end:error] {e}")
        return False

# --- Modify /session/end endpoint to use new signature (only change inside handler) ---
@demo_hal_bp.route("/session/end", methods=["POST", "OPTIONS"])
def session_end():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200
    try:
        body = request.get_json(force=True, silent=True) or {}
        sid = (body.get("session_id") or "").strip()
        reason = (body.get("reason") or "").strip().lower() or None
        if not sid:
            return _corsify(jsonify({"ok": False, "error": "missing_session_id"})), 400
        updated = _end_session(sid, cause="explicit", reason=reason)
        return _corsify(jsonify({"ok": True, "updated": bool(updated)})), 200
    except Exception as e:
        _log(f"[/session/end] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

# --- Modify /session/sweep endpoint to call _end_session with cause='sweep' and reason='inactivity' ---
@demo_hal_bp.route("/session/sweep", methods=["POST", "OPTIONS"])
def session_sweep():
    if request.method == "OPTIONS":
        return _corsify(jsonify({"ok": True})), 200

    if not SESSION_SWEEP_SECRET:
        return _corsify(jsonify({"ok": False, "error": "sweep_disabled"})), 403

    provided = (request.headers.get("X-Sweep-Secret") or "").strip()
    if provided != SESSION_SWEEP_SECRET:
        return _corsify(jsonify({"ok": False, "error": "unauthorized"})), 401

    try:
        idle_after = datetime.utcnow() - timedelta(minutes=SESSION_IDLE_TIMEOUT_MINUTES)
        cutoff_iso = idle_after.replace(tzinfo=timezone.utc).isoformat()

        resp = (
            sb().table("activity_sessions_v2")
            .select("id,last_event_at,started_at,ended_at")
            .is_("ended_at", None)
            .lt("last_event_at", cutoff_iso)
            .limit(1000)
            .execute()
        )
        candidates = resp.data or []

        try:
            null_last_event_resp = (
                sb().table("activity_sessions_v2")
                .select("id,last_event_at,started_at,ended_at")
                .is_("ended_at", None)
                .is_("last_event_at", None)
                .lt("started_at", cutoff_iso)
                .limit(1000)
                .execute()
            )
            null_candidates = null_last_event_resp.data or []
        except Exception:
            null_candidates = []

        id_set = {c["id"] for c in candidates if c.get("id")}
        for nc in null_candidates:
            if nc.get("id") and nc["id"] not in id_set:
                candidates.append(nc)
                id_set.add(nc["id"])

        ended_count = 0
        for row in candidates:
            sid = row.get("id")
            if not sid:
                continue
            ok = _end_session(sid, cause="sweep", reason="inactivity")
            if ok:
                ended_count += 1

        return _corsify(jsonify({
            "ok": True,
            "ended": ended_count,
            "timeout_minutes": SESSION_IDLE_TIMEOUT_MINUTES,
        })), 200
    except Exception as e:
        _log(f"[/session/sweep] {e}")
        return _corsify(jsonify({"ok": False, "error": "server_error"})), 500

# (End of file)
