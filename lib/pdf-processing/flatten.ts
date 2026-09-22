/**
 * PDF form flattening — bake fillable form fields (and their current values)
 * into static page content so the document can no longer be edited. Runs
 * locally with pdf-lib.
 */

import { loadDocument, readBytes } from './index';
import { assertValidOutput } from '@/lib/output-validation';

export interface FlattenReport {
  blob: Blob;
  /** Number of form fields that were baked into the pages. */
  fields: number;
  /** Number of pages in the document. */
  pages: number;
}

/** Flatten all AcroForm fields of a PDF. Throws PdfError on failure. */
export async function flattenPdf(file: File, password?: string): Promise<FlattenReport> {
  const bytes = await readBytes(file);
  const doc = await loadDocument(bytes, { password });
  let fields = 0;
  try {
    const form = doc.getForm();
    fields = form.getFields().length;
    if (fields > 0) form.flatten();
  } catch {
    // Documents without a form catalogue land here — nothing to flatten,
    // but the re-saved file is still returned for consistency.
    fields = 0;
  }
  const pages = doc.getPages().length;
  const out = await doc.save();
  const copy = new Uint8Array(out.length);
  copy.set(out);
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: 'application/pdf' });
  await assertValidOutput(blob, { format: 'pdf', expectedPageCount: pages });
  return {
    blob,
    fields,
    pages,
  };
}
