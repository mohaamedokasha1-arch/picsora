import { parseExifMetadata, getExifOrientation, detectLivePhoto } from '../../lib/image/exif';

// Build a mock JPEG buffer with APP1 EXIF orientation tag = 6 (90 CW)
function createMockJpegWithExif(orientation = 6): ArrayBuffer {
  // JPEG SOI: FF D8
  // APP1 Marker: FF E1
  // Length: 00 22 (34 bytes)
  // Exif\0\0: 45 78 69 66 00 00
  // TIFF Header Little Endian: 49 49 (II) 2A 00 (42) 08 00 00 00 (IFD offset 8)
  // IFD0: 01 00 (1 entry)
  // Tag 0112 (Orientation), type 0003 (SHORT), count 01000000 (1), value 0600 (orientation), pad 0000
  // Next IFD offset: 00 00 00 00
  // JPEG EOI: FF D9

  const bytes = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1
    0x00, 0x22, // Length (34 bytes)
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // TIFF Header (II, 42, IFD0 offset 8)
    0x01, 0x00, // 1 entry in IFD0
    0x12, 0x01, // Tag 0x0112 (Orientation)
    0x03, 0x00, // Type 3 (SHORT)
    0x01, 0x00, 0x00, 0x00, // Count 1
    orientation, 0x00, 0x00, 0x00, // Value
    0x00, 0x00, 0x00, 0x00, // Next IFD
    0xff, 0xd9, // EOI
  ]);

  return bytes.buffer;
}

async function runTests() {
  let fails = 0;
  const eq = (name: string, a: unknown, b: unknown) => {
    const ok = JSON.stringify(a) === JSON.stringify(b);
    if (!ok) {
      fails++;
      console.log('FAIL', name, JSON.stringify(a), '!=', JSON.stringify(b));
    }
  };

  const buf6 = createMockJpegWithExif(6);
  const meta6 = await parseExifMetadata(buf6);
  eq('orientation 6', meta6.orientation, 6);

  const buf3 = createMockJpegWithExif(3);
  const meta3 = await parseExifMetadata(buf3);
  eq('orientation 3', meta3.orientation, 3);

  const orient6 = await getExifOrientation(buf6);
  eq('getExifOrientation', orient6, 6);

  // Live photo mock detection
  const liveBuffer = new TextEncoder().encode('prefix Apple Live Photo ContentIdentifier 123456 suffix');
  const liveBlob = new Blob([liveBuffer]);
  const liveResult = await detectLivePhoto(liveBlob);
  eq('live photo detection', liveResult.isLivePhoto, true);

  console.log(fails ? `\n${fails} EXIF FAILURES` : '\nEXIF ALL PASS');
}

runTests();
