export function applyTheme(theme = {}) {
  const root = document.documentElement;
  const colors = theme.colors || {};
  for (const [k, v] of Object.entries(colors)) {
    if (!v) continue;
    root.style.setProperty(`--brand-${k}`, String(v));
  }
  const body = theme?.fonts?.body;
  const heading = theme?.fonts?.heading;
  if (body) {
    loadGoogleFont(body);
    root.style.setProperty("--font-body", `'${body}', system-ui, -apple-system, Segoe UI, Roboto, sans-serif`);
  }
  if (heading) {
    if (heading !== body) loadGoogleFont(heading);
    root.style.setProperty("--font-heading", `'${heading}', system-ui, -apple-system, Segoe UI, Roboto, sans-serif`);
  }
}

function loadGoogleFont(family) {
  const id = `brand-font-${family.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${new URLSearchParams({
    family: `${family}:wght@400;500;600;700`,
    display: "swap",
  })}`;
  document.head.appendChild(link);
}
