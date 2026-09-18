import { getAuth, hasPermission } from "@/lib/auth";
import { FileManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function DeveloperFilesPage() {
  const auth = await getAuth();
  if (!auth) return null;

  return (
    <div className="fade-up">
      <h1 className="font-display text-2xl font-black mb-2">مدیریت فایل‌های سرور</h1>
      <p className="text-sm text-[var(--c-text-dim)] mb-6">
        دسترسی محدود به ریشه‌ی سرور (سندباکس). مسیرهای حساس مثل کلیدها و فایل‌های env محافظت می‌شوند.
      </p>
      <FileManager
        canEdit={hasPermission(auth.permissions, "files.edit")}
        canCreate={hasPermission(auth.permissions, "files.create")}
        canDelete={hasPermission(auth.permissions, "files.delete")}
      />
    </div>
  );
}
