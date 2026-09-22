// Replace bare `return` lines with `stop` (Skript: a value-less return is invalid),
// and report what changed. Usage: node scripts/skript-fix-return.mjs <file> [...]
import fs from "node:fs/promises";

for (const file of process.argv.slice(2)) {
  const text = await fs.readFile(file, "utf8");
  const lines = text.split("\n");
  const hits = [];
  const out = lines.map((line, i) => {
    const trimmed = line.trim();
    if (trimmed === "return") {
      hits.push(i + 1);
      return line.replace(/return\s*$/, "stop");
    }
    return line;
  });
  await fs.writeFile(file, out.join("\n"), "utf8");
  console.log(`${file}: replaced ${hits.length} bare return(s) -> stop  [lines: ${hits.join(", ") || "-"}]`);
}
