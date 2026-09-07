# AI super-resolution models (ESRGAN, TensorFlow.js)

Vendored weights for the **AI Image Upscaler** tool. They are served from this
directory (`/models/esrgan/x{2,3,4}/model.json`) so the tool never touches a
third-party CDN and keeps working offline.

| Scale | Files | Size |
| --- | --- | --- |
| 2× | `x2/model.json` + `x2/group1-shard1of1.bin` | 888 KB |
| 3× | `x3/model.json` + `x3/group1-shard1of1.bin` | 907 KB |
| 4× | `x4/model.json` + `x4/group1-shard1of1.bin` | 934 KB |

## What they are

ESRGAN "slim" generators — 12× `Conv2D` (3×3, `padding: "same"`), a residual
`Add`, one `UpSampling2D` (nearest, factor = scale) and a final `SR` conv.
They are **Keras/TF.js layers-models** (input `LR`, output `SR`, both
`[null, null, null, 3]` floats in the `[0, 1]` range), so they load with
`tf.loadLayersModel()` and need no custom layer registration.

## Provenance and licence

Copied verbatim from the npm package
[`@upscalerjs/esrgan-slim@1.0.0`](https://www.npmjs.com/package/@upscalerjs/esrgan-slim)
(`models/x2`, `models/x3`, `models/x4`). MIT licence © Kevin Scott — see
`LICENSE.txt` in this folder. Architecture: [ESRGAN, Wang et al. 2018](https://arxiv.org/abs/1809.00219).

To refresh or verify the files run:

```bash
node scripts/fetch-ai-models.mjs --check   # verify checksums only
node scripts/fetch-ai-models.mjs           # re-download from npm
```
