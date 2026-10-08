// Web reseller milik pengguna. Semua aksi WAJIB membawa kode akun pemiliknya; kepemilikan diperiksa di
// dalam kueri (webMilik(token)), bukan dipercaya dari body.
import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { infoWdGateway } from "@/lib/gatewayWd";
import {
  rwAktif, rwMarkupMaks, rwOpsiTautan, urlWeb, webMilik, buatWeb, ubahWeb, tarikKomisiWeb, statistikWeb, publikWeb
} from "@/lib/webReseller";
import { WD_MIN_WEB, BIAYA_WD_WEB } from "@/lib/webResellerUi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const H = { "Cache-Control": "no-store" };

async function pemilik(token) {
  if (!token) return null;
  return (await usersCol()).findOne({ token }, { projection: { token: 1, suspended: 1 } });
}

async function ringkas(user) {
  const settings = await getSettings();
  const opsi = await rwOpsiTautan(settings);
  const web = await webMilik(user.token);
  const wd = await infoWdGateway().catch(() => null);
  return {
    aktif: await rwAktif(),
    markupMaks: await rwMarkupMaks(),
    wd: { min: Math.max(WD_MIN_WEB, wd?.min || 0), biaya: BIAYA_WD_WEB, dompet: wd?.dompet || [], otomatis: !!wd?.otomatis },
    subdomain: opsi.subdomain,
    contohDomain: opsi.subdomain ? `.${opsi.induk}` : "",
    web: web ? publikWeb(web, urlWeb(web.slug, opsi)) : null,
    tautanAlt: web ? urlWeb(web.slug, { ...opsi, subdomain: false }) : null,
    statistik: web ? await statistikWeb(web) : null
  };
}

export async function GET(req) {
  const user = await pemilik(new URL(req.url).searchParams.get("token"));
  if (!user) return NextResponse.json({ error: "Kode akun tidak dikenali." }, { status: 401, headers: H });
  return NextResponse.json(await ringkas(user), { headers: H });
}

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak sah." }, { status: 400, headers: H });
  const user = await pemilik(body.token);
  if (!user) return NextResponse.json({ error: "Kode akun tidak dikenali." }, { status: 401, headers: H });
  if (user.suspended) return NextResponse.json({ error: "Akun kamu sedang ditangguhkan." }, { status: 403, headers: H });

  const aksi = String(body.aksi || "");
  try {
    let r;
    if (aksi === "buat") r = await buatWeb({ token: user.token, slug: body.slug, nama: body.nama, markupPersen: body.markupPersen, setuju: body.setuju === true });
    else if (aksi === "ubah") r = await ubahWeb(user.token, { nama: body.nama, markupPersen: body.markupPersen, aktif: body.aktif });
    else if (aksi === "tarik") {
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
      r = await tarikKomisiWeb({ token: user.token, amount: body.amount, ewallet: body.ewallet, nomor: body.nomor, atasNama: body.atasNama, ip });
      if (r.ok) return NextResponse.json({ ok: true, penarikan: r.penarikan, otomatis: r.otomatis, ...(await ringkas(user)) }, { headers: H });
    } else return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400, headers: H });

    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400, headers: H });
    return NextResponse.json({ ok: true, ...(await ringkas(user)) }, { headers: H });
  } catch (e) {
    console.error("[web-reseller]", e?.message || e);
    return NextResponse.json({ error: "Gagal memproses. Coba lagi." }, { status: 500, headers: H });
  }
}
