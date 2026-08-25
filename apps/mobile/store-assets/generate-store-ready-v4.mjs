import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const sourceRoot = path.join(root, "source", "ios");
const outputRoot = path.join(root, "store-ready-v4");
const appleRoot = path.join(outputRoot, "apple", "iphone-6.9");
const googleRoot = path.join(outputRoot, "google", "phone-screenshots");

const width = 1320;
const height = 2868;
const fontFamily = "System Font";

const slides = [
  {
    file: "01-every-tour-one-place.png",
    source: "session-history.png",
    label: "TOUR HISTORY",
    title: ["Every tour,", "all in one place."],
    accent: "#006CE5",
    accentSoft: "#EAF4FF",
  },
  {
    file: "02-start-in-seconds.png",
    source: "new-session.png",
    label: "RECORD OR UPLOAD",
    title: ["Start in", "seconds."],
    accent: "#7C3AED",
    accentSoft: "#F1ECFF",
  },
  {
    file: "03-practice-before-the-tour.png",
    source: "practice-sessions.png",
    label: "PRACTICE SESSIONS",
    title: ["Practice before", "the real tour."],
    accent: "#006CE5",
    accentSoft: "#EAF4FF",
  },
  {
    file: "04-capture-every-conversation.png",
    source: "transcript-review.png",
    label: "TRANSCRIPT REVIEW",
    title: ["Capture every", "conversation."],
    accent: "#7C3AED",
    accentSoft: "#F1ECFF",
  },
  {
    file: "05-know-what-to-improve.png",
    source: "analysis-scorecard.png",
    label: "TOUR ANALYSIS",
    title: ["Know exactly", "what to improve."],
    accent: "#15803D",
    accentSoft: "#EAF8F0",
  },
  {
    file: "06-guidance-when-needed.png",
    source: "ai-chat.png",
    label: "TOUR AI",
    title: ["Guidance when", "you need it."],
    accent: "#006CE5",
    accentSoft: "#EAF4FF",
  },
  {
    file: "07-turn-insight-into-action.png",
    source: "coaching-actions.png",
    label: "COACHING ACTIONS",
    title: ["Turn insight", "into action."],
    accent: "#7C3AED",
    accentSoft: "#F1ECFF",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function textLines(lines, x, y, size, weight, fill, lineHeight) {
  return `<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="0">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("")}</text>`;
}

function backgroundSvg(slide, index) {
  const inverse = index % 2 === 1;
  const sweep = inverse
    ? `M0 2070 C380 1860 905 1955 1320 1650 L1320 2868 L0 2868 Z`
    : `M0 1960 C410 1760 930 1840 1320 1570 L1320 2868 L0 2868 Z`;

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="1320" height="2868" fill="#F7F9FC"/>
      <rect width="1320" height="11" fill="${slide.accent}"/>
      <path d="${sweep}" fill="${slide.accentSoft}"/>
      <path d="M0 2440 C390 2260 900 2340 1320 2100 L1320 2868 L0 2868 Z" fill="#FFFFFF" opacity="0.38"/>
      <path d="M1060 170 L1240 350" stroke="${slide.accent}" stroke-width="4" opacity="0.14"/>
      <path d="M1130 145 L1284 300" stroke="${slide.accent}" stroke-width="4" opacity="0.14"/>

      <path d="M72 69 L110 91 L72 113 Z" fill="#4A90F0"/>
      <text x="124" y="105" font-family="${fontFamily}" font-size="42" font-weight="700" fill="#101828" letter-spacing="0">Tour</text>
      <text x="1246" y="103" text-anchor="end" font-family="${fontFamily}" font-size="24" font-weight="700" fill="#98A2B3" letter-spacing="0">${String(index + 1).padStart(2, "0")} / 07</text>

      <rect x="72" y="151" width="${Math.max(250, slide.label.length * 17 + 54)}" height="52" rx="26" fill="${slide.accentSoft}"/>
      <text x="99" y="186" font-family="${fontFamily}" font-size="22" font-weight="700" fill="${slide.accent}" letter-spacing="0">${escapeXml(slide.label)}</text>
      ${textLines(slide.title, 72, 286, 64, 750, "#101828", 74)}
      <rect x="72" y="411" width="92" height="7" rx="3.5" fill="${slide.accent}"/>
    </svg>
  `);
}

async function maskRounded(input, targetWidth, targetHeight, radius) {
  const mask = Buffer.from(
    `<svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="${targetWidth}" height="${targetHeight}" rx="${radius}" fill="#fff"/></svg>`,
  );

  return sharp(input)
    .resize(targetWidth, targetHeight, { fit: "fill" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function androidStatusScreen(inputPath) {
  const input = await sharp(inputPath).png().toBuffer();
  const metadata = await sharp(input).metadata();
  const statusHeight = 178;
  const status = Buffer.from(`
    <svg width="${metadata.width}" height="${statusHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#F4F7FB"/>
      <text x="74" y="102" font-family="${fontFamily}" font-size="47" font-weight="650" fill="#101828" letter-spacing="0">9:41</text>
      <circle cx="995" cy="89" r="8" fill="#101828"/>
      <path d="M1024 92 q24 -25 48 0 M1033 101 q15 -15 30 0" fill="none" stroke="#101828" stroke-width="8" stroke-linecap="round"/>
      <rect x="1091" y="64" width="74" height="43" rx="10" fill="none" stroke="#101828" stroke-width="7"/>
      <rect x="1100" y="73" width="48" height="25" rx="5" fill="#101828"/>
      <rect x="1168" y="77" width="7" height="18" rx="3" fill="#101828"/>
    </svg>
  `);

  return sharp(input).composite([{ input: status, left: 0, top: 0 }]).png().toBuffer();
}

async function phoneComposite(screenInput, platform) {
  const outerWidth = 1020;
  const innerWidth = 970;
  const side = 25;
  const innerTop = 28;
  const sourceMeta = await sharp(screenInput).metadata();
  const innerHeight = Math.round((sourceMeta.height / sourceMeta.width) * innerWidth);
  const outerHeight = innerHeight + 56;
  const frameWidth = outerWidth + 88;
  const frameHeight = outerHeight + 106;
  const screenRadius = platform === "apple" ? 91 : 72;
  const bodyRadius = platform === "apple" ? 116 : 88;
  const bodyFill = platform === "apple" ? "#202A36" : "#28323D";
  const bodyStroke = platform === "apple" ? "#667085" : "#475467";

  const frame = Buffer.from(`
    <svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="18" dy="35" stdDeviation="28" flood-color="#101828" flood-opacity="0.25"/></filter></defs>
      <rect x="24" y="16" width="${outerWidth}" height="${outerHeight}" rx="${bodyRadius}" fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="7" filter="url(#shadow)"/>
      <rect x="34" y="26" width="${outerWidth - 20}" height="${outerHeight - 20}" rx="${bodyRadius - 10}" fill="#090D13"/>
      <rect x="${platform === "apple" ? 7 : 13}" y="340" width="15" height="98" rx="7" fill="#667085"/>
      <rect x="${platform === "apple" ? 7 : 13}" y="465" width="15" height="154" rx="7" fill="#667085"/>
      <rect x="${frameWidth - (platform === "apple" ? 19 : 25)}" y="410" width="15" height="190" rx="7" fill="#667085"/>
    </svg>
  `);
  const roundedScreen = await maskRounded(screenInput, innerWidth, innerHeight, screenRadius);

  return {
    input: await sharp({
      create: { width: frameWidth, height: frameHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: frame, left: 0, top: 0 },
        { input: roundedScreen, left: 24 + side, top: 16 + innerTop },
      ])
      .png()
      .toBuffer(),
    width: frameWidth,
    height: frameHeight,
  };
}

async function renderSlide(slide, index, platform, outputPath) {
  const sourcePath = path.join(sourceRoot, slide.source);
  const source = platform === "google" ? await androidStatusScreen(sourcePath) : await sharp(sourcePath).png().toBuffer();
  const phone = await phoneComposite(source, platform);
  const left = Math.round((width - phone.width) / 2);

  await sharp({
    create: { width, height, channels: 4, background: "#F7F9FC" },
  })
    .composite([
      { input: backgroundSvg(slide, index), left: 0, top: 0 },
      { input: phone.input, left, top: 455 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function renderFeatureGraphic() {
  const featureWidth = 1024;
  const featureHeight = 500;
  const samples = ["practice-sessions.png", "transcript-review.png", "analysis-scorecard.png"];
  const composites = [];

  for (let index = 0; index < samples.length; index += 1) {
    const source = await androidStatusScreen(path.join(sourceRoot, samples[index]));
    const screen = await maskRounded(source, 188, 408, 30);
    const border = Buffer.from(`<svg width="202" height="430" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="200" height="428" rx="38" fill="#1F2937" stroke="#667085" stroke-width="2"/></svg>`);
    const phone = await sharp({ create: { width: 202, height: 430, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: border, left: 0, top: 0 }, { input: screen, left: 7, top: 11 }])
      .png()
      .toBuffer();
    composites.push({ input: phone, left: 500 + index * 165, top: 54 + index * 10 });
  }

  const background = Buffer.from(`
    <svg width="${featureWidth}" height="${featureHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="500" fill="#F7F9FC"/>
      <path d="M480 0 H1024 V500 H390 C525 375 528 135 480 0 Z" fill="#EAF4FF"/>
      <path d="M55 55 L86 73 L55 91 Z" fill="#4A90F0"/>
      <text x="98" y="84" font-family="${fontFamily}" font-size="34" font-weight="700" fill="#101828" letter-spacing="0">Tour</text>
      ${textLines(["Better tours.", "Stronger closes."], 55, 197, 50, 750, "#101828", 61)}
      <rect x="55" y="334" width="86" height="7" rx="3.5" fill="#006CE5"/>
    </svg>
  `);

  await sharp({ create: { width: featureWidth, height: featureHeight, channels: 4, background: "#F7F9FC" } })
    .composite([{ input: background, left: 0, top: 0 }, ...composites])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputRoot, "google", "feature-graphic.png"));
}

await fs.mkdir(appleRoot, { recursive: true });
await fs.mkdir(googleRoot, { recursive: true });

for (let index = 0; index < slides.length; index += 1) {
  const slide = slides[index];
  await renderSlide(slide, index, "apple", path.join(appleRoot, slide.file));
  await renderSlide(slide, index, "google", path.join(googleRoot, slide.file));
}

await renderFeatureGraphic();
console.log(`Generated ${slides.length} Apple screenshots, ${slides.length} Google screenshots, and one Google feature graphic.`);
