// POST /api/admin/import
// Body: multipart/form-data  OR  application/json
//   file  — JSON backup file (from /api/admin/export?type=backup)
//   mode  — "merge" | "safe" | "restore"
//           merge   → upsert every user (update existing, insert new)
//           safe    → only insert users whose token doesn't exist yet
//           restore → delete ALL users first, then insert backup
import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let payload;
  const ct = req.headers.get("content-type") || "";

  try {
    if (ct.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file) return NextResponse.json({ error: "Field 'file' tidak ditemukan." }, { status: 400 });
      const text = await file.text();
      payload = JSON.parse(text);
    } else {
      payload = await req.json();
    }
  } catch {
    return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
  }

  const mode = payload.mode || "merge";
  if (!["merge", "safe", "restore"].includes(mode)) {
    return NextResponse.json({ error: "Mode tidak valid. Gunakan: merge | safe | restore" }, { status: 400 });
  }

  if (!Array.isArray(payload.users) || payload.users.length === 0) {
    return NextResponse.json({ error: "Data 'users' kosong atau tidak valid." }, { status: 400 });
  }

  const users = await usersCol();

  try {
    if (mode === "restore") {
      await users.deleteMany({});
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const u of payload.users) {
      if (!u.token) { skipped++; continue; }

      // Remove _id so MongoDB can assign its own (prevents type mismatch)
      const { _id, ...doc } = u;

      if (mode === "safe") {
        const exists = await users.findOne({ token: u.token });
        if (exists) { skipped++; continue; }
        await users.insertOne({ ...doc, importedAt: new Date() });
        inserted++;
      } else {
        // merge or restore (after deleteMany restore behaves like insert)
        const res = await users.updateOne(
          { token: u.token },
          { $set: { ...doc, importedAt: new Date() } },
          { upsert: true }
        );
        if (res.upsertedCount > 0) inserted++;
        else updated++;
      }
    }

    return NextResponse.json({
      ok: true,
      mode,
      total: payload.users.length,
      inserted,
      updated,
      skipped,
    });
  } catch (err) {
    console.error("[admin/import]", err);
    return NextResponse.json({ error: "Gagal import data." }, { status: 500 });
  }
}
