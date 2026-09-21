import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Payment hop.
//
// Zibal rejects a payment when the browser sends an invalid *referrer*, and with
// a plain 302 the buyer's original page (site.tccmc.ir) can still travel with the
// redirect chain. So this route serves a tiny interstitial document that:
//   - declares no-referrer itself, so the follow-up request carries no referrer
//     at all (Zibal accepts a request without a referrer), and
//   - links to the gateway with rel="noreferrer" as a manual fallback.
// The page lives on the project's azuraai.ir host, which the merchant is
// registered for, so even a browser that does send one sends a valid origin.
//
// Open-redirect safety: only these payment hosts are ever allowed as targets.
const ALLOWED_HOSTS = new Set([
  "gateway.zibal.ir",
  "www.zarinpal.com",
  "sandbox.zarinpal.com",
  "payment.zarinpal.com",
]);

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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

  const url = escapeHtml(target.toString());
  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<meta http-equiv="refresh" content="0;url=${url}" />
<title>در حال انتقال به درگاه پرداخت…</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0812;color:#ece9f4;
       font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
  .box{text-align:center;padding:2rem}
  .spinner{width:38px;height:38px;margin:0 auto 1.25rem;border-radius:50%;border:3px solid #332a47;border-top-color:#f472b6;
           animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  a{color:#f472b6}
  p{margin:.4rem 0;font-size:.95rem}
</style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <p>در حال انتقال به درگاه پرداخت…</p>
    <p><a href="${url}" rel="noreferrer">اگر منتقل نشدی، اینجا کلیک کن</a></p>
  </div>
  <script>location.replace(${JSON.stringify(target.toString())});</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
