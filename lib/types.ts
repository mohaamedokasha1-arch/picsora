export type ImageFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif' | 'heic' | 'heif';
/** Output formats a tool may produce (images, PDF, documents or JSON exports). */
export type OutputFormat = ImageFormat | 'pdf' | 'json' | 'zip' | 'txt' | 'doc' | 'xml' | 'css' | 'js' | 'csv';

export interface Dimension {
  width: number;
  height: number;
}

export interface DecodedImage {
  /** HTMLImageElement when decoding via <img> tag. */
  image: HTMLImageElement;
  /** ImageBitmap when decoding via createImageBitmap (faster path). */
  bitmap: ImageBitmap | null;
  width: number;
  height: number;
  /** Original format detected from the file. */
  format: ImageFormat;
  /** Original file. */
  file: File;
}

export interface ProcessResult {
  blob: Blob;
  /** Output format the bytes really are in (see `encodeCanvas`). */
  format: OutputFormat;
  /**
   * Set when the browser cannot encode the format the user asked for and the
   * pipeline safely produced `format` instead. The UI turns this into an
   * explanatory note — it is NOT an error: the user always gets a usable file
   * whose name, MIME and bytes agree.
   */
  fallbackFrom?: ImageFormat;
  /** Suggested download filename without extension. */
  name: string;
  /**
   * Byte size of THIS result's source file. Per-result values keep batch
   * tools honest (comparing one output against the whole batch total would
   * show inflated savings).
   */
  originalSize?: number;
  /**
   * Encoder quality actually used (1-100, lossy image outputs only). Shown
   * on the result card so smart quality decisions stay transparent.
   */
  finalQuality?: number;
}

export interface PaletteColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  /** Approximate share of pixels in the image. */
  share: number;
}
