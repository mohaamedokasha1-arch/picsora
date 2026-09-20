'use client';

/**
 * Second-generation format converters (AVIF / SVG / GIF / ICO). All reuse the
 * shared ConverterTool shell + convertMany engine — only the target format
 * and the honest capability notes differ per tool.
 */

import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { ConverterTool } from './converter';

type Ctx = { ctx: WorkspaceContext };

export function AvifToJpgTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'jpg', needsBackground: true }} />;
}
export function AvifToPngTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'png' }} />;
}
export function AvifToWebpTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'webp' }} />;
}
export function JpgToAvifTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'avif' }} />;
}
export function PngToAvifTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'avif' }} />;
}
export function WebpToAvifTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'avif' }} />;
}
export function SvgToPngTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'png', hintKey: 'convert.svgNote' }} />;
}
export function SvgToJpgTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'jpg', needsBackground: true, hintKey: 'convert.svgNote' }} />;
}
export function SvgToWebpTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'webp', hintKey: 'convert.svgNote' }} />;
}
export function GifToWebpTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'webp', hintKey: 'convert.gifNote' }} />;
}
export function ImageToIcoTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'ico', hintKey: 'convert.icoNote' }} />;
}
export function IcoToPngTool({ ctx }: Ctx) {
  return <ConverterTool ctx={ctx} config={{ to: 'png', hintKey: 'convert.icoSourceNote' }} />;
}
