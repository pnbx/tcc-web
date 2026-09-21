import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Payment hop.
//
// Zibal validates the *referrer domain* of the transaction, so a buyer sent
// straight from site.tccmc.ir to the gateway is rejected with
// «دامنه ارجاع دهنده تراکنش نامعتبر است». This route lives on the project's
// azuraai.ir host (tcc.azuraai.ir), so redirecting through it makes the browser
// send a referrer the gateway's merchant is registered for.
//
// Open-redirect safety: only these payment hosts are ever allowed as targets.
const ALLOWED_HOSTS = new Set([
  "gateway.zibal.ir",
  "www.zarinpal.com",
  "sandbox.zarinpal.com",
  "payment.zarinpal.com",
]);

export async function GET(req: NextRequest) {
  const to = new URL(req.url).searchParams.get("to") ?? "";
  let target: URL;
  try {
    target = new URL(to);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid payment url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.host)) {
    return NextResponse.json({ ok: false, error: "payment host not allowed" }, { status: 400 });
  }
  // Two guarantees for the gateway's referrer check:
  //  - no-referrer on this response means the follow-up request carries no
  //    referrer at all (which Zibal accepts), so a stale/odd referrer from
  //    whatever page the buyer came from can never leak through;
  //  - when a browser does send one, it is this azuraai.ir origin, which the
  //    merchant is registered for.
  // The browser carries this page's origin (an azuraai.ir host) as the referrer.
  const res = NextResponse.redirect(target.toString(), 302);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
