// Kerangka pemuatan (skeleton) bersama: pakai kelas `.skeleton` (shimmer) dari globals.css. Menggantikan teks "Memuat…" polos.
// Semua bersifat dekoratif (aria-hidden) dengan satu wadah role="status" supaya pembaca layar tetap diberi tahu.

/** Satu blok abu-abu berkilau. */
export function Skel({ className = "h-4 w-full", ...rest }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" {...rest} />;
}

/** Daftar baris (mis. riwayat, mutasi). */
export function SkelBaris({ jumlah = 5, tinggi = "h-14", className = "" }) {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="Memuat" data-testid="skeleton">
      {Array.from({ length: jumlah }).map((_, i) => <Skel key={i} className={`${tinggi} rounded-xl`} />)}
    </div>
  );
}

/** Kerangka satu halaman penuh: judul + deskripsi + beberapa kartu. */
export function SkelHalaman({ kartu = 3, className = "mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10" }) {
  return (
    <div className={className} role="status" aria-label="Memuat halaman" data-testid="skeleton-halaman">
      <Skel className="h-7 w-48" />
      <Skel className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: kartu }).map((_, i) => <Skel key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  );
}
