import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SHOP_ITEMS = [
  { id: "v500", name: "Voucher Rp500", desc: "Tambah saldo Rp500 langsung", icon: "💵", pointsCost: 180, reward: { type: "saldo", amount: 500 }, stock: -1 },
  { id: "v1000", name: "Voucher Rp1.000", desc: "Tambah saldo Rp1.000 langsung", icon: "💶", pointsCost: 340, reward: { type: "saldo", amount: 1000 }, stock: -1 },
  { id: "v2000", name: "Voucher Rp2.000", desc: "Tambah saldo Rp2.000 langsung", icon: "💷", pointsCost: 650, reward: { type: "saldo", amount: 2000 }, stock: -1 },
  { id: "v5000", name: "Voucher Rp5.000", desc: "Tambah saldo Rp5.000 langsung", icon: "💸", pointsCost: 1500, reward: { type: "saldo", amount: 5000 }, stock: -1 },
  { id: "spin1", name: "1x Putaran Roda", desc: "Dapatkan 1 putaran roda keberuntungan gratis", icon: "🎡", pointsCost: 80, reward: { type: "spin", amount: 1 }, stock: -1 },
  { id: "discount10", name: "Diskon OTP 10%", desc: "Diskon 10% untuk 1 pembelian OTP berikutnya", icon: "🏷️", pointsCost: 120, reward: { type: "discount", amount: 10 }, stock: -1 },
  { id: "cashback5", name: "Cashback 5%", desc: "Cashback 5% untuk 1 deposit berikutnya", icon: "🔄", pointsCost: 200, reward: { type: "cashback", amount: 5 }, stock: -1 },
];

export async function GET() {
  return NextResponse.json({ items: SHOP_ITEMS });
}
