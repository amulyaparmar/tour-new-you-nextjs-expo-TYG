import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const sourceRoot = path.join(root, "store-ready-v4", "google");
const outputRoot = path.join(root, "play-console");
const screenshotsRoot = path.join(outputRoot, "phone-screenshots");
const iconSource = path.join(root, "..", "assets", "images", "adaptive-icon.png");
const screenshotBackground = "#F7F9FC";
const topBar = "#006CE5";

async function prepareScreenshot(inputPath, outputPath) {
  const metadata = await sharp(inputPath).metadata();
  if (metadata.width !== 1320 || metadata.height !== 2868) {
    throw new Error(`Unexpected screenshot size for ${path.basename(inputPath)}: ${metadata.width}x${metadata.height}`);
  }

  // Play Console allows portrait screenshots no taller than a 2:1 ratio.
  // Keep the complete source artwork, adding only a narrow matching margin.
  const topStrip = await sharp({
    create: { width: 1440, height: 11, channels: 3, background: topBar },
  }).png().toBuffer();

  await sharp(inputPath)
    .flatten({ background: screenshotBackground })
    .extend({ left: 60, right: 60, bottom: 12, background: screenshotBackground })
    .composite([{ input: topStrip, left: 0, top: 0 }])
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toFile(outputPath);
}

async function prepareFeatureGraphic() {
  await sharp(path.join(sourceRoot, "feature-graphic.png"))
    .flatten({ background: screenshotBackground })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(outputRoot, "feature-graphic.png"));
}

async function prepareIcon() {
  await sharp(iconSource)
    .resize(512, 512, { fit: "cover" })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(outputRoot, "app-icon.png"));
}

await fs.rm(screenshotsRoot, { recursive: true, force: true });
await fs.mkdir(screenshotsRoot, { recursive: true });

const screenshots = (await fs.readdir(path.join(sourceRoot, "phone-screenshots")))
  .filter((file) => file.endsWith(".png"))
  .sort();

for (const screenshot of screenshots) {
  await prepareScreenshot(
    path.join(sourceRoot, "phone-screenshots", screenshot),
    path.join(screenshotsRoot, screenshot.replace(/\.png$/, ".jpg")),
  );
}

await Promise.all([prepareFeatureGraphic(), prepareIcon()]);
console.log(`Generated ${screenshots.length} Play Console screenshots, one feature graphic, and one app icon.`);
