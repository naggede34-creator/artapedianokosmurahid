// Penyimpanan akun di peramban untuk web reseller. Akun web reseller TERPISAH dari web utama: di mode tab
// (/r/nama, sessionStorage terisi) kode akun disimpan di kunci tersendiri per web, sehingga akun web utama tidak
// otomatis terpakai di web reseller (dan sebaliknya). Di mode subdomain localStorage sudah terpisah per host.
const SLUG = /^[a-z0-9-]{3,24}$/;

function slugTab() {
  try {
    const s = sessionStorage.getItem("artapedia_rw");
    return s && SLUG.test(s) ? s : "";
  } catch {
    return "";
  }
}

export const kunciTokenRw = () => { const s = slugTab(); return s ? `artapedia_token_rw_${s}` : "artapedia_token"; };
export const kunciKeluarRw = () => { const s = slugTab(); return s ? `artapedia_keluar_rw_${s}` : "artapedia_keluar"; };
