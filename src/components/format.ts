export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n); // Latin digits, stable with .num styling
}

export function formatKd(kills: number, deaths: number): string {
  if (deaths === 0) return kills > 0 ? formatNumber(kills) : "—";
  return (kills / deaths).toFixed(2);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "همین حالا";
  if (mins < 60) return `${mins} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} روز پیش`;
  return formatDate(date);
}

export function formatPlaytime(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} دقیقه`;
  return `${formatNumber(h)} ساعت${m ? ` و ${m} دقیقه` : ""}`;
}

export function priceLabel(cents: number, currency = "IRT"): string {
  const unit = currency === "IRT" ? "تومان" : currency;
  return `${formatNumber(cents)} ${unit}`;
}
