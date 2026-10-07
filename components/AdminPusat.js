"use client";

// Pusat Admin: pintu masuk ke semua dasbor, dengan angka yang perlu perhatian.
import Link from "next/link";
import { useEffect, useState } from "react";
import { DASBOR_ADMIN } from "@/components/AdminSwitcher";

export default function AdminPusat() {
  const [d, setD] = useState(null);
  useEffect(() => { fetch("/api/admin/pusat", { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.error) setD(x); }).catch(() => {}); }, []);
  const lencana = {
    pengguna: d ? `${d.dibekukan} dibekukan` : "",
    uang: d && d.depositManual ? `${d.depositManual} deposit manual menunggu` : "",
    setor: d && d.setorMenunggu ? `${d.setorMenunggu} setoran menunggu persetujuan` : "",
    konten: d && d.klaimGaransi ? `${d.klaimGaransi} klaim garansi menunggu` : ""
  };
  const mendesak = { setor: d && d.setorMenunggu > 0, uang: d && d.depositManual > 0, konten: d && d.klaimGaransi > 0 };
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <h1 className="font-display text-2xl font-black text-ink sm:text-3xl">Pusat Admin</h1>
      <p className="mt-1 text-sm text-muted">Tiap fitur punya dasbornya sendiri. Pilih yang ingin dikerjakan.</p>
      {d && <p className="mt-3 text-sm text-ink" data-testid="pusat-ringkas">👥 {d.totalUser.toLocaleString("id-ID")} pengguna · 🚫 {d.dibekukan} dibekukan</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="pusat-kartu">
        {DASBOR_ADMIN.filter((x) => x.id !== "pusat").map((x) => (
          <Link key={x.id} href={x.href} prefetch={false} data-testid={`kartu-${x.id}`} className={`hover-lift block rounded-2xl border-2 bg-surface p-4 shadow-soft ${mendesak[x.id] ? "border-amber" : "border-ink/15"}`}>
            <div className="flex items-center gap-2"><span className="text-2xl">{x.ikon}</span><b className="text-base text-ink">{x.label}</b></div>
            <p className="mt-1.5 text-xs text-muted">{x.ket}</p>
            {lencana[x.id] ? <p className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black ${mendesak[x.id] ? "bg-amber text-white" : "bg-surface2 text-ink"}`}>{lencana[x.id]}</p> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
