import axios from "axios";

const BASE_URL = "https://api.neoxr.eu/api/gpt4";
// Fallback ke apikey yang diberikan supaya tetap jalan meski env belum diisi,
// tapi sebaiknya di production diset lewat env var NEOXR_API_KEY di Vercel.
const DEFAULT_API_KEY = "kePcDc";

export async function askCsAi(prompt) {
  const apikey = process.env.NEOXR_API_KEY || DEFAULT_API_KEY;

  const { data } = await axios.get(BASE_URL, {
    params: { q: prompt, apikey },
    timeout: 25000
  });

  if (!data || data.status === false) {
    throw new Error(data?.message || "AI CS sedang tidak bisa merespons.");
  }

  const reply = data?.data?.message || data?.message;
  if (!reply) throw new Error("AI CS tidak memberikan balasan.");
  return reply;
}
