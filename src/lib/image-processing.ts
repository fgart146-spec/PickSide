import sharp from "sharp";

/**
 * Resizes an uploaded image to a sane max dimension and re-encodes it as
 * WebP. Uploaded originals were previously stored as-is (whatever size/
 * format the visitor's device produced), which meant multi-MB photos and
 * non-optimized formats went straight to storage and straight to every
 * viewer's browser. `withoutEnlargement` keeps small images from being
 * upscaled. `rotate()` applies the EXIF orientation before stripping it, so
 * photos taken on phones don't end up sideways once EXIF metadata is gone.
 */
export async function toOptimizedWebp(
  input: ArrayBuffer,
  { maxWidth, quality = 82 }: { maxWidth: number; quality?: number }
): Promise<Buffer> {
  return sharp(Buffer.from(input))
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}
