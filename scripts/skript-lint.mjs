// Cheap pre-flight checks for Skript files: indentation, quote/percent balance.
// Usage: node scripts/skript-lint.mjs <file> [file...]
import fs from "node:fs/promises";

const files = process.argv.slice(2);
let problems = 0;

for (const file of files) {
  const text = await fs.readFile(file, "utf8");
  const lines = text.split("\n");
  const tabs = lines.filter((l) => /^\t+/.test(l)).length;
  const spaces = lines.filter((l) => /^ +\S/.test(l)).length;
  const mixed = lines.filter((l) => /^ *\t/.test(l)).length;
  console.log(`\n=== ${file} ===`);
  console.log(`lines=${lines.length} tab-indented=${tabs} space-indented=${spaces} mixed=${mixed}`);

  lines.forEach((line, i) => {
    const n = i + 1;
    const raw = line.replace(/\r$/, "");
    const body = raw.trim();
    if (!body || body.startsWith("#")) return;

    const indent = raw.length - raw.trimStart().length;
    const indentText = raw.slice(0, indent);
    if (indentText.includes("\t") && indentText.includes(" ")) {
      console.log(`  ${n}: mixed tabs/spaces in indentation`);
      problems++;
    }
    if (indentText.includes(" ") && /^ +\S/.test(raw) && raw.includes("\t")) {
      console.log(`  ${n}: tab after spaces`);
      problems++;
    }
    const quotes = (body.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      console.log(`  ${n}: odd number of double quotes -> ${body.slice(0, 90)}`);
      problems++;
    }
    const pct = (body.match(/%/g) || []).length;
    if (pct % 2 !== 0) {
      console.log(`  ${n}: odd number of % -> ${body.slice(0, 90)}`);
      problems++;
    }
    if (/[^\x00-\x7F]/.test(body) && !/^\s*(add|set name|send|broadcast|return|cos_|function)/.test(body)) {
      // non-ascii is fine (icons), just informational for odd places
    }
  });
}

console.log(`\ntotal problems: ${problems}`);
process.exit(problems ? 1 : 0);
