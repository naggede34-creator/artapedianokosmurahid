export default function SignalCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-amber/10 blur-2xl" />
      <div className="card-shadow rounded-3xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Nomor OTP aktif</span>
          <span className="flex items-center gap-1.5 text-xs text-teal-bright">
            <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-teal" />
            Menunggu kode
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-surface2 p-4">
          <p className="text-xs text-muted">Layanan</p>
          <p className="mt-1 font-display text-base text-ink">WhatsApp — Indonesia</p>
          <p className="mt-3 text-xs text-muted">Nomor</p>
          <p className="mt-1 font-mono text-lg text-ink">+62 812-••••-9931</p>
        </div>

        <div className="mt-4 rounded-xl border border-teal/30 bg-teal-soft p-4 code-reveal">
          <p className="text-xs text-teal-bright">Kode masuk</p>
          <p className="mt-1 font-mono text-2xl tracking-[0.3em] text-ink">482 913</p>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>Diproses otomatis</span>
          <span>± 8 detik</span>
        </div>
      </div>
    </div>
  );
}
