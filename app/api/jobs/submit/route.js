import { NextResponse } from "next/server";
import { jobsCol, jobSubmissionsCol, usersCol } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:job-submit`, 5, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
    }

    const { token, jobId, proof } = await req.json().catch(() => ({}));
    if (!token || !jobId) return NextResponse.json({ error: "Token dan ID job wajib diisi." }, { status: 400 });

    let oid;
    try { oid = new ObjectId(jobId); } catch { return NextResponse.json({ error: "ID job tidak valid." }, { status: 400 }); }

    const jobs = await jobsCol();
    const job = await jobs.findOne({ _id: oid, active: true });
    if (!job) return NextResponse.json({ error: "Job tidak ditemukan atau tidak aktif." }, { status: 404 });
    if (job.maxCompletions > 0 && job.completedCount >= job.maxCompletions) {
      return NextResponse.json({ error: "Kuota job ini sudah penuh." }, { status: 400 });
    }

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    // Cek apakah user sudah pernah submit job ini
    const submissions = await jobSubmissionsCol();
    const existing = await submissions.findOne({ token, jobId: oid, status: { $in: ["pending", "approved"] } });
    if (existing) {
      const msg = existing.status === "approved"
        ? "Kamu sudah menyelesaikan job ini."
        : "Pengajuanmu sedang menunggu review admin.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (job.proofRequired && !proof?.trim()) {
      return NextResponse.json({ error: "Bukti penyelesaian wajib dilampirkan." }, { status: 400 });
    }

    await submissions.insertOne({
      token,
      jobId: oid,
      jobTitle: job.title,
      reward: job.reward,
      proof: String(proof || "").trim(),
      status: "pending",
      submittedAt: new Date()
    });

    return NextResponse.json({ ok: true, message: "Pengajuan berhasil dikirim. Tunggu review admin, saldo akan masuk otomatis jika disetujui." });
  } catch (err) {
    console.error("[jobs/submit]", err);
    return NextResponse.json({ error: "Gagal mengirim pengajuan." }, { status: 500 });
  }
}
