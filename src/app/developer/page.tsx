import { prisma } from "@/lib/db";
import { getCachedStatus, getMinecraft, MC_HOST } from "@/lib/mc";
import { formatNumber } from "@/components/format";
import { isFileSandboxConfigured } from "@/lib/mc/files-server";

export const dynamic = "force-dynamic";

export default async function DeveloperOverview() {
  const [status, caps] = await Promise.all([getCachedStatus(), Promise.resolve(getMinecraft().capabilityReport())]);
  const sandboxReady = isFileSandboxConfigured();

  const capRows = Object.entries(caps);

  return (
    <div className="fade-up space-y-8">
      <div>
        <h1 className="font-display text-2xl font-black">نمای کلی توسعه‌دهنده</h1>
        <p className="text-sm text-[var(--c-text-dim)] mt-1">
          سرور <span className="mono">{MC_HOST}</span> — وضعیت واقعی، بدون داده ساختگی.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-5">
          <div className="text-xs text-[var(--c-text-faint)] mb-1">وضعیت سرور</div>
          <div className={`num text-lg font-bold ${status.online ? "text-[var(--c-green)]" : "text-[var(--c-red)]"}`}>
            {status.online ? `آنلاین — ${formatNumber(status.playersOnline ?? 0)} بازیکن` : "آفلاین"}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-[var(--c-text-faint)] mb-1">منبع یکپارچگی</div>
          <div className="mono text-sm">{getMinecraft().name.toUpperCase()}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-[var(--c-text-faint)] mb-1">سندباکس فایل</div>
          <div className={`text-sm font-semibold ${sandboxReady ? "text-[var(--c-green)]" : "text-[var(--c-amber)]"}`}>
            {sandboxReady ? "پیکربندی شده" : "SERVER_FILES_ROOT تنظیم نشده"}
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-heading font-bold mb-3">قابلیت‌ها</h2>
        <div className="card divide-y" style={{ borderColor: "var(--c-border)" }}>
          {capRows.map(([cap, info]) => (
            <div key={cap} className="flex items-start gap-3 px-5 py-3">
              <span className={`inline-block w-2 h-2 rounded-full mt-1.5 ${info.available ? "bg-[var(--c-green)]" : "bg-[var(--c-amber)]"}`} />
              <span className="mono text-sm w-28">{cap}</span>
              <span className="text-xs text-[var(--c-text-dim)]">{info.reason ?? "در دسترس"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
