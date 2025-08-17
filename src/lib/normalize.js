/** @typedef {{ id: string, title: string, url?: string, description?: string }} Demo */
export const toDemo = (x = {}) => ({
  id: String(x.id ?? x.demo_id ?? "").trim(),
  title: String(x.title ?? x.name ?? "").trim(),
  url: x.url ?? x.value ?? undefined,
  description: x.description ?? "",
});
