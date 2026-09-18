import { NextResponse } from "next/server";
import { jobsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { sendTelegramNotif, jobCreatedNotif } from "@/lib/telegram";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const col = await jobsCol();
    const items = await col.find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ items: items.map((j) => ({ ...j, id: j._id.toString() })) });
  } catch (err) {
    return NextResponse.json({ error: "Gagal memuat job." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const col = await jobsCol();

    if (action === "create") {
      const { title, description, reward, maxCompletions, proofType, proofRequired, category, imageUrl } = body;
      if (!title || !reward) return NextResponse.json({ error: "Judul dan reward wajib diisi." }, { status: 400 });
      const maxComp = Number(maxCompletions ?? 0);
      const descTrimmed = String(description || "").trim();
      await col.insertOne({
        title: String(title).trim(),
        description: descTrimmed,
        reward: Number(reward),
        maxCompletions: maxComp,
        completedCount: 0,
        proofRequired: proofRequired !== false,
        proofType: String(proofType || "text"),
        category: String(category || "Umum").trim(),
        imageUrl: String(imageUrl || "").trim(),
        active: true,
        createdAt: new Date()
      });
      sendTelegramNotif(jobCreatedNotif({
        title: String(title).trim(),
        reward: Number(reward),
        category: String(category || "Umum").trim(),
        maxCompletions: maxComp,
        proofType: String(proofType || "text"),
        description: descTrimmed
      }));
      return NextResponse.json({ ok: true });
    }

    if (action === "edit") {
      const { id, title, description, reward, maxCompletions, proofType, proofRequired, category, imageUrl } = body;
      if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
      await col.updateOne(
        { _id: new ObjectId(id) },
        { $set: {
          title: String(title).trim(),
          description: String(description || "").trim(),
          reward: Number(reward),
          maxCompletions: Number(maxCompletions ?? 0),
          proofRequired: proofRequired !== false,
          proofType: String(proofType || "text"),
          category: String(category || "Umum").trim(),
          imageUrl: String(imageUrl || "").trim()
        }}
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "toggle") {
      const { id } = body;
      const j = await col.findOne({ _id: new ObjectId(id) });
      if (!j) return NextResponse.json({ error: "Job tidak ditemukan." }, { status: 404 });
      await col.updateOne({ _id: new ObjectId(id) }, { $set: { active: !j.active } });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body;
      await col.deleteOne({ _id: new ObjectId(id) });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (err) {
    console.error("[admin/jobs]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
