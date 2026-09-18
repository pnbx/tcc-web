import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { getPaymentProvider, dispatchProductCommands } from "@/lib/payments";
import { audit } from "@/lib/audit";

// The provider redirects the user back here (Zibal: ?order=...&trackId=...&success=1).
// Verification is done SERVER-TO-SERVER via the provider interface before anything
// is granted; the user is then redirected to the result page, which only displays
// DB state and can never mark an order paid itself.

function resultRedirect(req: NextRequest, orderNumber: string): NextResponse {
  const base = process.env.PAYMENT_PROVIDER_CALLBACK_BASE || new URL(req.url).origin;
  return NextResponse.redirect(`${base}/store/result/${encodeURIComponent(orderNumber)}`, 303);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orderNumber =
      url.searchParams.get("order") ?? url.searchParams.get("orderId") ?? "";
    if (!orderNumber) return jsonError("order required", 400);

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { payments: true, items: { include: { product: true } } },
    });
    if (!order) return jsonError("order not found", 404);
    if (order.status === "PAID") return resultRedirect(req, orderNumber);

    const payment = order.payments.find((p) => p.status === "PENDING") ?? order.payments[0];
    if (!payment) return jsonError("payment not found", 404);

    const fail = async () => {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      await audit({ actorName: "system", action: "store.payment_failed", target: orderNumber });
      return resultRedirect(req, orderNumber);
    };

    // Zibal signals the user abandoned/cancelled with success=0 — no point verifying.
    if (url.searchParams.get("success") === "0") return await fail();

    const provider = getPaymentProvider();
    const ref =
      url.searchParams.get("trackId") ?? url.searchParams.get("ref") ?? url.searchParams.get("Authority") ?? payment.providerRef ?? "";
    const verification = await provider.verifyPayment({ providerRef: ref, amountCents: order.totalCents });

    if (!verification.verified) return await fail();

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "VERIFIED", verifiedAt: new Date(), providerRef: ref || payment.providerRef },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), providerRef: ref || payment.providerRef },
    });

    // Grant products + execute Minecraft commands (bridge/RCON) asynchronously.
    dispatchProductCommands({ orderId: order.id, userId: order.userId, targetUsername: order.items[0]?.targetUsername })
      .catch((err) => console.error("[store.dispatch]", err));

    await audit({ actorName: "system", action: "store.payment_verified", target: orderNumber, detail: { amount: order.totalCents } });
    return resultRedirect(req, orderNumber);
  } catch (err) {
    return jsonError((err as Error).message || "payment verification failed", 500);
  }
}

export const POST = GET;
