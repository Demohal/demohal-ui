// FormFillCard.jsx — FULL REPLACEMENT (spec update)
// CHANGES (Spec Rev):
//  - Every field (including perspective + first_name/last_name/email) now comes from formfill_fields.
//  - Only render fields whose is_collected === true (dynamic hide/show).
//  - Removed tooltip icon; if a field has a tooltip and value is empty, we show it as the placeholder.
//  - Supports single_select via <select>. Perspective (if provided with options) displays as pick list.
//  - Validation ignores non-collected fields (they are not rendered).
//  - Required validation still enforced for visible (collected) fields.
//  - No reference to is_standard.
//
// Props:
//   fields: Array<{
//      field_key, label, field_type, is_required, is_collected, options?, tooltip?, placeholder?
//   }>
//   defaults?: Record<string,string>
//   onSubmit(values: Record<string,string>): void
//   onCancel?: () => void
//
// NOTE: 'fields' should already contain perspective & core identity fields from upstream.
//
import React from "react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function FieldRow({ f, value, onChange, error }) {
  const id = `ff_${f.field_key}`;
  const t = (f.field_type || "text").toLowerCase();
  const opts = Array.isArray(f.options) ? f.options.filter(Boolean) : [];
  const isSelect = t === "single_select" || (opts.length > 0 && t !== "multi_select");

  // Placeholder preference: field.placeholder > field.tooltip > generic
  const effectivePlaceholder =
    (value ? undefined : (f.placeholder || f.tooltip || (isSelect ? `Select ${f.label || f.field_key}` : "")));

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium flex items-center gap-1">
        <span>{f.label || f.field_key}</span>
        {f.is_required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </label>

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
            <option value="">{effectivePlaceholder || `Select ${f.label || f.field_key}`}</option>
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
          {error ? <div className="text-xs text-red-600 mt-1">{error}</div> : null}
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
            placeholder={effectivePlaceholder || ""}
            className={classNames(
              "w-full rounded-[0.75rem] px-3 py-2 text-sm border",
              "border-[var(--border-default)] bg-[var(--card-bg)]",
              "focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
            )}
            autoComplete="off"
          />
          {error ? <div className="text-xs text-red-600">{error}</div> : null}
        </>
      )}
    </div>
  );
}

export default function FormFillCard({ fields, defaults, onSubmit, onCancel }) {
  // Only collected fields are displayed / validated.
  const collectedFields = React.useMemo(
    () => (fields || []).filter((f) => f && f.is_collected),
    [fields]
  );

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
      return "Required";
    }
    if (s.length === 0) return null;
    switch (t) {
      case "email":
        return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(s) ? null : "Invalid email";
      case "number":
        return /^-?\d+(?:[.,]\d+)?$/.test(s) ? null : "Invalid number";
      case "phone":
        return /^[0-9+()\-\s]{7,}$/.test(s) ? null : "Invalid phone";
      case "single_select":
        if (optionKeys.length && !optionKeys.includes(s.toLowerCase())) {
          return "Invalid choice";
        }
        return null;
      default:
        return null;
    }
  }

  function validateAll() {
    const e = {};
    collectedFields.forEach((f) => {
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
    const out = { ...values };
    if (typeof out.perspective === "string")
      out.perspective = out.perspective.toLowerCase();
    onSubmit(out);
  }

  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl p-4 md:p-5 border-2 border-[var(--border-default)] [box-shadow:var(--shadow-elevation)]">
      <div className="space-y-4">
        {collectedFields.map((f) => (
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
        {collectedFields.length === 0 && (
          <div className="text-xs italic text-[var(--helper-fg)]">
            No fields selected to collect.
          </div>
        )}
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
