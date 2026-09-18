"use client";

import { useCallback, useEffect, useState } from "react";

type Entry = { name: string; path: string; type: "file" | "dir"; size: number | null; modifiedAt: string | null };

export function FileManager({
  canEdit,
  canCreate,
  canDelete,
}: {
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const [dir, setDir] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ path: string; line: number; text: string }[] | null>(null);
  const [selected, setSelected] = useState<{ path: string; content: string; truncated: boolean; binary: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (d: string) => {
    setError("");
    setSearchResults(null);
    const res = await fetch(`/api/files?dir=${encodeURIComponent(d)}`);
    const json = await res.json();
    if (json.ok) {
      setEntries(json.data.entries ?? []);
      setDir(d);
    } else {
      setError(json.error ?? "خطا");
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  async function openFile(path: string) {
    setError("");
    const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`);
    const json = await res.json();
    if (json.ok) {
      setSelected({
        path,
        content: json.data.file.content ?? "",
        truncated: json.data.file.truncated,
        binary: json.data.file.encoding === "binary",
      });
      setDirty(false);
    } else {
      setError(json.error ?? "خطا در خواندن فایل");
    }
  }

  async function saveFile() {
    if (!selected) return;
    const res = await fetch("/api/files/content", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: selected.path, content: selected.content }),
    });
    const json = await res.json();
    setMsg(json.ok ? "ذخیره شد ✓" : json.error ?? "خطا");
    if (json.ok) setDirty(false);
  }

  async function op(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setMsg(json.ok ? "انجام شد ✓" : json.error ?? "خطا");
    if (json.ok) load(dir);
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    const res = await fetch(`/api/files?dir=${encodeURIComponent(dir)}&q=${encodeURIComponent(search)}`);
    const json = await res.json();
    if (json.ok) setSearchResults(json.data.search ?? []);
    else setError(json.error ?? "خطا");
  }

  function crumbs(path: string) {
    const parts = path ? path.split("/") : [];
    return (
      <div className="flex items-center gap-1 flex-wrap text-xs mono">
        <button className="hover:text-[var(--c-pink)]" onClick={() => load("")}>/</button>
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <button className="hover:text-[var(--c-pink)]" onClick={() => load(parts.slice(0, i + 1).join("/"))}>
              {p}
            </button>
            {i < parts.length - 1 && <span className="text-[var(--c-text-faint)]">/</span>}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
      {/* browser */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          {crumbs(dir)}
          <div className="flex gap-2">
            {canCreate && (
              <>
                <button
                  className="btn btn-ghost !py-1 !px-2 text-xs"
                  onClick={() => {
                    const name = window.prompt("نام پوشه جدید:");
                    if (name) op({ op: "mkdir", path: dir ? `${dir}/${name}` : name });
                  }}
                >
                  + پوشه
                </button>
                <button
                  className="btn btn-ghost !py-1 !px-2 text-xs"
                  onClick={() => {
                    const name = window.prompt("نام فایل جدید:");
                    if (name) op({ op: "create", path: dir ? `${dir}/${name}` : name, content: "" });
                  }}
                >
                  + فایل
                </button>
              </>
            )}
          </div>
        </div>

        <form onSubmit={runSearch} className="flex gap-2 mb-4">
          <input className="input ltr !py-1.5 text-xs" placeholder="جستجوی متن در فایل‌ها…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-ghost !py-1.5 text-xs">جستجو</button>
        </form>

        {error && <div className="badge badge-red mb-3">{error}</div>}
        {msg && <div className="badge badge-green mb-3">{msg}</div>}

        {searchResults ? (
          <div className="max-h-96 overflow-auto space-y-1">
            <button className="text-xs text-[var(--c-pink)]" onClick={() => setSearchResults(null)}>← بستن نتایج</button>
            {searchResults.map((r, i) => (
              <button
                key={i}
                className="block w-full text-start text-xs mono p-1.5 rounded hover:bg-[rgba(139,92,246,0.06)]"
                onClick={() => openFile(r.path)}
              >
                <span className="text-[var(--c-pink)]">{r.path}:{r.line}</span>
                <span className="block text-[var(--c-text-faint)] truncate">{r.text}</span>
              </button>
            ))}
            {searchResults.length === 0 && <div className="text-xs text-[var(--c-text-faint)]">نتیجه‌ای نیست.</div>}
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            {dir && (
              <button className="block w-full text-start text-sm px-2 py-1.5 rounded hover:bg-[rgba(139,92,246,0.06)]" onClick={() => load(parentOf(dir))}>
                <span className="mono">..</span>
              </button>
            )}
            {entries.map((e) => (
              <div key={e.path} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[rgba(139,92,246,0.06)]">
                <button className="flex-1 text-start text-sm truncate" onClick={() => (e.type === "dir" ? load(e.path) : openFile(e.path))}>
                  <span className="mono text-xs">{e.type === "dir" ? "📁" : "▫"}</span>{" "}
                  <span className={e.type === "dir" ? "font-ui font-semibold" : "mono text-xs"}>{e.name}</span>
                </button>
                {e.type === "file" && e.size != null && (
                  <span className="text-[10px] text-[var(--c-text-faint)] num">{(e.size / 1024).toFixed(1)}k</span>
                )}
                {canDelete && (
                  <button
                    className="opacity-0 group-hover:opacity-100 text-xs text-[var(--c-red)]"
                    onClick={() => op({ op: "delete", path: e.path }, `«${e.name}» حذف شود؟`)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {entries.length === 0 && <div className="text-xs text-[var(--c-text-faint)] p-2">پوشه خالی است.</div>}
          </div>
        )}
      </div>

      {/* viewer / editor */}
      <div className="card p-5 flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="mono text-xs text-[var(--c-text-dim)] select-all">{selected.path}</span>
              <div className="flex gap-2">
                {canEdit && !selected.binary && (
                  <button className={`btn ${dirty ? "btn-primary" : "btn-ghost"} !py-1 !px-2 text-xs`} onClick={saveFile} disabled={!dirty}>
                    ذخیره
                  </button>
                )}
                <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setSelected(null)}>بستن</button>
              </div>
            </div>
            {selected.binary ? (
              <div className="text-sm text-[var(--c-text-dim)]">فایل باینری — نمایش/ویرایش متنی ممکن نیست.</div>
            ) : (
              <textarea
                className="textarea ltr mono !text-xs flex-1 min-h-96"
                value={selected.content}
                readOnly={!canEdit}
                onChange={(e) => {
                  setSelected({ ...selected, content: e.target.value });
                  setDirty(true);
                }}
                spellCheck={false}
              />
            )}
            {selected.truncated && (
              <div className="badge badge-amber mt-3">فایل بزرگ است — فقط بخش ابتدایی نمایش داده شد.</div>
            )}
          </>
        ) : (
          <div className="text-sm text-[var(--c-text-faint)] m-auto">فایلی را برای مشاهده انتخاب کنید</div>
        )}
      </div>
    </div>
  );
}

function parentOf(dir: string): string {
  const parts = dir.split("/");
  parts.pop();
  return parts.join("/");
}
