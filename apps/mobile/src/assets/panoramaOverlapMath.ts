export type PanoramaOverlapQuality = "good" | "weak" | "unverifiable";

export type PanoramaPixelFrame = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

export type PanoramaOverlapResult = {
  quality: PanoramaOverlapQuality;
  score: number;
  confidence: number;
  texture: number;
  overlapPercent: number;
  verticalShiftPixels: number;
  direction: "clockwise" | "counterclockwise";
};

type GradientFrame = {
  width: number;
  height: number;
  values: Int16Array;
};

type Candidate = {
  score: number;
  texture: number;
  overlapPixels: number;
  verticalShiftPixels: number;
  direction: PanoramaOverlapResult["direction"];
};

const MIN_TEXTURE = 12;
const MIN_GOOD_SCORE = 0.12;
const MIN_SCORE_SEPARATION = 0.004;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function gradientFrame(frame: PanoramaPixelFrame): GradientFrame {
  const { width, height, rgba } = frame;
  const luminance = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const source = index * 4;
    luminance[index] = Math.round(
      rgba[source]! * 0.2126
      + rgba[source + 1]! * 0.7152
      + rgba[source + 2]! * 0.0722,
    );
  }

  const values = new Int16Array(width * height * 2);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const source = y * width + x;
      const target = source * 2;
      values[target] = luminance[source + 1]! - luminance[source - 1]!;
      values[target + 1] = luminance[source + width]! - luminance[source - width]!;
    }
  }
  return { width, height, values };
}

function scoreCandidate(
  previous: GradientFrame,
  current: GradientFrame,
  overlapPixels: number,
  verticalShiftPixels: number,
  direction: Candidate["direction"],
): Candidate {
  const width = previous.width;
  const height = Math.min(previous.height, current.height);
  const previousStartX = direction === "clockwise" ? width - overlapPixels : 0;
  const currentStartX = direction === "clockwise" ? 0 : width - overlapPixels;
  const top = Math.max(1, Math.round(height * 0.1), 1 - verticalShiftPixels);
  const bottom = Math.min(height - 1, Math.round(height * 0.9), height - 1 - verticalShiftPixels);
  let dot = 0;
  let previousEnergy = 0;
  let currentEnergy = 0;
  let samples = 0;

  for (let y = top; y < bottom; y += 2) {
    const currentY = y + verticalShiftPixels;
    for (let x = 1; x < overlapPixels - 1; x += 1) {
      const previousIndex = (y * width + previousStartX + x) * 2;
      const currentIndex = (currentY * width + currentStartX + x) * 2;
      const previousXGradient = previous.values[previousIndex]!;
      const previousYGradient = previous.values[previousIndex + 1]!;
      const currentXGradient = current.values[currentIndex]!;
      const currentYGradient = current.values[currentIndex + 1]!;
      dot += previousXGradient * currentXGradient + previousYGradient * currentYGradient;
      previousEnergy += previousXGradient ** 2 + previousYGradient ** 2;
      currentEnergy += currentXGradient ** 2 + currentYGradient ** 2;
      samples += 1;
    }
  }

  const denominator = Math.sqrt(previousEnergy * currentEnergy);
  return {
    score: denominator > 0 ? dot / denominator : 0,
    texture: samples > 0
      ? Math.sqrt((previousEnergy + currentEnergy) / (samples * 2))
      : 0,
    overlapPixels,
    verticalShiftPixels,
    direction,
  };
}

export function comparePanoramaFrames(
  previousFrame: PanoramaPixelFrame,
  currentFrame: PanoramaPixelFrame,
): PanoramaOverlapResult {
  if (
    previousFrame.width !== currentFrame.width
    || previousFrame.height !== currentFrame.height
    || previousFrame.width < 32
    || previousFrame.height < 32
  ) {
    throw new Error("Panorama overlap frames must have matching dimensions.");
  }

  const previous = gradientFrame(previousFrame);
  const current = gradientFrame(currentFrame);
  const candidates: Candidate[] = [];
  // OpenCV-style stitching is unreliable below roughly 20% shared image
  // area, so matches smaller than that should not qualify a capture.
  const minimumOverlap = Math.round(previous.width * 0.2);
  const maximumOverlap = Math.round(previous.width * 0.55);
  const verticalRange = Math.max(2, Math.round(previous.height * 0.035));

  for (let overlap = minimumOverlap; overlap <= maximumOverlap; overlap += 2) {
    for (let verticalShift = -verticalRange; verticalShift <= verticalRange; verticalShift += 2) {
      candidates.push(scoreCandidate(previous, current, overlap, verticalShift, "clockwise"));
      candidates.push(scoreCandidate(previous, current, overlap, verticalShift, "counterclockwise"));
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0]!;
  const runnerUp = candidates.find((candidate) => (
    candidate.direction !== best.direction
    || Math.abs(candidate.overlapPixels - best.overlapPixels) > 3
    || Math.abs(candidate.verticalShiftPixels - best.verticalShiftPixels) > 2
  )) ?? candidates[1]!;
  const scoreSeparation = best.score - runnerUp.score;
  const textureConfidence = clamp((best.texture - MIN_TEXTURE) / 20, 0, 1);
  const scoreConfidence = clamp((best.score - MIN_GOOD_SCORE) / 0.35, 0, 1);
  const separationConfidence = clamp(scoreSeparation / 0.04, 0, 1);
  const confidence = textureConfidence * Math.max(scoreConfidence, 0.2) * Math.max(separationConfidence, 0.2);
  const quality: PanoramaOverlapQuality = best.texture < MIN_TEXTURE
    ? "unverifiable"
    : best.score >= MIN_GOOD_SCORE && scoreSeparation >= MIN_SCORE_SEPARATION
      ? "good"
      : "weak";

  return {
    quality,
    score: Number(best.score.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    texture: Number(best.texture.toFixed(2)),
    overlapPercent: Math.round((best.overlapPixels / previous.width) * 100),
    verticalShiftPixels: best.verticalShiftPixels,
    direction: best.direction,
  };
}
