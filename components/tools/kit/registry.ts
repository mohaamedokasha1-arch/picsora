import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { ToolDef } from '@/lib/tools/registry';

export interface StandaloneToolProps {
  tool: ToolDef;
}

export type StandaloneTool = ComponentType<StandaloneToolProps>;

/**
 * Code-split registry for the PDF / text / calculator / developer / advanced tools.
 * Each entry is its own chunk, loaded only when visited.
 */
export const standaloneTools: Record<string, StandaloneTool> = {
  /* ------------------------------------------------------------ PDF */
  'pdf-merger': dynamic(() => import('../pdf/merger')),
  'pdf-splitter': dynamic(() => import('../pdf/splitter')),
  'pdf-delete-pages': dynamic(() => import('../pdf/delete-pages')),
  'pdf-reorder-pages': dynamic(() => import('../pdf/reorder-pages')),
  'pdf-rotate-pages': dynamic(() => import('../pdf/rotate-pages')),
  'pdf-extract-pages': dynamic(() => import('../pdf/extract-pages')),
  'pdf-protect': dynamic(() => import('../pdf/protect')),
  'pdf-unlock': dynamic(() => import('../pdf/unlock')),
  'pdf-to-images': dynamic(() => import('../pdf/to-images')),
  'pdf-compressor': dynamic(() => import('../pdf/compressor')),
  'pdf-page-counter': dynamic(() => import('../pdf/page-counter')),
  'pdf-to-text': dynamic(() => import('../pdf/to-text')),
  'pdf-watermark': dynamic(() => import('../pdf/watermark')),
  'pdf-page-numbers': dynamic(() => import('../pdf/page-numbers')),

  /* ----------------------------------------------------------- text */
  'word-counter': dynamic(() => import('../text/word-counter')),
  'remove-extra-spaces': dynamic(() => import('../text/remove-extra-spaces')),
  'case-converter': dynamic(() => import('../text/case-converter')),
  'text-cleaner': dynamic(() => import('../text/text-cleaner')),
  'lorem-ipsum-generator': dynamic(() => import('../text/lorem-ipsum')),
  'text-reverser': dynamic(() => import('../text/text-reverser')),
  'remove-duplicate-lines': dynamic(() => import('../text/duplicate-lines')),
  'text-to-slug': dynamic(() => import('../text/slug')),
  'text-diff': dynamic(() => import('../text/diff')),
  'number-to-words': dynamic(() => import('../text/number-to-words')),

  /* ----------------------------------------------------- calculators */
  'age-calculator': dynamic(() => import('../calculators/age')),
  'bmi-calculator': dynamic(() => import('../calculators/bmi')),
  'percentage-calculator': dynamic(() => import('../calculators/percentage')),
  'interest-calculator': dynamic(() => import('../calculators/interest')),
  'date-difference-calculator': dynamic(() => import('../calculators/date-difference')),
  'unit-converter': dynamic(() => import('../calculators/unit-converter')),
  'discount-calculator': dynamic(() => import('../calculators/discount')),
  'gpa-calculator': dynamic(() => import('../calculators/gpa')),
  'tip-calculator': dynamic(() => import('../calculators/tip')),
  'currency-converter': dynamic(() => import('../calculators/currency')),

  /* ------------------------------------------------------- developer */
  'uuid-generator': dynamic(() => import('../developer/uuid')),
  'url-encoder-decoder': dynamic(() => import('../developer/url-codec')),
  'html-encoder-decoder': dynamic(() => import('../developer/html-codec')),
  'json-formatter': dynamic(() => import('../developer/json')),
  'xml-formatter': dynamic(() => import('../developer/xml')),
  'javascript-formatter': dynamic(() => import('../developer/javascript')),
  'css-formatter': dynamic(() => import('../developer/css')),
  'regex-tester': dynamic(() => import('../developer/regex')),
  'base64-encoder-decoder': dynamic(() => import('../developer/base64')),
  'color-converter': dynamic(() => import('../developer/color')),
  'hash-generator': dynamic(() => import('../developer/hash')),
  'number-base-converter': dynamic(() => import('../developer/number-base')),
  'jwt-decoder': dynamic(() => import('../developer/jwt')),
  'color-picker': dynamic(() => import('../developer/color-picker')),
  'unix-timestamp-converter': dynamic(() => import('../developer/timestamp')),
  'yaml-formatter': dynamic(() => import('../developer/yaml')),
  'qr-code-generator': dynamic(() => import('../developer/qr-code')),

  /* -------------------------------------------------------- advanced / photo */
  'photo-metadata-viewer': dynamic(() => import('../ui/photo-metadata-viewer')),
  'ocr-image-to-text': dynamic(() => import('../ui/ocr')),
  'signature-maker': dynamic(() => import('../ui/signature-maker')),
};
