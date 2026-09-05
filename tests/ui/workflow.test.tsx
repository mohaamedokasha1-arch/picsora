/**
 * UI workflow tests: real upload → decode → execute button → result panel.
 *
 * These mount the actual workspace + tool components (next-intl provider, real
 * FileUploader validation, ToolWorkspace decode effect) and drive them like a
 * user: pick a file, press the execute button, then inspect the produced Blob
 * through the object-URL registry.
 */
import { test, before, beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserShim, blobRegistry } from '../helpers/browser-shim';
import {
  makePhotoFile,
  makeQuadrantFile,
  blobToImage,
  pixelAt,
} from '../helpers/fixtures';
import type { Fixture } from '../helpers/fixtures';

// React + testing-library must be imported after the DOM exists at call time;
// static ESM imports only capture modules, so this is safe alongside before().
import { render, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import * as React from 'react';
import en from '../../messages/en.json';
import { ToolWorkspace, ruleFor, type WorkspaceContext } from '@/components/tools/tool-workspace';
import CompressorTool from '@/components/tools/ui/compressor';
import CropperTool from '@/components/tools/ui/cropper';
import ResizerTool from '@/components/tools/ui/resizer';
import GrayscaleTool from '@/components/tools/ui/grayscale';
import { JpgToPngTool } from '@/components/tools/ui/converter';
import { getTool } from '@/lib/tools/registry';

before(() => {
  installBrowserShim();
  // tsx/esbuild compiles JSX with the classic runtime; expose React globally
  // for components that rely on the automatic import.
  (globalThis as Record<string, unknown>).React = React;
});

beforeEach(() => {
  blobRegistry().map.clear();
});

afterEach(() => {
  cleanup();
});

function renderWorkspace(slug: string, ui: (ctx: WorkspaceContext) => React.ReactNode) {
  const tool = getTool(slug)!;
  return render(
      <NextIntlClientProvider
        locale="en"
        messages={en as unknown as AbstractIntlMessages}
        timeZone="Africa/Cairo"
      >
      <ToolWorkspace tool={tool} rule={ruleFor(tool)}>
        {(ctx) => ui(ctx)}
      </ToolWorkspace>
    </NextIntlClientProvider>,
  );
}

async function uploadFixture(container: HTMLElement, fixture: Fixture) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  assert.ok(input, 'file input must exist');
  Object.defineProperty(input, 'files', {
    value: [fixture.file],
    configurable: true,
  });
  fireEvent.change(input);
}

/** The most recently created object URL is the result preview. */
function lastResultBlob(): Blob {
  const entries = [...blobRegistry().map.entries()];
  assert.ok(entries.length, 'expected at least one object URL');
  return entries[entries.length - 1][1];
}

describe('compressor full workflow', () => {
  test('upload PNG → press Compress → real, smaller result appears', async () => {
    const fixture = makePhotoFile(600, 420, 'image/png', 'photo.png');
    const { container } = renderWorkspace('image-compressor', (ctx) => (
      <CompressorTool ctx={ctx} />
    ));

    await uploadFixture(container, fixture);

    const button = await within(container).findByRole('button', { name: /compress/i });
    fireEvent.click(button);
    await within(container).findByText(/your result/i);

    const result = lastResultBlob();
    assert.ok(result.size < fixture.buffer.length, `result ${result.size} !< original ${fixture.buffer.length}`);
    assert.equal(result.type, 'image/png');
    const img = await blobToImage(result);
    assert.equal(img.width, 600);
    assert.equal(img.height, 420);

    // Re-running must produce a fresh processing result (no stale/racy state).
    fireEvent.click(button);
    await waitFor(() => {
      const again = lastResultBlob();
      assert.ok(again.size < fixture.buffer.length, `second run ${again.size}`);
    });
  });

  test('double-click cannot break the pipeline (single-flight)', async () => {
    const fixture = makePhotoFile(600, 420, 'image/png', 'photo.png');
    const { container } = renderWorkspace('image-compressor', (ctx) => (
      <CompressorTool ctx={ctx} />
    ));
    await uploadFixture(container, fixture);
    const button = await within(container).findByRole('button', { name: /compress/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await within(container).findByText(/your result/i);
    const result = lastResultBlob();
    assert.ok(result.size < fixture.buffer.length);
  });
});

describe('cropper full workflow', () => {
  test('upload → Crop → result matches the visible crop box (86% default)', async () => {
    const fixture = makeQuadrantFile(400, 300, 'image/png', 'quad.png');
    const { container } = renderWorkspace('image-cropper', (ctx) => <CropperTool ctx={ctx} />);
    await uploadFixture(container, fixture);

    const button = await within(container).findByRole('button', { name: /crop/i });
    fireEvent.click(button);
    await within(container).findByText(/your result/i);

    const img = await blobToImage(lastResultBlob());
    const expectedW = Math.round(400 * 0.86);
    const expectedH = Math.round(300 * 0.86);
    assert.equal(img.width, expectedW, `crop width ${img.width} != ${expectedW}`);
    assert.equal(img.height, expectedH, `crop height ${img.height} != ${expectedH}`);
  });
});

describe('resizer full workflow', () => {
  test('pick a 512×512 preset → Resize → 512×512 result', async () => {
    const fixture = makeQuadrantFile(400, 300, 'image/png', 'quad.png');
    const { container } = renderWorkspace('image-resizer', (ctx) => <ResizerTool ctx={ctx} />);
    await uploadFixture(container, fixture);

    // jsdom + React here do not deliver synthetic `input` events for number
    // fields, so drive the resize through the native preset <select> — the
    // same settings path a user follows in the browser.
    const preset = (await within(container).findAllByRole('combobox'))[0];
    fireEvent.change(preset, { target: { value: '512 × 512' } });
    fireEvent.click(await within(container).findByRole('button', { name: /resize/i }));
    await within(container).findByText(/your result/i);

    const img = await blobToImage(lastResultBlob());
    assert.equal(img.width, 512);
    assert.equal(img.height, 512);
  });
});

describe('converter full workflow', () => {
  test('JPG upload → Convert → PNG → result bytes are PNG', async () => {
    const fixture = makePhotoFile(400, 300, 'image/jpeg', 'photo.jpg');
    const { container } = renderWorkspace('jpg-to-png', (ctx) => <JpgToPngTool ctx={ctx} />);
    await uploadFixture(container, fixture);

    fireEvent.click(await within(container).findByRole('button', { name: /convert → png/i }));
    await within(container).findByText(/your result/i);

    const result = lastResultBlob();
    assert.equal(result.type, 'image/png');
    const head = Buffer.from(await result.arrayBuffer()).subarray(0, 4).toString('latin1');
    assert.equal(head, '\u0089PNG');
  });
});

describe('grayscale full workflow', () => {
  test('upload → Convert to grayscale → result pixels are neutral', async () => {
    const fixture = makeQuadrantFile(400, 300, 'image/png', 'quad.png');
    const { container } = renderWorkspace('image-to-grayscale', (ctx) => (
      <GrayscaleTool ctx={ctx} />
    ));
    await uploadFixture(container, fixture);

    fireEvent.click(await within(container).findByRole('button', { name: /convert to grayscale/i }));
    await within(container).findByText(/your result/i);

    const [r, g, b] = await pixelAt(lastResultBlob(), 100, 100);
    assert.ok(Math.abs(r - g) <= 12 && Math.abs(g - b) <= 12, `${r}/${g}/${b}`);
  });
});
