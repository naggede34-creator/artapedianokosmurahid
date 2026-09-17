// Logika inti fitur Suntik Sosmed (SMM via Simuru):
// - normalisasi & cache layanan (harga diverifikasi server, bukan dari browser)
// - pembuatan pesanan dengan potong saldo atomik + refund kalau gagal
// - sinkron status + refund otomatis untuk pesanan batal / sebagian
import { smmOrdersCol, smmServicesCol, usersCol } from "@/lib/db";
import {
  getSmmServices,
  createSmmOrder,
  getSmmOrderStatus,
  listSmmOrders,
  normalizeSmmStatus,
  SimuruError
} from "@/lib/simuru";
import { getSettings } from "@/lib/settings";
import { logBalance } from "@/lib/ledger";
import { awardTransactionPoints } from "@/lib/loyalty";
import { sendTelegramNotif, smmOrderNotif, smmStatusNotif, providerAlertNotif } from "@/lib/telegram";

const CACHE_TTL_MS = 45 * 60 * 1000;
export const SMM_SETTLED_STATUSES = ["completed", "partial", "canceled", "refunded"];

// Hanya tipe layanan yang harganya bisa dihitung pasti (per 1.000) yang ditampilkan.
function isSupportedType(type) {
  const t = String(type || "default").toLowerCase();
  return t === "default" || t.includes("custom comment");
}

export function isCustomComments(type) {
  return String(type || "").toLowerCase().includes("custom comment");
}

export function sellPrice(basePrice, markupPercent) {
  return Math.ceil((Number(basePrice) || 0) * (1 + (Number(markupPercent) || 0) / 100));
}

export function calcCharge(pricePerUnit, quantity, pricePer = 1000) {
  return Math.max(1, Math.ceil(((Number(pricePerUnit) || 0) * (Number(quantity) || 0)) / (Number(pricePer) || 1000)));
}

function toCacheDoc(s) {
  return {
    _id: Number(s.id),
    name: s.name || "",
    title: s.title || s.name || "",
    platform: s.platform || "",
    kind: s.kind || "",
    targetType: s.target_type || "profile",
    type: s.type || "Default",
    basePrice: Number(s.price) || 0,
    pricePer: Number(s.price_per) || 1000,
    min: Number(s.min) || 1,
    max: Number(s.max) || 0,
    refill: Boolean(s.refill),
    featured: Boolean(s.featured),
    recommended: Boolean(s.recommended),
    note: s.note || null,
    startMinutes: s.start_minutes ?? null,
    speedPerDay: s.speed_per_day ?? null,
    speedLabel: s.speed_label || null,
    qualityTags: Array.isArray(s.quality_tags) ? s.quality_tags : [],
    quality: s.quality ?? null,
    completionRate: s.completion_rate ?? null,
    refundRate: s.refund_rate ?? null,
    evidence: s.evidence || null,
    updatedAt: new Date()
  };
}

export function toPublicService(doc, markupPercent) {
  return {
    id: doc._id,
    title: doc.title,
    name: doc.name,
    platform: doc.platform,
    kind: doc.kind,
    targetType: doc.targetType,
    customComments: isCustomComments(doc.type),
    price: sellPrice(doc.basePrice, markupPercent),
    pricePer: doc.pricePer,
    min: doc.min,
    max: doc.max,
    refill: doc.refill,
    featured: doc.featured,
    recommended: doc.recommended,
    note: doc.note,
    startMinutes: doc.startMinutes,
    speedPerDay: doc.speedPerDay,
    speedLabel: doc.speedLabel,
    qualityTags: doc.qualityTags,
    quality: doc.quality,
    completionRate: doc.completionRate,
    refundRate: doc.refundRate,
    evidence: doc.evidence
  };
}

// Ambil layanan dari Simuru, simpan ke cache, kembalikan versi publik (harga jual).
export async function fetchAndCacheServices({ platform, kind, q, featured }) {
  const raw = await getSmmServices({ platform, kind, q, featured, limit: 200 });
  const docs = raw.filter((s) => s && s.id && isSupportedType(s.type)).map(toCacheDoc);
  if (docs.length) {
    const col = await smmServicesCol();
    await col.bulkWrite(
      docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })),
      { ordered: false }
    );
  }
  return docs;
}

async function getVerifiedService(serviceId) {
  const col = await smmServicesCol();
  const cached = await col.findOne({ _id: Number(serviceId) });
  if (!cached) return null; // user hanya boleh memesan layanan yang pernah ditampilkan server
  const age = Date.now() - new Date(cached.updatedAt).getTime();
  if (age < CACHE_TTL_MS) return cached;

  // Cache kedaluwarsa → segarkan dari Simuru supaya harga tidak basi.
  try {
    const id = Number(serviceId);
    const fresh = await fetchAndCacheServices({ platform: cached.platform, kind: cached.kind, q: cached.title });
    let found = fresh.find((d) => d._id === id);
    if (!found) {
      const wider = await fetchAndCacheServices({ platform: cached.platform, kind: cached.kind });
      found = wider.find((d) => d._id === id);
    }
    return found || null;
  } catch (err) {
    // Simuru sementara tidak bisa dihubungi: pakai cache yang belum terlalu tua.
    return age < 6 * 60 * 60 * 1000 ? cached : null;
  }
}

function newOrderId() {
  return `SM${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
}

function cleanTarget(target) {
  return String(target || "").trim().slice(0, 1024);
}

// ------------------------------------------------------------------ ORDER

export class SmmUserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function placeSmmOrder({ token, serviceId, target, quantity, comments }) {
  const settings = await getSettings();
  if (!settings.smm?.enabled) throw new SmmUserError("Fitur suntik sosmed sedang dinonaktifkan admin.");

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) throw new SmmUserError("Kode akun tidak ditemukan.", 404);

  const svc = await getVerifiedService(serviceId);
  if (!svc) throw new SmmUserError("Layanan ini sudah tidak tersedia. Muat ulang daftar layanan.");

  const tgt = cleanTarget(target);
  if (tgt.length < 3) throw new SmmUserError("Link / username target wajib diisi.");

  let qty = Math.floor(Number(quantity));
  let customComments = null;
  if (isCustomComments(svc.type)) {
    const lines = String(comments || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10000);
    if (!lines.length) throw new SmmUserError("Tulis minimal satu komentar (satu baris satu komentar).");
    qty = lines.length;
    customComments = lines.join("\n").slice(0, 10000);
  }
  if (!Number.isFinite(qty) || qty < svc.min || (svc.max && qty > svc.max)) {
    throw new SmmUserError(
      `Jumlah harus antara ${svc.min.toLocaleString("id-ID")} - ${Number(svc.max || 0).toLocaleString("id-ID")}.`
    );
  }

  const unitPrice = sellPrice(svc.basePrice, settings.smm.markupPercent);
  const charge = calcCharge(unitPrice, qty, svc.pricePer);

  // Cegah dobel klik: pesanan identik dalam 20 detik terakhir ditolak.
  const orders = await smmOrdersCol();
  const dup = await orders.findOne({
    token,
    serviceId: svc._id,
    target: tgt,
    quantity: qty,
    createdAt: { $gte: new Date(Date.now() - 20 * 1000) }
  });
  if (dup) throw new SmmUserError("Pesanan yang sama baru saja dibuat. Cek di Riwayat.", 429);

  const debited = await users.findOneAndUpdate(
    { token, balance: { $gte: charge } },
    { $inc: { balance: -charge } },
    { returnDocument: "after" }
  );
  if (!debited) {
    throw new SmmUserError(`Saldo tidak cukup. Total Rp${charge.toLocaleString("id-ID")}, silakan deposit dulu.`);
  }

  const id = newOrderId();
  const startedAt = new Date();
  await orders.insertOne({
    id,
    token,
    providerOrderId: null,
    serviceId: svc._id,
    serviceTitle: svc.title,
    serviceName: svc.name,
    platform: svc.platform,
    kind: svc.kind,
    targetType: svc.targetType,
    target: tgt,
    quantity: qty,
    hasCustomComments: Boolean(customComments),
    pricePer1k: unitPrice,
    pricePer: svc.pricePer,
    basePricePer1k: svc.basePrice,
    charge,
    status: "submitting",
    startCount: null,
    remains: null,
    refundedAmount: 0,
    settled: false,
    refill: svc.refill,
    speedLabel: svc.speedLabel,
    createdAt: startedAt,
    updatedAt: startedAt
  });

  const refundAll = async (reason) => {
    const claimed = await orders.findOneAndUpdate(
      { id, settled: false },
      { $set: { status: "failed", settled: true, refundedAmount: charge, failReason: reason, updatedAt: new Date() } }
    );
    if (!claimed) return null;
    const u = await users.findOneAndUpdate({ token }, { $inc: { balance: charge } }, { returnDocument: "after" });
    return u?.balance;
  };

  let result;
  try {
    result = await createSmmOrder({ serviceId: svc._id, target: tgt, quantity: customComments ? undefined : qty, customComments });
  } catch (err) {
    if (err instanceof SimuruError && err.ambiguous) {
      // Tidak ada respons: cek apakah pesanan sebenarnya sudah terbuat di Simuru.
      const found = await findRecentProviderOrder({ target: tgt, quantity: qty, since: startedAt });
      if (found) {
        result = { data: found };
      }
    }
    if (!result) {
      const reason = err?.message || "Gagal membuat pesanan di provider.";
      await refundAll(reason);
      if (/saldo|balance|insufficient/i.test(reason) || err?.status === 401) {
        sendTelegramNotif(providerAlertNotif({ provider: "Simuru", action: "Order suntik sosmed", message: reason }));
      }
      throw new SmmUserError(`${reason} Saldo kamu tidak terpotong.`);
    }
  }

  const data = result.data || {};
  const providerOrderId = data.id ? String(data.id) : null;
  if (!providerOrderId) {
    await refundAll("Respons provider tidak lengkap.");
    throw new SmmUserError("Provider tidak mengembalikan nomor pesanan. Saldo kamu tidak terpotong.");
  }

  const status = normalizeSmmStatus(data.status || "processing");
  await orders.updateOne(
    { id },
    {
      $set: {
        providerOrderId,
        status,
        providerPrice: Number(data.price) || null,
        startCount: data.start_count ?? null,
        remains: data.remains ?? null,
        updatedAt: new Date()
      }
    }
  );

  await logBalance({
    token,
    type: "smm",
    amount: -charge,
    balanceAfter: debited.balance,
    title: `Suntik ${svc.platform} ${svc.kind} · ${qty.toLocaleString("id-ID")}`,
    ref: id
  });

  sendTelegramNotif(
    smmOrderNotif({
      id,
      providerOrderId,
      platform: svc.platform,
      kind: svc.kind,
      serviceTitle: svc.title,
      target: tgt,
      quantity: qty,
      pricePer1k: unitPrice,
      charge,
      token,
      name: user.name,
      balance: debited.balance,
      speedLabel: svc.speedLabel
    })
  );

  return {
    id,
    providerOrderId,
    status,
    charge,
    quantity: qty,
    balance: debited.balance
  };
}

async function findRecentProviderOrder({ target, quantity, since }) {
  try {
    const list = await listSmmOrders(20);
    const sinceMs = since.getTime() - 60 * 1000;
    return (
      list.find(
        (o) =>
          String(o.target || "").trim() === target &&
          Number(o.quantity) === Number(quantity) &&
          new Date(o.created_at).getTime() >= sinceMs
      ) || null
    );
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ STATUS

export async function syncSmmOrder(order) {
  if (order.settled || !order.providerOrderId) return order;

  const orders = await smmOrdersCol();
  const data = await getSmmOrderStatus(order.providerOrderId);
  const status = normalizeSmmStatus(data.status);
  const remains = data.remains ?? order.remains ?? null;
  const patch = {
    status,
    startCount: data.start_count ?? order.startCount ?? null,
    remains,
    canRefill: Boolean(data.can_refill),
    refillRequested: Boolean(data.refill_requested),
    providerRefunded: Boolean(data.refunded),
    refundState: data.refund_state || null,
    lastSyncAt: new Date(),
    updatedAt: new Date()
  };

  let refundAmount = 0;
  let shouldSettle = false;
  if (status === "canceled" || status === "refunded" || (status === "error" && data.refunded)) {
    refundAmount = order.charge;
    shouldSettle = true;
  } else if (status === "partial") {
    const rem = Math.max(0, Number(remains) || 0);
    refundAmount = order.quantity > 0 ? Math.floor((order.charge * Math.min(rem, order.quantity)) / order.quantity) : 0;
    shouldSettle = true;
  } else if (status === "completed") {
    shouldSettle = true;
  }

  if (!shouldSettle) {
    await orders.updateOne({ id: order.id }, { $set: patch });
    return { ...order, ...patch };
  }

  const claimed = await orders.findOneAndUpdate(
    { id: order.id, settled: { $ne: true } },
    { $set: { ...patch, settled: true, refundedAmount: refundAmount, finalAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!claimed) {
    return (await orders.findOne({ id: order.id })) || { ...order, ...patch };
  }

  const users = await usersCol();
  if (refundAmount > 0) {
    const u = await users.findOneAndUpdate(
      { token: order.token },
      { $inc: { balance: refundAmount } },
      { returnDocument: "after" }
    );
    await logBalance({
      token: order.token,
      type: "smm_refund",
      amount: refundAmount,
      balanceAfter: u?.balance,
      title: `Refund suntik ${order.platform} (${status === "partial" ? "sebagian" : "batal"})`,
      ref: order.id
    });
  }

  const spent = order.charge - refundAmount;
  if (spent > 0 && (status === "completed" || status === "partial")) {
    await awardTransactionPoints(order.token, spent).catch(() => {});
  }

  sendTelegramNotif(
    smmStatusNotif({
      id: order.id,
      platform: order.platform,
      serviceTitle: order.serviceTitle,
      target: order.target,
      quantity: order.quantity,
      status,
      startCount: patch.startCount,
      remains,
      refundAmount,
      token: order.token,
      createdAt: order.createdAt
    })
  );

  return claimed;
}

export function toPublicOrder(o) {
  return {
    id: o.id,
    providerOrderId: o.providerOrderId,
    serviceTitle: o.serviceTitle,
    platform: o.platform,
    kind: o.kind,
    target: o.target,
    quantity: o.quantity,
    pricePer1k: o.pricePer1k,
    charge: o.charge,
    status: o.status,
    startCount: o.startCount ?? null,
    remains: o.remains ?? null,
    refundedAmount: o.refundedAmount || 0,
    settled: Boolean(o.settled),
    refill: Boolean(o.refill),
    canRefill: Boolean(o.canRefill),
    refillRequested: Boolean(o.refillRequested),
    speedLabel: o.speedLabel || null,
    failReason: o.failReason || null,
    createdAt: o.createdAt,
    finalAt: o.finalAt || null
  };
}
