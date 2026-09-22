'use client';

/**
 * PDF Fill Forms — AcroForm filling, client-side.
 * 
 * Uses pdf-lib to detect and fill AcroForm fields.
 * Supports: text fields, checkboxes, radio groups, dropdowns.
 * 
 * Limitations:
 * - Only AcroForm (PDF form fields), not XFA (XML Forms Architecture)
 * - XFA forms will show message to use Adobe
 * - No JavaScript actions preserved
 * - Flatten option available to lock filled data
 */

export interface PdfFormField {
  name: string;
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'unknown';
  value?: string;
  options?: string[];
  isRequired?: boolean;
}

export async function inspectFormFields(file: File, password?: string): Promise<PdfFormField[]> {
  const { loadDocument, readBytes } = await import('./index');
  const bytes = password ? await readBytes(file) : new Uint8Array(await file.arrayBuffer());
  const doc = await loadDocument(bytes, { password });

  try {
    const form = doc.getForm();
    const fields = form.getFields();
    
    return fields.map(field => {
      const name = field.getName();
      const typeName = field.constructor.name;

      if (typeName.includes('PDFTextField')) {
        const textField = form.getTextField(name);
        return {
          name,
          type: 'text' as const,
          value: textField.getText() || '',
        };
      } else if (typeName.includes('PDFCheckBox')) {
        const cb = form.getCheckBox(name);
        const isChecked = cb.isChecked();
        return {
          name,
          type: 'checkbox' as const,
          value: isChecked ? 'checked' : '',
        };
      } else if (typeName.includes('PDFRadioGroup')) {
        const radio = form.getRadioGroup(name);
        const options = radio.getOptions();
        const selected = radio.getSelected();
        return {
          name,
          type: 'radio' as const,
          value: selected || '',
          options,
        };
      } else if (typeName.includes('PDFDropdown')) {
        const dropdown = form.getDropdown(name);
        const options = dropdown.getOptions();
        const selected = dropdown.getSelected();
        return {
          name,
          type: 'dropdown' as const,
          value: selected[0] || '',
          options,
        };
      } else {
        return {
          name,
          type: 'unknown' as const,
          value: '',
        };
      }
    });
  } catch (e) {
    // No form or XFA
    const msg = e instanceof Error ? e.message : String(e);
    if (/acroform|xfa|form/i.test(msg)) {
      throw new Error('This PDF does not contain fillable AcroForm fields, or it uses XFA format which is not supported in browsers. XFA forms require Adobe Acrobat. Please check if your PDF has interactive form fields.');
    }
    throw e;
  }
}

export interface FillValues {
  [fieldName: string]: string | boolean;
}

export async function fillPdfForm(
  file: File,
  values: FillValues,
  options: { flatten?: boolean; password?: string } = {},
): Promise<Blob> {
  const { loadDocument, readBytes } = await import('./index');
  const bytes = options.password ? await readBytes(file) : new Uint8Array(await file.arrayBuffer());
  const doc = await loadDocument(bytes, { password: options.password });

  const form = doc.getForm();

  for (const [fieldName, value] of Object.entries(values)) {
    try {
      const field = form.getField(fieldName);
      const typeName = field.constructor.name;

      if (typeName.includes('PDFTextField') && typeof value === 'string') {
        const tf = form.getTextField(fieldName);
        tf.setText(value);
      } else if (typeName.includes('PDFCheckBox')) {
        const cb = form.getCheckBox(fieldName);
        if (value === true || value === 'checked' || value === 'true' || value === '1') {
          cb.check();
        } else {
          cb.uncheck();
        }
      } else if (typeName.includes('PDFRadioGroup') && typeof value === 'string') {
        const radio = form.getRadioGroup(fieldName);
        if (value) radio.select(value);
      } else if (typeName.includes('PDFDropdown') && typeof value === 'string') {
        const dropdown = form.getDropdown(fieldName);
        if (value) dropdown.select(value);
      }
    } catch (e) {
      console.warn(`Failed to fill field ${fieldName}:`, e);
      // Continue with other fields
    }
  }

  if (options.flatten) {
    form.flatten();
  }

  const pdfBytes = await doc.save();
  return new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
}
