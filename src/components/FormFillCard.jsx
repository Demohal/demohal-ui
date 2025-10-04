// FormFillCard.jsx — perspective placeholder strategy (non-selectable empty for perspective)
// Empty perspective omitted on submit so server can treat as "general".
import React from "react";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function FieldRow({ f, value, onChange, error }) {
  const id = `ff_${f.field_key}`;
  const type = (f.field_type || "text").toLowerCase();
  const opts = Array.isArray(f.options) ? f.options.filter(Boolean) : [];
  const isSelect =
    type === "single_select" ||
    (opts.length > 0 && type !== "multi_select");
  const isPerspective = f.field_key === "perspective";

  const placeholder =
    !value
      ? f.placeholder ||
        f.tooltip ||
        (isSelect ? `Select ${f.label || f.field_key}` : "")
      : undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="text-sm font-medium flex items-center gap-1"
      >
        <span>{f.label || f.field_key}</span>
        {f.is_required && (
          <span className="text-red-500 ml-0.5">*</span>
        )}
      </label>
      {isSelect ? (
        <div>
          <select
            id={id}
            className={cls(
              "w-full rounded-[0.75rem] px-3 py-2 text-sm border",
              "border-[var(--border-default)] bg-[var(--card-bg)]",
              "focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
            )}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
          >
            {isPerspective ? (
              <option value="" disabled hidden>
                {placeholder || "Select Perspective"}
              </option>
            ) : (
              <option value="">
                {placeholder ||
                  `Select ${f.label || f.field_key}`}
              </option>
            )}
            {opts.map((o) => {
              const k = o.key ?? o.value ?? o.id;
              if (k == null) return null;
              return (
                <option key={k} value={String(k)}>
                  {o.label ?? o.title ?? k}
                </option>
              );
            })}
          </select>
          {error && (
            <div className="text-xs text-red-600 mt-1">{error}</div>
          )}
        </div>
      ) : (
        <>
          <input
            id={id}
            type={
              type === "email"
                ? "email"
                : type === "number"
                ? "number"
                : type === "phone"
                ? "tel"
                : "text"
            }
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || ""}
            className={cls(
              "w-full rounded-[0.75rem] px-3 py-2 text-sm border",
              "border-[var(--border-default)] bg-[var(--card-bg)]",
              "focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
            )}
            autoComplete="off"
          />
          {error && (
            <div className="text-xs text-red-600">{error}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function FormFillCard({
  fields,
  defaults,
  onSubmit,
  onCancel,
}) {
  const collected = React.useMemo(
    () => (fields || []).filter((f) => f && f.is_collected),
    [fields]
  );

  const initial = React.useMemo(() => {
    const o = {};
    (fields || []).forEach((f) => {
      if (!f?.field_key) return;
      const k = f.field_key;
      const raw =
        defaults && Object.prototype.hasOwnProperty.call(defaults, k)
          ? defaults[k]
          : "";
      o[k] =
        typeof raw === "string"
          ? raw
          : raw == null
          ? ""
          : String(raw);
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
    if (f.is_required && s.length === 0) return "Required";
    if (s.length === 0) return null;
    const t = (f.field_type || "text").toLowerCase();
    switch (t) {
      case "email":
        return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(s)
          ? null
          : "Invalid email";
      case "number":
        return /^-?\d+(?:[.,]\d+)?$/.test(s)
          ? null
          : "Invalid number";
      case "phone":
        return /^[0-9+()\-\s]{7,}$/.test(s)
          ? null
          : "Invalid phone";
      case "single_select":
        if (
          Array.isArray(f.options) &&
          f.options.length > 0 &&
          !f.options
            .map((o) =>
              String(
                o.key ?? o.value ?? o.id ?? ""
              ).toLowerCase()
            )
            .includes(s.toLowerCase())
        ) {
          return "Invalid choice";
        }
        return null;
      default:
        return null;
    }
  }

  function validateAll() {
    const e = {};
    collected.forEach((f) => {
      const err = validateField(f, values[f.field_key]);
      if (err) e[f.field_key] = err;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validateAll()) return;
    const out = { ...values };
    if (!out.perspective) delete out.perspective;
    onSubmit && onSubmit(out);
  }

  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl p-4 md:p-5 border border-[var(--border-default)] [box-shadow:var(--shadow-elevation)]">
      <div className="space-y-4">
        {collected.map((f) => (
          <FieldRow
            key={f.field_key}
            f={f}
            value={values[f.field_key] ?? ""}
            onChange={(val) =>
              setValues((p) => ({ ...p, [f.field_key]: val }))
            }
            error={errors[f.field_key]}
          />
        ))}
        {collected.length === 0 && (
          <div className="text-xs italic text-[var(--helper-fg)]">
            No fields selected.
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-sm border border-[var(--border-default)] hover:bg-black/5"
          >
            Cancel
          </button>
        )}
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
