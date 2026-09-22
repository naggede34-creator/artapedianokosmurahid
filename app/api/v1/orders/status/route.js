import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { otpOrdersCol } from "@/lib/db";
import { reconcileOtpOrder } from "@/lib/orderReconcile";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { user, error } = await resolveApiKey(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order_id");
  if (!orderId) return NextResponse.json({ error: "order_id is required." }, { status: 400 });

  const orders = await otpOrdersCol();
  const order = await orders.findOne({ orderId, token: user.token });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  try {
    const r = await reconcileOtpOrder(order);
    return NextResponse.json({
      orderId: order.orderId,
      server: order.server || "rumahotp",
      status: r.resolvedStatus,
      otpCode: r.otpCode || null,
      otpMsg: r.otpMsg || null,
      phoneNumber: order.phoneNumber,
      serviceName: order.serviceName,
      countryName: order.countryName,
      price: order.price,
      refunded: r.refunded ? true : order.refunded || false,
      createdAt: order.createdAt
    });
  } catch {
    return NextResponse.json({ error: "Failed to check order status." }, { status: 500 });
  }
}
