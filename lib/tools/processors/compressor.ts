import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { encodeDecodedToBlob, nameOf, outputName } from '@/lib/image/process';

export interface CompressorOptions {
  quality: number; // 1..100
  format: ImageFormat | 'same';
}

export async function compressImages(
  files: DecodedImage[],
  options: CompressorOptions,
): Promise<ProcessResult[]> {
  const quality = Math.max(0.01, Math.min(1, options.quality / 100));
  const results: ProcessResult[] = [];
  for (const file of files) {
    const rawFormat = options.format === 'same' ? file.format : options.format;
    const format: ImageFormat = rawFormat === 'gif' ? 'png' : rawFormat;
    const blob = await encodeDecodedToBlob(file, format, quality);
    results.push({ blob, format, name: outputName(nameOf(file.file), format) });
  }
  return results;
}
