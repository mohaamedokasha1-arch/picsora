import type { DecodedImage, ProcessResult } from '@/lib/types';

export type ProcessorOutput = ProcessResult | ProcessResult[];

export interface ProcessorOptions {
  [key: string]: unknown;
}

export type ToolProcessor<T extends ProcessorOptions = ProcessorOptions> = (
  files: DecodedImage[],
  options: T,
) => Promise<ProcessorOutput>;
