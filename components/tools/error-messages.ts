/**
 * Shared mapping from upload/processing error keys to i18n message keys.
 *
 * Kept in its own module (no `'use client'`) so both the error banner and the
 * dropzone can resolve a human-readable message for the same error object.
 */

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface MessageError {
  key: string;
  params?: Record<string, string | number>;
}

export const UPLOAD_MESSAGE_KEYS: Record<string, string> = {
  emptyFile: 'validation.emptyFile',
  fileTooLarge: 'validation.fileTooLarge',
  invalidType: 'validation.invalidType',
  invalidPdf: 'errors.invalidPdf',
  mimeMismatch: 'validation.mimeMismatch',
  tooManyFiles: 'validation.tooManyFiles',
  corruptImage: 'validation.corruptImage',
  heicUnsupported: 'validation.heicUnsupported',
  partialSkip: 'validation.partialSkip',
  noFile: 'validation.noFile',
  readError: 'validation.readError',
  'webp-unsupported': 'errors.webpUnsupported',
  'decode-failed': 'validation.corruptImage',
  'encode-failed': 'errors.processingFailed',
  'no-2d-context': 'errors.processingFailed',
  'need-at-least-two': 'errors.processingFailed',
  'zip-failed': 'errors.zipFailed',
  'pdf-failed': 'errors.pdfFailed',
};

/** Translate an upload/processing error into a user-facing string. */
export function resolveUploadMessage(error: MessageError | string, t: Translate): string {
  if (typeof error === 'string') return error;
  const key = UPLOAD_MESSAGE_KEYS[error.key];
  if (!key) return t('errors.generic');
  return t(key, error.params);
}
