// Permanent derivative processor.
//
// Downloads each unprocessed original, generates thumb/display/large WebP
// copies (orientation applied, EXIF/GPS stripped), uploads them to the
// private family-derived bucket and records the paths on the media row.
// Once derivatives exist the app serves them instead of paying for
// on-demand transformations. Safe to rerun: it only touches media that
// isn't 'ready' unless --force is given.
//
// Usage:
//   npm run photos:process -- --all
//   npm run photos:process -- --adventure <adventure-id>
//   npm run photos:process -- --all --force   (reprocess everything)
import sharp from "sharp";
import { adminClient, loadEnv } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

const args = process.argv.slice(2);
const all = args.includes("--all");
const force = args.includes("--force");
const adventureFlag = args.indexOf("--adventure");
const adventureId = adventureFlag !== -1 ? args[adventureFlag + 1] : null;

if (!all && !adventureId) {
  console.log("Usage: npm run photos:process -- --all | --adventure <id> [--force]");
  process.exit(1);
}

const VARIANTS = [
  { name: "thumb", px: 600, quality: 75 },
  { name: "display", px: 1600, quality: 80 },
  { name: "large", px: 2400, quality: 84 },
];

let query = supabase
  .from("media")
  .select("id, original_path, mime_type, width, height, processing_status")
  .is("deleted_at", null)
  .not("mime_type", "like", "video/%"); // videos are handled by videos:process
if (!force) query = query.neq("processing_status", "ready");
if (adventureId) query = query.eq("adventure_id", adventureId);

const { data: mediaRows, error: queryError } = await query;
if (queryError) {
  console.error("Query failed:", queryError.message);
  process.exit(1);
}

console.log(`${mediaRows.length} photo(s) to process`);
let ok = 0;
let failed = 0;

for (const media of mediaRows) {
  const label = media.original_path;
  try {
    await supabase
      .from("media")
      .update({ processing_status: "processing" })
      .eq("id", media.id);

    const { data: blob, error: downloadError } = await supabase.storage
      .from("family-originals")
      .download(media.original_path);
    if (downloadError) throw new Error(`download: ${downloadError.message}`);
    const original = Buffer.from(await blob.arrayBuffer());

    const dir = media.original_path.replace(/\/original\.[^.]+$/, "");

    const build = async (tolerant) => {
      const options = tolerant ? { failOn: "none" } : {};
      const meta = await sharp(original, options).metadata();
      const swapped = (meta.orientation ?? 1) >= 5;
      const paths = {};

      for (const variant of VARIANTS) {
        // .rotate() bakes in EXIF orientation; sharp strips metadata by
        // default, so derivatives carry no EXIF/GPS.
        const buffer = await sharp(original, options)
          .rotate()
          .resize({
            width: variant.px,
            height: variant.px,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: variant.quality })
          .toBuffer();

        const target = `${dir}/${variant.name}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("family-derived")
          .upload(target, buffer, { contentType: "image/webp", upsert: true });
        if (uploadError) throw new Error(`upload ${variant.name}: ${uploadError.message}`);
        paths[variant.name] = target;
      }

      return {
        paths,
        width: swapped ? meta.height : meta.width,
        height: swapped ? meta.width : meta.height,
      };
    };

    // Some older phone JPEGs trip libjpeg's strict checks ("Invalid SOS
    // parameters") while decoding perfectly well — some 2018-era phone
    // photos do. Decode strictly first and only retry that one file
    // tolerantly, so a genuinely truncated upload still fails loudly instead
    // of quietly becoming a half-grey thumbnail.
    let built;
    try {
      built = await build(false);
    } catch (strictError) {
      if (strictError.message.startsWith("upload ")) throw strictError;
      console.log(`lenient ${label} (${strictError.message})`);
      built = await build(true);
    }
    const { paths, width, height } = built;

    await supabase
      .from("media")
      .update({
        thumbnail_path: paths.thumb,
        display_path: paths.display,
        large_path: paths.large,
        width: media.width ?? width ?? null,
        height: media.height ?? height ?? null,
        processing_status: "ready",
      })
      .eq("id", media.id);

    ok += 1;
    console.log(`ready  ${label}`);
  } catch (error) {
    failed += 1;
    await supabase
      .from("media")
      .update({ processing_status: "failed" })
      .eq("id", media.id);
    console.error(`FAILED ${label}: ${error.message}`);
  }
}

console.log(`\nDone: ${ok} processed, ${failed} failed.`);
if (failed > 0) {
  console.log(
    "Failed items are marked processing_status='failed'. HEIC originals can fail if this machine's sharp build lacks HEIF support — the app still shows them via on-demand fallback.",
  );
  process.exit(1);
}
