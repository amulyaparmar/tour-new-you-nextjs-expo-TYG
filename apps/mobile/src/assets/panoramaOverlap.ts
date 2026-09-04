import { File as ExpoFile } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "jpeg-js";

import {
  comparePanoramaFrames,
  type PanoramaOverlapResult,
  type PanoramaPixelFrame,
} from "./panoramaOverlapMath";

const ANALYSIS_WIDTH = 112;

async function prepareFrame(uri: string): Promise<PanoramaPixelFrame> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: ANALYSIS_WIDTH } }],
    { compress: 0.62, format: SaveFormat.JPEG },
  );
  const temporaryFile = new ExpoFile(result.uri);
  try {
    const decoded = decode(await temporaryFile.bytes(), { useTArray: true });
    return {
      width: decoded.width,
      height: decoded.height,
      rgba: decoded.data,
    };
  } finally {
    if (temporaryFile.exists) temporaryFile.delete();
  }
}

export async function checkPanoramaOverlap(
  previousUri: string,
  currentUri: string,
): Promise<PanoramaOverlapResult> {
  const [previous, current] = await Promise.all([
    prepareFrame(previousUri),
    prepareFrame(currentUri),
  ]);
  return comparePanoramaFrames(previous, current);
}

export type { PanoramaOverlapQuality, PanoramaOverlapResult } from "./panoramaOverlapMath";
