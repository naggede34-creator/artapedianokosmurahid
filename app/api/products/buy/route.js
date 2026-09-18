import { NextResponse } from "next/server";
import { productsCol, productOrdersCol, usersCol } from "@/lib/db";
import { logBalance } from "@/lib/ledger";
import { rateLimit } from "@/lib/rateLimit";
import { sendTelegramNotif, productBoughtNotif } from "@/lib/telegram";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:product-buy`, 10, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
    }

    const { token, productId } = await req.json().catch(() => ({}));
    if (!token || !productId) return NextResponse.json({ error: "Token dan produk wajib diisi." }, { status: 400 });

    let oid;
    try { oid = new ObjectId(productId); } catch { return NextResponse.json({ error: "ID produk tidak valid." }, { status: 400 }); }

    const products = await productsCol();
    const product = await products.findOne({ _id: oid, active: true });
    if (!product) return NextResponse.json({ error: "Produk tidak ditemukan atau tidak aktif." }, { status: 404 });

    if (product.stock !== -1 && product.stock <= 0) {
      return NextResponse.json({ error: "Stok produk habis." }, { status: 400 });
    }

    const users = await usersCol();
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    if ((user.balance || 0) < product.price) {
      return NextResponse.json({ error: "Saldo tidak cukup." }, { status: 400 });
    }

    // Debit saldo
    const debited = await users.findOneAndUpdate(
      { token, balance: { $gte: product.price } },
      { $inc: { balance: -product.price } },
      { returnDocument: "after" }
    );
    if (!debited) return NextResponse.json({ error: "Saldo tidak cukup atau akun tidak ditemukan." }, { status: 400 });

    // Kurangi stok jika bukan unlimited
    if (product.stock !== -1) {
      await products.updateOne({ _id: oid }, { $inc: { stock: -1 } });
    }

    const ref = `PD${Date.now()}`;
    const orders = await productOrdersCol();
    await orders.insertOne({
      token,
      productId: oid,
      productName: product.name,
      price: product.price,
      deliveryType: product.deliveryType,
      deliveryContent: product.deliveryContent,
      ref,
      purchasedAt: new Date()
    });

    await logBalance({
      token,
      type: "product_buy",
      amount: -product.price,
      balanceAfter: debited.balance,
      title: `Beli: ${product.name}`,
      ref
    });

    sendTelegramNotif(productBoughtNotif({
      productName: product.name,
      price: product.price,
      category: product.category,
      deliveryType: product.deliveryType,
      token,
      name: user.name || null,
      balance: debited.balance,
      ref
    }));

    return NextResponse.json({
      ok: true,
      balance: debited.balance,
      ref,
      deliveryType: product.deliveryType,
      deliveryContent: product.deliveryContent,
      productName: product.name
    });
  } catch (err) {
    console.error("[products/buy]", err);
    return NextResponse.json({ error: "Gagal memproses pembelian." }, { status: 500 });
  }
}
