# Workflow tests

Regression suite for the **upload → decode → execute → result** pipeline of
every image tool. The tests run the real production code paths (validation,
`decodeImage`, processors, result panel) in Node using jsdom +
`@napi-rs/canvas` — no browser download required.

## Run

```bash
npm install
npm test        # everything
npm run test:unit   # processor pipeline (28 tests)
npm run test:ui     # React workflow: upload file → click execute → result (6 tests)
npm run typecheck   # tsc --noEmit
```

## Structure

- `tests/helpers/browser-shim.ts` — jsdom + native-canvas environment:
  - `document.createElement('canvas')` → `@napi-rs/canvas`
  - `Image` → napi `Image` with `naturalWidth/Height` and blob:→data: loading
  - `URL.createObjectURL` → registry (tests inspect produced blobs)
  - `canvas.toBlob` polyfill (browser 0..1 quality semantics)
- `tests/helpers/fixtures.ts` — deterministic photo / quadrant / background /
  signature fixtures (PNG, JPEG, WebP) + pixel helpers.
- `tests/unit/pipeline.test.ts` — every image processor end to end with byte
  and pixel assertions: compressor (incl. palette quantization), quantizer,
  crop, resize, rotate, flip, grayscale, converters, exact-KB, background
  remover, passport, signature, watermark, split, merge, images-to-PDF,
  validation.
- `tests/ui/workflow.test.tsx` — real `ToolWorkspace` + tool components:
  file picked → decoded → execute button pressed → result Blob inspected.

## Notes

- jsdom + React do not deliver synthetic `input` events for `<input
  type="number">` in this environment (real browsers do); UI tests drive
  settings through native `<select>` controls instead. Processor coverage for
  those settings lives in `pipeline.test.ts`.
