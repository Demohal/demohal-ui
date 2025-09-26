// FormFillCard.jsx — FULL REPLACEMENT
// Dynamic fields from backend; minimal validation by field_type; heroicon tooltips;
// circular arrow submit button matching Ask bar.
// Props:
//   fields: Array<{ field_key, label, tooltip, placeholder, field_type, is_pii, is_required, is_collected, is_standard }>
//   defaults?: Record<string,string>
//   onSubmit(values: Record<string,string>): void
//   onCancel?: () => void

import React from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

function FieldRow({ f, value, onChange, error }) {
  const id = `ff_${f.field_key}`;
  const t = (f.field_type || "text").toLowerCase();
  const typeAttr = t === "email" ? "email" : t === "number" ? "number" : "text";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {f.label || f.field_key}
        </label>
        {f.tooltip ? (
          <div className="relative group inline-flex items-center" aria-label={`Why we ask for ${f.label || f.field_key}`}>
            <QuestionMarkCircleIcon className="h-5 w-5 text-[var(--helper-fg)] shrink-0" />
            <div className="absolute z-10 hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 left-6 -top-2 whitespace-nowrap [box-shadow:var(--shadow-elevation)]">
              {f.tooltip}
            </div>
          </div>
        ) : null}
      </div>
      <input
        id={id}
        type={typeAttr}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={f.placeholder || ""}
        className="w-full rounded-[0.75rem] px-3 py-2 text-sm border border-[var(--border-default)] bg-[var(--card-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
      />
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

export default function FormFillCard({ fields, defaults, onSubmit, onCancel }) {
  const initial = React.useMemo(() => {
    const o = {};
    (fields || []).forEach((f) => {
      if (!f || !f.field_key) return;
      const k = String(f.field_key);
      o[k] = (defaults && typeof defaults[k] === "string") ? defaults[k] : "";
    });
    return o;
  }, [fields, defaults]);

  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState({});
  React.useEffect(() => setValues(initial), [initial]);

  function basicValidateField(f, v) {
    const s = (v ?? "").toString().trim();
    if (f.is_required && s.length === 0) return `${f.label || f.field_key} is required`;
    if (s.length === 0) return null; // optional & empty
    switch ((f.field_type || "text").toLowerCase()) {
      case "email":
        return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(s) ? null : "Enter a valid email";
      case "number":
        return /^-?\d+(?:[.,]\d+)?$/.test(s) ? null : "Enter a valid number";
      case "phone":
        return /^[0-9+()\-\s]{7,}$/.test(s) ? null : "Enter a valid phone";
      default:
        return null; // text: any string ok if not required
    }
  }

  function validateAll() {
    const e = {};
    (fields || []).forEach((f) => {
      if (!f || !f.field_key) return;
      const k = String(f.field_key);
      const err = basicValidateField(f, values[k]);
      if (err) e[k] = err;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validateAll()) return;
    onSubmit({ ...values });
  }

  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl p-4 md:p-5 border-2 border-[var(--border-default)] [box-shadow:var(--shadow-elevation)]">
      <div className="space-y-4">
        {(fields || []).map((f) => (
          <FieldRow
            key={f.field_key}
            f={f}
            value={values[f.field_key] ?? ""}
            onChange={(val) => setValues((s) => ({ ...s, [f.field_key]: val }))}
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
          className="h-10 w-10 rounded-full bg-[var(--send-color)] text-white flex items-center justify-center shadow hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M5 12h14" />
            <path d="M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
