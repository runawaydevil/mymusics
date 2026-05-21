import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

const PROJECT_ROOT = process.cwd();
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

const SOURCE = path.join(PROJECT_ROOT, "data", "metadata.tsv");
const OUT = path.join(PROJECT_ROOT, "data", "metadata.sample.tsv");
const MAX_LINES = Number(process.env.SAMPLE_LINES ?? "500");

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(SOURCE, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const slice = lines.slice(0, MAX_LINES);
  fs.writeFileSync(OUT, `${slice.join("\n")}\n`, "utf-8");
  console.info(`Wrote ${slice.length} lines to ${OUT}`);
}

main();
