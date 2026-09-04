// Generates the PWA icon set from an inline SVG using sharp.
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Warm amber background, simple white mountain range + sun
const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#b45309"/>
  <circle cx="368" cy="150" r="52" fill="#fde68a"/>
  <path d="M32 400 L176 176 L256 300 L316 216 L480 400 Z" fill="#fff7ed"/>
  <path d="M32 400 L176 176 L232 264 L152 400 Z" fill="#fed7aa" opacity="0.85"/>
</svg>`;

const outDir = path.join(root, "public", "icons");
await mkdir(outDir, { recursive: true });

const jobs = [
  { file: path.join(outDir, "icon-192.png"), size: 192, maskable: false },
  { file: path.join(outDir, "icon-512.png"), size: 512, maskable: false },
  { file: path.join(outDir, "icon-maskable-512.png"), size: 512, maskable: true },
  { file: path.join(root, "src", "app", "apple-icon.png"), size: 180, maskable: true },
];

for (const job of jobs) {
  await sharp(Buffer.from(svg(job.maskable)))
    .resize(job.size, job.size)
    .png()
    .toFile(job.file);
  console.log("wrote", job.file);
}
