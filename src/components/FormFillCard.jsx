// FormFillCard.jsx — FULL REPLACEMENT (now supports single_select pick lists)
// Props:
//   fields: Array<{
//      field_key, label, tooltip, placeholder, field_type,
//      is_pii, is_required, is_collected, is_standard, options?
//   }>
//   defaults?: Record<string,string>
//   onSubmit(values: Record<string,string>): void
//   onCancel?: () => void
//
// Improvements:
//  - Added native <select> rendering for field_type === 'single_select' (or if options array provided).
//  - Perspective field (single_select) now shows canonical pick list passed via f.options.
//  - Validation enforces required selection + membership in provided options.
//  - Keyboard and a11y friendly (labels + description tooltip).
//  - Normalizes perspective value to lowercase before submit (safety).
//
// NOTE: Upstream code (Welcome.jsx) must ensure `options` for perspective are provided
//       as [{key,label}, ...]. This component simply renders what it receives.
//

import React from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function FieldRow({ f, value, onChange, error }) {
  const id = `ff_${f.field_key}`;
  const t = (f.field_type || "text").toLowerCase();
  const opts = Array.isArray(f.options) ? f.options.filter(Boolean) : [];

  // Decide rendering strategy
  const isSelect = t === "single_select" || (opts.length > 0 && t !== "multi_select");

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {f.label || f.field_key}
          {f.is_required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </label>
        {f.tooltip ? (
          <div
            className="relative group inline-flex items-center"
            aria-label={`Why we ask for ${f.label || f.field_key}`}
          >
            <QuestionMarkCircleIcon className="h-5 w-5 text-[var(--helper-fg)] shrink-0" />
            <div className="absolute z-10 hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 left-6 -top-2 whitespace-pre [box-shadow:var(--shadow-elevation)]">
              {f.tooltip}
            </div>
          </div>
        ) : null}
      </div>

      {isSelect ? (
        <div>
          <select
            id={id}
            className={classNames(
              "w-full rounded-[0.75rem] px-3 py-2 text-sm border",
              "border-[var(--border-default)] bg-[var(--card-bg)]",
              "focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
            )}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          >
            {/* Placeholder / empty option */}
            <option value="">
              {f.placeholder || `Select ${f.label || f.field_key}`}
            </option>
            {opts.map((o) => {
              const k = o.key ?? o.value ?? o.id;
              const lbl = o.label ?? o.title ?? k;
              if (k == null) return null;
              return (
                <option key={k} value={String(k)}>
                  {lbl}
                </option>
              );
            })}
          </select>
          {error ? (
            <div className="text-xs text-red-600 mt-1">{error}</div>
          ) : null}
        </div>
      ) : (
        <>
          <input
            id={id}
            type={
              t === "email"
                ? "email"
                : t === "number"
                ? "number"
                : t === "phone"
                ? "tel"
                : "text"
            }
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={f.placeholder || ""}
            className={classNames(
              "w-full rounded-[0.75rem] px-3 py-2 text-sm border",
              "border-[var(--border-default)] bg-[var(--card-bg)]",
              "focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
            )}
          />
          {error ? <div className="text-xs text-red-600">{error}</div> : null}
        </>
      )}
    </div>
  );
}

export default function FormFillCard({ fields, defaults, onSubmit, onCancel }) {
  const initial = React.useMemo(() => {
    const o = {};
    (fields || []).forEach((f) => {
      if (!f || !f.field_key) return;
      const k = String(f.field_key);
      const raw =
        defaults && Object.prototype.hasOwnProperty.call(defaults, k)
          ? defaults[k]
          : "";
      o[k] = typeof raw === "string" ? raw : "";
    });
    return o;
  }, [fields, defaults]);

  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState({});
  React.useEffect(() => {
    setValues(initial);
    setErrors({});
  }, [initial]);

  function validateField(f, v) {
    const s = (v ?? "").toString().trim();
    const t = (f.field_type || "text").toLowerCase();
    const opts = Array.isArray(f.options) ? f.options.filter(Boolean) : [];
    const optionKeys = opts.map(
      (o) => String(o.key ?? o.value ?? o.id ?? "").toLowerCase()
    );

    if (f.is_required && s.length === 0) {
      return `${f.label || f.field_key} is required`;
    }
    if (s.length === 0) return null; // optional empty is fine

    switch (t) {
      case "email":
        return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(s)
          ? null
          : "Enter a valid email";
      case "number":
        return /^-?\d+(?:[.,]\d+)?$/.test(s) ? null : "Enter a valid number";
      case "phone":
        return /^[0-9+()\-\s]{7,}$/.test(s) ? null : "Enter a valid phone";
      case "single_select": {
        if (optionKeys.length && !optionKeys.includes(s.toLowerCase())) {
          return "Choose a valid option";
        }
        return null;
      }
      default:
        return null;
    }
  }

  function validateAll() {
    const e = {};
    (fields || []).forEach((f) => {
      if (!f?.field_key) return;
      const k = String(f.field_key);
      const err = validateField(f, values[k]);
      if (err) e[k] = err;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validateAll()) return;

    // Normalize perspective to lowercase if present (safety)
    const out = { ...values };
    if (typeof out.perspective === "string") {
      out.perspective = out.perspective.toLowerCase();
    }
    onSubmit(out);
  }

  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl p-4 md:p-5 border-2 border-[var(--border-default)] [box-shadow:var(--shadow-elevation)]">
      <div className="space-y-4">
        {(fields || []).map((f) => (
            <FieldRow
              key={f.field_key}
              f={f}
              value={values[f.field_key] ?? ""}
              onChange={(val) =>
                setValues((s) => ({ ...s, [f.field_key]: val }))
              }
              error={errors[f.field_key]}
            />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-sm border border-[var(--border-default)] hover:bg-black/5"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
            aria-label="Continue"
          onClick={submit}
          className="h-10 w-10 rounded-full bg-[var(--send-color)] text-white flex items-center justify-center shadow hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M5 12h14" />
            <path d="M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
