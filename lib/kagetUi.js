// Pembantu tampilan Saldo Kaget (aman dipakai di browser).
import { rupiah } from "@/components/ui";

export function sisaWaktu(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!(ms > 0)) return "berakhir";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "< 1 menit lagi";
  if (m < 60) return `${m} menit lagi`;
  const j = Math.floor(m / 60);
  return j < 24 ? `${j} jam ${m % 60} mnt lagi` : `${Math.floor(j / 24)} hari lagi`;
}

export function tautanKaget(kid) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/kaget/${kid}`;
}

export function teksBagikan({ pembuat, total, jumlah, kid }) {
  return `🧧 Ada Saldo Kaget dari ${pembuat || "temanmu"}! ${rupiah(total)} dibagi ke ${jumlah} orang — siapa cepat dia dapat.\nAmbil sekarang: ${tautanKaget(kid)}`;
}

