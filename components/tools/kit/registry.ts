import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { ToolDef } from '@/lib/tools/registry';

export interface StandaloneToolProps {
  tool: ToolDef;
}

export type StandaloneTool = ComponentType<StandaloneToolProps>;

/**
 * Code-split registry for the PDF / text / calculator / developer tools.
 * Each entry is its own chunk, so visiting one tool never downloads another
 * tool's dependencies (pdf-lib, pdf.js, Prettier, Terser…).
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
  'pdf-to-word': dynamic(() => import('../pdf/to-word')),
  'pdf-ocr': dynamic(() => import('../pdf/ocr')),
  'pdf-page-numbers': dynamic(() => import('../pdf/page-numbers')),
  'pdf-watermark': dynamic(() => import('../pdf/watermark')),
  'pdf-grayscale': dynamic(() => import('../pdf/grayscale')),
  'pdf-metadata-editor': dynamic(() => import('../pdf/metadata-editor')),
  'pdf-extract-images': dynamic(() => import('../pdf/extract-images')),
  'pdf-metadata-viewer': dynamic(() => import('../pdf/metadata-viewer')),
  'pdf-metadata-cleaner': dynamic(() => import('../pdf/metadata-cleaner')),
  'pdf-flatten': dynamic(() => import('../pdf/flatten')),
  'pdf-crop': dynamic(() => import('../pdf/crop')),
  'pdf-header-footer': dynamic(() => import('../pdf/header-footer')),
  'pdf-to-markdown': dynamic(() => import('../pdf/to-markdown')),
  'pdf-to-html': dynamic(() => import('../pdf/to-html')),
  'pdf-to-csv': dynamic(() => import('../pdf/to-csv')),
  'pdf-compare': dynamic(() => import('../pdf/compare')),
  'pdf-search': dynamic(() => import('../pdf/search')),
  'word-to-pdf': dynamic(() => import('../pdf/word-to-pdf')),
  'pdf-to-excel': dynamic(() => import('../pdf/pdf-to-excel')),
  'pdf-to-powerpoint': dynamic(() => import('../pdf/pdf-to-powerpoint')),
  'excel-to-pdf': dynamic(() => import('../pdf/excel-to-pdf')),
  'powerpoint-to-pdf': dynamic(() => import('../pdf/powerpoint-to-pdf')),
  'sign-pdf': dynamic(() => import('../pdf/sign-pdf')),
  'fill-pdf-forms': dynamic(() => import('../pdf/fill-forms')),
  'pdf-redaction': dynamic(() => import('../pdf/redact-pdf')),

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
  'line-sorter': dynamic(() => import('../text/line-sorter')),
  'text-extractor': dynamic(() => import('../text/extractor')),
  'text-frequency-counter': dynamic(() => import('../text/frequency')),
  'text-to-json': dynamic(() => import('../text/to-json')),
  'text-to-csv': dynamic(() => import('../text/to-csv')),

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
  'loan-calculator': dynamic(() => import('../calculators/loan')),
  'mortgage-calculator': dynamic(() => import('../calculators/mortgage')),
  'salary-calculator': dynamic(() => import('../calculators/salary')),
  'vat-calculator': dynamic(() => import('../calculators/vat')),
  'profit-margin-calculator': dynamic(() => import('../calculators/margin')),
  'average-calculator': dynamic(() => import('../calculators/average')),

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
  'sql-formatter': dynamic(() => import('../developer/sql')),
  'yaml-formatter': dynamic(() => import('../developer/yaml')),
  'markdown-formatter': dynamic(() => import('../developer/markdown')),
  'json-csv-converter': dynamic(() => import('../developer/json-csv')),
  'url-parser': dynamic(() => import('../developer/url-parser')),
  'timestamp-converter': dynamic(() => import('../developer/timestamp')),
  'cron-generator': dynamic(() => import('../developer/cron')),
  'password-generator': dynamic(() => import('../developer/password')),
  'json-to-typescript': dynamic(() => import('../developer/json2ts')),
  'html-to-markdown': dynamic(() => import('../developer/html2md')),
  'http-status-codes': dynamic(() => import('../developer/http-status')),
  'user-agent-parser': dynamic(() => import('../developer/ua-parser')),
  'mock-json-generator': dynamic(() => import('../developer/mock-json')),
  'jwt-encoder': dynamic(() => import('../developer/jwt-encoder')),
  'bulk-file-renamer': dynamic(() => import('../developer/renamer')),
  'duplicate-file-finder': dynamic(() => import('../developer/duplicates')),
};
