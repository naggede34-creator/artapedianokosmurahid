import { DEFAULT_SERVER } from "@/lib/otpServers";
import { NextResponse } from "next/server";
import { resolveApiKey, jsonV1 } from "@/lib/apiKeyAuth";
import { otpOrdersCol } from "@/lib/db";
import { reconcileOtpOrder } from "@/lib/orderReconcile";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { user, error } = await resolveApiKey(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order_id");
  if (!orderId) return jsonV1(req, { error: "order_id is required." }, { status: 400 });

  const orders = await otpOrdersCol();
  const order = await orders.findOne({ orderId, token: user.token });
  if (!order) return jsonV1(req, { error: "Order not found." }, { status: 404 });

  try {
    const r = await reconcileOtpOrder(order);
    return jsonV1(req, {
      orderId: order.orderId,
      server: order.server || DEFAULT_SERVER,
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
    return jsonV1(req, { error: "Failed to check order status." }, { status: 500 });
  }
}
