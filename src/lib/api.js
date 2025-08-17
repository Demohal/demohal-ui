const q = (obj) => new URLSearchParams(obj).toString();

export const getBotByAlias = async (baseUrl, alias) => {
  const r = await fetch(`${baseUrl}/bot-by-alias?${q({ alias })}`);
  if (!r.ok) throw new Error("Failed to load bot");
  return r.json();
};

export const listDemos = async (baseUrl, botId) => {
  const r = await fetch(`${baseUrl}/browse-demos?${q({ bot_id: botId })}`);
  if (!r.ok) throw new Error("Failed to load demos");
  return r.json();
};
