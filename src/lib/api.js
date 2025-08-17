// src/lib/api.js
const q = (obj) => new URLSearchParams(obj).toString();

export const getBotByAlias = async (baseUrl, alias) => {
  const url = `${baseUrl}/bot-by-alias?${q({ alias })}`;
  const r = await fetch(url);
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Failed to load bot (${r.status}) ${text}`);
  }
  const data = await r.json();
  // API can return { bot: {...} } or just the object. Normalize to the bot object.
  return data?.bot ?? data ?? {};
};

export const listDemos = async (baseUrl, botId) => {
  if (!botId) return [];
  const url = `${baseUrl}/browse-demos?${q({ bot_id: botId })}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load demos (${r.status})`);
  const data = await r.json();
  // API can return an array or { demos: [...] }
  return Array.isArray(data) ? data : (data?.demos ?? []);
};
