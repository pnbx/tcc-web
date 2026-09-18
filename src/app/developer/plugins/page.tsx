import { getMinecraft } from "@/lib/mc";

export const dynamic = "force-dynamic";

export default async function DeveloperPluginsPage() {
  const mc = getMinecraft();
  const caps = mc.capabilityReport();

  return (
    <div className="fade-up space-y-6">
      <h1 className="font-display text-2xl font-black">پلاگین‌های سرور</h1>
      {!caps.plugins.available ? (
        <div className="card p-6 text-sm text-[var(--c-text-dim)]">
          {caps.plugins.reason}
        </div>
      ) : (
        <PluginsList />
      )}
    </div>
  );
}

async function PluginsList() {
  const mc = getMinecraft();
  const plugins = await mc.listPlugins().catch(() => []);
  if (plugins.length === 0) {
    return <div className="card p-6 text-sm text-[var(--c-text-dim)]">پلاگینی گزارش نشد.</div>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>نام</th>
            <th>نسخه</th>
            <th>وضعیت</th>
            <th>سازندگان</th>
          </tr>
        </thead>
        <tbody>
          {plugins.map((p) => (
            <tr key={p.name}>
              <td className="font-ui font-semibold">{p.name}</td>
              <td className="mono text-xs">{p.version ?? "—"}</td>
              <td>
                <span className={`badge ${p.enabled ? "badge-green" : "badge-red"}`}>{p.enabled ? "فعال" : "غیرفعال"}</span>
              </td>
              <td className="text-xs">{p.authors.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
