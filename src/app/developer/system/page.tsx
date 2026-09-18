import { getAuth, hasPermission } from "@/lib/auth";
import { MC_HOST, MC_PORT } from "@/lib/mc";

export const dynamic = "force-dynamic";

export default async function DeveloperSystemPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const canManage = hasPermission(auth.permissions, "settings.manage");
  const integrations = [
    {
      name: "BRIDGE_URL",
      set: !!process.env.BRIDGE_URL,
      note: "HTTP endpoint پلاگین TCC Bridge روی سرور (localhost)",
    },
    { name: "BRIDGE_TOKEN", set: !!process.env.BRIDGE_TOKEN, note: "توکن مشترک احراز هویت بریج" },
    { name: "RCON_HOST/PORT", set: !!process.env.RCON_HOST, note: "RCON فقط به‌صورت fallback و پشت فایروال" },
    { name: "SERVER_FILES_ROOT", set: !!process.env.SERVER_FILES_ROOT, note: "ریشه سندباکس فایل برای پنل توسعه‌دهنده" },
    { name: "SESSION_SECRET", set: !!process.env.SESSION_SECRET, note: "امضای کوکی نشست‌ها" },
    { name: "PAYMENT_PROVIDER", set: !!process.env.PAYMENT_PROVIDER_MERCHANT_ID, note: "شناسه پذیرنده درگاه" },
  ];

  return (
    <div className="fade-up space-y-8">
      <div>
        <h1 className="font-display text-2xl font-black">سیستم</h1>
        <p className="text-sm text-[var(--c-text-dim)] mt-1">
          سرور ماینکرفت: <span className="mono select-all">{MC_HOST}:{MC_PORT}</span>
        </p>
      </div>

      <section>
        <h2 className="font-heading font-bold mb-3">یکپارچگی‌ها (فقط وضعیت — مقادیر محرمانه هرگز نمایش داده نمی‌شوند)</h2>
        <div className="card divide-y" style={{ borderColor: "var(--c-border)" }}>
          {integrations.map((i) => (
            <div key={i.name} className="flex items-center gap-3 px-5 py-3">
              <span className={`inline-block w-2 h-2 rounded-full ${i.set ? "bg-[var(--c-green)]" : "bg-[var(--c-amber)]"}`} />
              <span className="mono text-sm w-44">{i.name}</span>
              <span className="text-xs text-[var(--c-text-faint)]">{i.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-heading font-bold mb-2">نکته‌های عملیاتی</h2>
        <ul className="text-sm text-[var(--c-text-dim)] space-y-2 list-disc ps-5 leading-7">
          <li>RCON هرگز نباید عمومی باشد؛ فقط localhost یا VPN.</li>
          <li>برای کنسول زنده و کنترل قدرت، پلاگین TCC Bridge را مستقر کنید.</li>
          <li>تمام اقدامات حساس در جدول audit_logs با نام کاربر ثبت می‌شود.</li>
          {canManage && <li>شما اجازه‌ی ویرایش تنظیمات پلتفرم (فونت‌ها، استور) را دارید.</li>}
        </ul>
      </section>
    </div>
  );
}
