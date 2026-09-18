export function TierBadge({ name, position, total }: { name: string; position?: number; total?: number }) {
  let style = "tier-low";
  if (typeof position === "number" && typeof total === "number" && total > 0) {
    const rank = position / total; // 0 = best
    if (rank <= 0.2) style = "tier-elite";
    else if (rank <= 0.4) style = "tier-high";
    else if (rank <= 0.7) style = "tier-mid";
  }
  return <span className={`tier-badge ${style}`}>{name}</span>;
}
