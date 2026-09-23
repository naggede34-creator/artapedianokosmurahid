import { NextResponse } from "next/server";
import { jobSubmissionsCol, usersCol, jobsCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { isAdminRequest } from "@/lib/adminAuth";
import { jobApprovedNotif, jobApprovedPublicNotif } from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";
    const col = await jobSubmissionsCol();
    const items = await col
      .find(status === "all" ? {} : { status })
      .sort({ submittedAt: -1 })
      .limit(100)
      .toArray();
    return NextResponse.json({ items: items.map((s) => ({ ...s, id: s._id.toString(), jobId: s.jobId.toString() })) });
  } catch (err) {
    return NextResponse.json({ error: "Gagal memuat." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { action, id, rejectionReason } = await req.json().catch(() => ({}));
    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Aksi dan ID wajib diisi." }, { status: 400 });
    }

    const col = await jobSubmissionsCol();
    const sub = await col.findOne({ _id: new ObjectId(id) });
    if (!sub) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
    if (sub.status !== "pending") return NextResponse.json({ error: "Pengajuan sudah diproses." }, { status: 400 });

    if (action === "reject") {
      await col.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "rejected", rejectionReason: String(rejectionReason || "").trim(), reviewedAt: new Date() } }
      );
      return NextResponse.json({ ok: true });
    }

    // approve: credit balance
    const users = await usersCol();
    const updatedUser = await users.findOneAndUpdate(
      { token: sub.token },
      { $inc: { balance: sub.reward } },
      { returnDocument: "after" }
    );
    if (!updatedUser) return NextResponse.json({ error: "Akun user tidak ditemukan." }, { status: 404 });

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "approved", reviewedAt: new Date() } }
    );

    const jobs = await jobsCol();
    const updatedJob = await jobs.findOneAndUpdate(
      { _id: sub.jobId },
      { $inc: { completedCount: 1 } },
      { returnDocument: "after" }
    );

    await logBalance({
      token: sub.token,
      type: "job_reward",
      amount: sub.reward,
      balanceAfter: updatedUser.balance,
      title: `Job selesai: ${sub.jobTitle}`,
      ref: id
    });

    const userInfo = await users.findOne({ token: sub.token }, { projection: { name: 1 } });
    umumkan({
      jenis: "job",
      admin: jobApprovedNotif({
        jobTitle: sub.jobTitle,
        reward: sub.reward,
        token: sub.token,
        name: userInfo?.name || null,
        balance: updatedUser.balance,
        completedCount: updatedJob?.completedCount ?? 1,
        maxCompletions: updatedJob?.maxCompletions ?? 0,
        submittedAt: sub.submittedAt
      }),
      publik: jobApprovedPublicNotif({
        jobTitle: sub.jobTitle,
        reward: sub.reward,
        token: sub.token
      })
    });

    return NextResponse.json({ ok: true, balance: updatedUser.balance });
  } catch (err) {
    console.error("[admin/jobs/submissions]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
