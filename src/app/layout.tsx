import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { MC_HOST } from "@/lib/mc";

export const metadata: Metadata = {
  title: {
    default: "TCC Minecraft — شبکه ماینکرفت TCC",
    template: "%s | TCC Minecraft",
  },
  description:
    "وب‌سایت رسمی شبکه ماینکرفت TCC — لیست تیر، استور، اخبار و پروفایل بازیکنان.",
  metadataBase: new URL(process.env.PAYMENT_PROVIDER_CALLBACK_BASE || "https://site.tccmc.ir"),
};

export const viewport: Viewport = {
  themeColor: "#0a0812",
};

// Font slot remapping is injected server-side from DB settings so the whole
// site (public, panels, console) follows the admin typography config.
async function FontSlotOverrides() {
  const settings = await getSettings();
  const f = settings.fonts;
  const stack = (name: string, fallbacks: string[]) =>
    `"${name}", ${fallbacks.map((x) => `"${x}"`).join(", ")}, ui-sans-serif, system-ui, sans-serif`;

  const css = `
:root {
  --font-display: ${stack(f.display, ["Peyda", "Estedad", "Vazirmatn"])};
  --font-heading: ${stack(f.heading, ["Dana", "Peyda", "Estedad", "Vazirmatn"])};
  --font-ui: ${stack(f.ui, ["Peyda", "Vazirmatn", "Estedad"])};
  --font-body: ${stack(f.body, ["Estedad", "Vazirmatn"])};
}
`;
  return <style>{css}</style>;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <FontSlotOverrides />
        {children}
        <footer className="border-t hairline mt-16">
          <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-3 text-sm">
            <div>
              <div className="font-heading font-extrabold text-lg">
                TCC <span className="text-[var(--c-pink)]">Minecraft</span>
              </div>
              <p className="text-[var(--c-text-dim)] mt-2 leading-6">
                شبکه بازی ماینکرفت — لیگ تیر، استور و جامعه‌ی بازیکنان.
              </p>
              <p className="mono text-xs text-[var(--c-text-faint)] mt-3 select-all">{MC_HOST}</p>
            </div>
            <div>
              <div className="font-ui font-semibold text-[var(--c-text)] mb-3">پیوندها</div>
              <ul className="space-y-2 text-[var(--c-text-dim)]">
                <li><Link href="/tiers" className="hover:text-[var(--c-pink)]">لیست تیر</Link></li>
                <li><Link href="/news" className="hover:text-[var(--c-pink)]">اخبار</Link></li>
                <li><Link href="/store" className="hover:text-[var(--c-pink)]">استور</Link></li>
                <li><Link href="/players" className="hover:text-[var(--c-pink)]">بازیکنان</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-ui font-semibold text-[var(--c-text)] mb-3">حساب کاربری</div>
              <ul className="space-y-2 text-[var(--c-text-dim)]">
                <li><Link href="/login" className="hover:text-[var(--c-pink)]">ورود</Link></li>
                <li><Link href="/dashboard" className="hover:text-[var(--c-pink)]">پنل کاربری</Link></li>
                <li><Link href="/dashboard/profile" className="hover:text-[var(--c-pink)]">پروفایل</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t hairline py-4 text-center text-xs text-[var(--c-text-faint)]">
            © {new Date().getFullYear()} TCC Minecraft — site.tccmc.ir
          </div>
        </footer>
      </body>
    </html>
  );
}
