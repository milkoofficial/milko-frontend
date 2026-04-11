import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const transcriptPath = path.join(
  process.env.USERPROFILE,
  ".cursor",
  "projects",
  "c-Users-GOPES-OneDrive-Desktop-milko",
  "agent-transcripts",
  "12407478-0e05-42e1-8a6c-cb14b580c357",
  "12407478-0e05-42e1-8a6c-cb14b580c357.jsonl"
);

const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
let svg = null;
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const o = JSON.parse(line);
    const t = o?.message?.content?.[0]?.text;
    if (t && t.includes("<?xml") && t.includes("put this svg")) {
      const start = t.indexOf("<?xml");
      const end = t.lastIndexOf("</svg>");
      if (start >= 0 && end > start) {
        svg = t.slice(start, end + "</svg>".length);
        break;
      }
    }
  } catch {
    /* skip */
  }
}

if (!svg) {
  console.error("SVG not found in transcript");
  process.exit(1);
}

const outDir = path.join(repoRoot, "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "admin-live-location-marker.svg");
fs.writeFileSync(out, svg, "utf8");
console.log("Wrote", out, Buffer.byteLength(svg, "utf8"), "bytes");
