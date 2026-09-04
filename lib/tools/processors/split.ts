import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf } from '@/lib/image/process';
import { canvasToBlob, encodableFormat } from '@/lib/image/format';

export interface SplitOptions {
  rows: number;
  cols: number;
  format: ImageFormat;
}

export async function splitImage(
  files: DecodedImage[],
  options: SplitOptions,
): Promise<ProcessResult[]> {
  const decoded = files[0];
  const cols = Math.max(1, Math.min(20, Math.round(options.cols)));
  const rows = Math.max(1, Math.min(20, Math.round(options.rows)));
  const tileW = Math.floor(decoded.width / cols);
  const tileH = Math.floor(decoded.height / rows);
  const base = nameOf(decoded.file);
  const format = encodableFormat(options.format);
  const results: ProcessResult[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = c * tileW;
      const sy = r * tileH;
      const sw = c === cols - 1 ? decoded.width - sx : tileW;
      const sh = r === rows - 1 ? decoded.height - sy : tileH;
      const { canvas, ctx } = createCanvas(sw, sh);
      if (decoded.bitmap) {
        ctx.drawImage(decoded.bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
      } else {
        ctx.drawImage(decoded.image, sx, sy, sw, sh, 0, 0, sw, sh);
      }
      const blob = await canvasToBlob(canvas, { format, quality: 0.92 });
      const ext = format === 'jpeg' ? 'jpg' : format;
      results.push({ blob, format, name: `${base}_${r + 1}x${c + 1}.${ext}` });
    }
  }
  return results;
}
