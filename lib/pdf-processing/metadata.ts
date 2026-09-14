/**
 * Reading and writing the document information dictionary of a PDF
 * (Title, Author, Subject, Keywords, Creator, Producer) with pdf-lib.
 * Everything happens locally in the browser.
 */

import type { PdfFileInfo } from './index';
import { inspect, loadDocument, loadPdfLib, readBytes } from './index';

export interface PdfMetadataFields {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

export const EMPTY_PDF_METADATA: PdfMetadataFields = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
  producer: '',
};

export interface PdfMetadataReport {
  info: PdfFileInfo;
  fields: PdfMetadataFields;
  pageWidth?: number;
  pageHeight?: number;
}

const clean = (value: string | undefined | null): string => (value ?? '').toString();

/** Read the current metadata plus basic facts about the document. */
export async function readPdfMetadata(file: File): Promise<PdfMetadataReport> {
  const info = await inspect(file);
  if (info.encrypted) {
    return { info, fields: { ...EMPTY_PDF_METADATA } };
  }
  const bytes = await readBytes(file);
  const doc = await loadDocument(bytes);
  const first = doc.getPages()[0];
  const size = first?.getSize();
  return {
    info,
    fields: {
      title: clean(doc.getTitle()),
      author: clean(doc.getAuthor()),
      subject: clean(doc.getSubject()),
      keywords: clean(doc.getKeywords()),
      creator: clean(doc.getCreator()),
      producer: clean(doc.getProducer()),
    },
    pageWidth: size?.width,
    pageHeight: size?.height,
  };
}

/** Write the given fields back and return the new PDF as a Blob. */
export async function writePdfMetadata(
  file: File,
  fields: PdfMetadataFields,
): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib();
  const bytes = await readBytes(file);
  // updateMetadata: true keeps unrelated XMP data untouched while still
  // letting the setters below take effect on save.
  const doc = await PDFDocument.load(bytes, { updateMetadata: true });

  const set = (value: string, apply: (v: string) => void, clear: () => void) => {
    const trimmed = value.trim();
    if (trimmed) apply(trimmed);
    else clear();
  };

  set(fields.title, (v) => doc.setTitle(v), () => doc.setTitle(''));
  set(fields.author, (v) => doc.setAuthor(v), () => doc.setAuthor(''));
  set(fields.subject, (v) => doc.setSubject(v), () => doc.setSubject(''));
  // Stored as one comma-separated string: that is what other PDF readers
  // expect, and it round-trips exactly what the user typed.
  set(fields.keywords, (v) => doc.setKeywords([v]), () => doc.setKeywords([]));
  set(fields.creator, (v) => doc.setCreator(v), () => doc.setCreator(''));
  set(fields.producer, (v) => doc.setProducer(v), () => doc.setProducer(''));

  const out = await doc.save();
  return new Blob([out.slice().buffer], { type: 'application/pdf' });
}
