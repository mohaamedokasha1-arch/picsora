export type ImageFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif';
/** Output formats a tool may produce (images, PDF or JSON exports). */
export type OutputFormat = ImageFormat | 'pdf' | 'json' | 'zip' | 'txt' | 'xml' | 'css' | 'js' | 'csv';

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
  /** Detected or requested output format. */
  format: OutputFormat;
  /** Suggested download filename without extension. */
  name: string;
}

export interface PaletteColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  /** Approximate share of pixels in the image. */
  share: number;
}
