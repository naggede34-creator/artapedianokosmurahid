import { usersCol } from "@/lib/db";

export async function getTokenFromApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string" || apiKey.length !== 32) return null;
  const col = await usersCol();
  const user = await col.findOne({ apiKey }, { projection: { token: 1 } });
  return user?.token || null;
}

export async function getUserByApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string" || apiKey.length !== 32) return null;
  const col = await usersCol();
  return col.findOne({ apiKey }, { projection: { token: 1, balance: 1, name: 1 } });
}
