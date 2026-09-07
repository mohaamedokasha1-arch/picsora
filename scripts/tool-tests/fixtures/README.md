# Test fixtures — AI upscaler ground truth

| File | Size | What it is |
| --- | --- | --- |
| `esrgan-fixture.png` | 128 × 128 | Low-resolution input shipped by `@upscalerjs/esrgan-slim`. |
| `esrgan-x2-reference.png` | 256 × 256 | The output that package produces for this input at 2×. |

The upscaler test suite runs the vendored model over the fixture and asserts the
result matches the reference pixel-for-pixel (within float rounding), which pins
down the input normalisation (`[0,1]`), the NHWC/RGB tensor layout and the
output decoding.

Both images come from `@upscalerjs/esrgan-slim@1.0.0` (`assets/fixture.png`,
`assets/samples/2x/result.png`), MIT © Kevin Scott. See
`public/models/esrgan/LICENSE.txt`.
