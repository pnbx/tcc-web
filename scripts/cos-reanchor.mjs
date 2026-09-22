// Re-anchor every cosmetics registry row to the new 200-tier Battle Pass ladder.
// Usage: node scripts/cos-reanchor.mjs <tcc-cosmetics.sk>
import fs from "node:fs/promises";

const file = process.argv[2];
if (!file) {
  console.log("usage: node scripts/cos-reanchor.mjs <tcc-cosmetics.sk>");
  process.exit(1);
}

// id -> new source (free spread over 6..150, premium over 20..200, prestige 1-6)
const MAP = {
  // kill effects
  neon_pulse: "bp_free_8", data_burst: "bp_free_26", circuit_break: "bp_free_48",
  hologram: "bp_free_72", ion_storm: "bp_free_110",
  glitch_shatter: "bp_prem_40", void_collapse: "bp_prem_80", null_error: "bp_prem_110",
  blue_screen: "bp_prem_150", blackout: "bp_prem_185",
  ascension: "prestige_1", system_god: "prestige_2", singularity: "prestige_3",
  overclock: "prestige_4", supernova: "prestige_5", entropy: "bp_prem_200",
  // announcers
  classic: "default", cyber_ops: "bp_free_14", neon_hud: "bp_free_40", killfeed: "bp_free_96",
  system_breach: "bp_prem_55", red_alert: "bp_prem_95",
  overlord: "prestige_1", deity: "prestige_3", warlord: "prestige_5", apocalypse: "prestige_4",
  // hit effects
  spark: "bp_free_6", pixel: "bp_free_30", frostbite: "bp_free_58", thunder: "bp_free_130",
  static: "bp_prem_20", glitch: "bp_prem_65", rot: "bp_prem_105", crimson_wound: "bp_prem_160",
  goldstrike: "prestige_1", shockwave: "prestige_3", soulburn: "prestige_5", annihilation: "prestige_6",
  // trails (bow tracers)
  neon_line: "bp_free_10", pixel_dust: "bp_free_34", ice_lane: "bp_free_64", hex_beam: "bp_free_122",
  corrupt_stream: "bp_prem_45", shadow: "bp_prem_85", venom: "bp_prem_125", ashfall: "bp_prem_170",
  halo_trail: "prestige_2", comet: "prestige_3", rainbow: "prestige_5", stardust: "prestige_4",
  // auras
  spark_aura: "bp_free_12", bubble_aura: "bp_free_44", snow_aura: "bp_free_84", pixel_aura: "bp_free_140",
  void_aura: "bp_prem_50", plague_aura: "bp_prem_90", sculk_aura: "bp_prem_135", inferno_aura: "bp_prem_180",
  gold_aura: "prestige_2", storm_aura: "prestige_4", celestial_aura: "prestige_5", singularity_aura: "prestige_6",
  // kill messages
  terminated: "bp_free_16", formatted: "bp_free_52", ping_check: "bp_free_100", logged_out: "bp_free_150",
  deleted: "bp_prem_75", corrupted_data: "bp_prem_115", overwritten: "bp_prem_155",
  ascended: "prestige_2", obliterated: "prestige_3", checkmate: "prestige_4", godslain: "prestige_5",
  erased: "prestige_6",
};

const text = await fs.readFile(file, "utf8");
const lines = text.split("\n");
let changed = 0;
const seen = new Set();
const missing = [];

const out = lines.map((line) => {
  const m = line.match(/^(\s*add ")([^|"]+)\|([^|"]+)\|([^|"]+)\|([^|"]+)\|([^|"]+)\|([^|"]+)\|([^"]+)(".*)$/);
  if (!m) return line;
  const [, pre, id, cat, tier, display, material, source, desc, post] = m;
  seen.add(id);
  if (!MAP[id]) {
    missing.push(id);
    return line;
  }
  if (MAP[id] === source) return line;
  changed++;
  return `${pre}${id}|${cat}|${tier}|${display}|${material}|${MAP[id]}|${desc}${post}`;
});

const unused = Object.keys(MAP).filter((k) => !seen.has(k));
await fs.writeFile(file, out.join("\n"), "utf8");
console.log(`registry rows re-anchored: ${changed}`);
console.log(`rows seen: ${seen.size} | map entries: ${Object.keys(MAP).length}`);
if (missing.length) console.log(`rows with no mapping: ${missing.join(", ")}`);
if (unused.length) console.log(`map entries with no row: ${unused.join(", ")}`);
