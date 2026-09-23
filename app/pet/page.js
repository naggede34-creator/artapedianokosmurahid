"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import { PageHeader, Icon, Alert, Spinner, Badge } from "@/components/ui";

// Pet Arta Pedia: elang peliharaan yang tumbuh dari telur sampai juara.
//
// Halaman ini hanya MENAMPILKAN. Batas perawatan sekali sehari dan besar
// bonusnya ditentukan server — tombol yang dimatikan di sini cuma supaya tidak
// ada ketukan yang sia-sia, bukan sebagai penjaga aturannya.

const TAHAP_URUT = [
  { key: "telur", nama: "Telur", level: 0 },
  { key: "bayi", nama: "Bayi", level: 2 },
  { key: "remaja", nama: "Remaja", level: 8 },
  { key: "dewasa", nama: "Dewasa", level: 16 },
  { key: "juara", nama: "Juara", level: 25 }
];

export default function PetPage() {
  const { token } = useUser();
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState(null);
  const [naikLevel, setNaikLevel] = useState(false);
  const [editNama, setEditNama] = useState(false);
  const [namaDraft, setNamaDraft] = useState("");

  const muat = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/pet?token=${encodeURIComponent(token)}`);
      const d = await res.json();
      setData(d);
      if (d.pet) setNamaDraft(d.pet.nama);
    } catch {
      setData(null);
    } finally {
      setMemuat(false);
    }
  }, [token]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function rawat(action) {
    if (!token || sibuk) return;
    setSibuk(action);
    setPesan(null);
    try {
      const res = await fetch("/api/pet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action })
      });
      const d = await res.json();
      if (!res.ok) {
        setPesan({ ok: false, teks: d.error || "Gagal." });
        return;
      }
      setData((s) => ({ ...s, pet: d.pet }));
      setPesan({
        ok: true,
        teks: d.naikLevel
          ? `Naik ke level ${d.pet.level}! Bonus cashback jadi +${d.pet.bonusCashback}%.`
          : `+${d.xpDidapat} XP. ${action === "makan" ? "Kenyang!" : "Senang banget!"}`
      });
      if (d.naikLevel) {
        setNaikLevel(true);
        setTimeout(() => setNaikLevel(false), 2200);
      }
    } catch {
      setPesan({ ok: false, teks: "Koneksi terputus." });
    } finally {
      setSibuk("");
      setTimeout(() => setPesan(null), 4000);
    }
  }

  async function simpanNama() {
    if (!token || !namaDraft.trim()) return;
    setSibuk("nama");
    try {
      const res = await fetch("/api/pet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "nama", nama: namaDraft })
      });
      const d = await res.json();
      if (res.ok) {
        setData((s) => ({ ...s, pet: d.pet }));
        setEditNama(false);
      }
    } finally {
      setSibuk("");
    }
  }

  const pet = data?.pet;

  if (memuat) {
    return (
      <div className="mx-auto max-w-content px-4 py-10 text-center sm:px-5">
        <Spinner className="mx-auto h-8 w-8 text-amber-bright" />
        <p className="mt-3 text-sm text-muted">Menengok kandang…</p>
      </div>
    );
  }

  if (data && data.enabled === false) {
    return (
      <div className="mx-auto max-w-content px-4 py-10 sm:px-5">
        <Alert tone="amber">Fitur Pet sedang dimatikan admin. Coba lagi nanti ya.</Alert>
      </div>
    );
  }

  return (
    <div className="user-dash mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader
        icon={<span className="text-xl">🥚</span>}
        title="Pet Arta Pedia"
        desc="Rawat elangmu tiap hari. Makin tinggi levelnya, makin besar bonus cashback tiap kamu isi saldo."
      />

      {!token ? (
        <Alert className="mt-6">Kode akunmu belum siap. Muat ulang halaman ini sebentar lagi.</Alert>
      ) : !pet ? (
        <Alert className="mt-6">Gagal memuat pet. Coba muat ulang halaman.</Alert>
      ) : (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Kandang ─────────────────────────────────────────── */}
          <div className="pet-kandang panel-3d relative overflow-hidden p-6 text-center">
            <span className="pet-halftone" />
            <span className="pet-sinar" />

            {naikLevel && <span className="pet-levelup">LEVEL UP!</span>}

            <div className="relative z-10">
              <Badge tone="amber">{pet.tahapNama}</Badge>

              <div className="pet-panggung mt-3">
                {pet.tahap === "telur" ? (
                  <div className="pet-telur" aria-label="Telur elang">
                    <span className="pet-telur-retak" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/maskot-sm.webp"
                    alt={pet.nama}
                    width={528}
                    height={750}
                    className={`pet-elang ${sibuk === "main" ? "is-main" : ""} ${sibuk === "makan" ? "is-makan" : ""}`}
                    style={{ "--skala": pet.skala }}
                  />
                )}
                <span className="pet-bayang" />
              </div>

              {editNama ? (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <input
                    value={namaDraft}
                    onChange={(e) => setNamaDraft(e.target.value.slice(0, 20))}
                    className="field w-40 text-center"
                    aria-label="Nama pet"
                  />
                  <button onClick={simpanNama} disabled={sibuk === "nama"} className="btn-primary px-3 py-2 text-xs">
                    Simpan
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditNama(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-xl font-extrabold text-ink"
                >
                  {pet.nama}
                  <span className="text-xs font-semibold text-amber-bright">ubah</span>
                </button>
              )}
              <p className="mt-0.5 text-xs text-muted">{pet.tahapSub}</p>

              {/* Level & XP */}
              <div className="mt-5">
                <div className="flex items-end justify-between text-xs">
                  <span className="font-black text-ink">Level {pet.level}</span>
                  <span className="text-muted">
                    {pet.level >= pet.levelMaks ? "Level tertinggi" : `${pet.xpDiLevel}/${pet.xpButuh} XP`}
                  </span>
                </div>
                <div className="pet-bar mt-1.5">
                  <span style={{ width: `${pet.persenKeLevelBerikut}%` }} />
                </div>
              </div>

              {pesan && (
                <Alert tone={pesan.ok ? "green" : "amber"} className="mt-4">
                  {pesan.teks}
                </Alert>
              )}

              {/* Perawatan */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => rawat("makan")}
                  disabled={pet.sudahMakanHariIni || sibuk === "makan"}
                  className="pet-tombol"
                >
                  <span className="pet-tombol-emoji">🍖</span>
                  <span className="pet-tombol-judul">{pet.sudahMakanHariIni ? "Sudah makan" : "Beri makan"}</span>
                  <span className="pet-tombol-sub">{pet.sudahMakanHariIni ? "besok lagi ya" : "sekali sehari"}</span>
                </button>
                <button
                  onClick={() => rawat("main")}
                  disabled={pet.sudahMainHariIni || sibuk === "main"}
                  className="pet-tombol"
                >
                  <span className="pet-tombol-emoji">🪁</span>
                  <span className="pet-tombol-judul">{pet.sudahMainHariIni ? "Sudah main" : "Ajak main"}</span>
                  <span className="pet-tombol-sub">{pet.sudahMainHariIni ? "besok lagi ya" : "sekali sehari"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Keterangan ──────────────────────────────────────── */}
          <aside className="space-y-4">
            <div className="panel-3d glow-3d p-5 text-center">
              <p className="text-xs font-semibold text-muted">Bonus cashback dari petmu</p>
              <p className="mt-1 text-4xl font-black text-amber-bright">+{pet.bonusCashback}%</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Ditambahkan ke cashback tiap kali kamu isi saldo. Naik terus tiap level, sampai maksimal
                +{data?.config?.maxBonus ?? 2}%.
              </p>
              <Link href="/deposit" className="btn-primary mt-4 w-full">
                Isi saldo sekarang
              </Link>
            </div>

            <div className="card p-5">
              <h2 className="text-base font-bold text-ink">Tahap pertumbuhan</h2>
              <div className="mt-3 space-y-2">
                {TAHAP_URUT.map((t) => {
                  const tercapai = pet.level >= t.level;
                  const sekarang = pet.tahap === t.key;
                  return (
                    <div
                      key={t.key}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
                        sekarang ? "bg-amber-soft font-black text-amber-bright" : tercapai ? "text-ink" : "text-muted opacity-70"
                      }`}
                    >
                      <span>
                        {tercapai ? "✓" : "○"} {t.nama}
                      </span>
                      <span>Level {t.level}+</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-flat p-5">
              <h2 className="text-base font-bold text-ink">Cara petmu tumbuh</h2>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted">
                <li>Beri makan dan ajak main — masing-masing sekali sehari.</li>
                <li>Dia tetap tumbuh pelan walau kamu sedang sibuk, tapi jauh lebih lambat.</li>
                <li>Tiap level menambah bonus cashback deposit secara permanen.</li>
                <li>
                  Sudah dirawat <b className="text-ink">{pet.totalHariDirawat} hari</b>, umur{" "}
                  <b className="text-ink">{pet.umurHari} hari</b>.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
