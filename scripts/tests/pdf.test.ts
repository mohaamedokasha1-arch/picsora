/** Node-side verification of the pdf-lib operations used by the PDF tools. */
import { PDFDocument, degrees } from '@cantoo/pdf-lib';

let fails = 0;
const eq = (n: string, a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.log('FAIL', n, a, '!=', b); }
};

async function makePdf(pages: number) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) { const p = doc.addPage([300, 400]); p.drawText(`Page ${i+1}`, {x:20,y:350}); }
  return doc.save();
}

(async () => {
  // merge
  const inputs = [await makePdf(2), await makePdf(5), await makePdf(15)];
  const out = await PDFDocument.create();
  for (const bytes of inputs) {
    const src = await PDFDocument.load(bytes);
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach(p => out.addPage(p));
  }
  eq('merge 2+5+15', out.getPageCount(), 22);

  // split all
  const src = await PDFDocument.load(await makePdf(10));
  let parts = 0;
  for (let i = 0; i < src.getPageCount(); i++) {
    const d = await PDFDocument.create();
    const [p] = await d.copyPages(src, [i]);
    d.addPage(p);
    if ((await d.save()).length > 0) parts++;
  }
  eq('split all', parts, 10);

  // delete pages 2,4 of 5
  const s2 = await PDFDocument.load(await makePdf(5));
  const keep = [0,2,4];
  const d2 = await PDFDocument.create();
  (await d2.copyPages(s2, keep)).forEach(p => d2.addPage(p));
  eq('delete', d2.getPageCount(), 3);

  // rotate
  const s3 = await PDFDocument.load(await makePdf(3));
  s3.getPages().forEach((p,i) => p.setRotation(degrees([90,180,270][i])));
  const r = await PDFDocument.load(await s3.save());
  eq('rotate', r.getPages().map(p=>p.getRotation().angle), [90,180,270]);

  // protect + unlock
  const s4 = await PDFDocument.load(await makePdf(3));
  s4.encrypt({ userPassword: 'test1234', ownerPassword: 'owner', permissions: { printing: 'highResolution', copying: true } });
  const enc = await s4.save();
  let locked = false;
  try { await PDFDocument.load(enc); } catch { locked = true; }
  eq('protect locks', locked, true);
  let wrong = false;
  try { await PDFDocument.load(enc, { password: 'bad' }); } catch { wrong = true; }
  eq('wrong password', wrong, true);
  const dec = await PDFDocument.load(enc, { password: 'test1234' });
  const clean = await PDFDocument.create();
  (await clean.copyPages(dec, dec.getPageIndices())).forEach(p => clean.addPage(p));
  const unlocked = await clean.save();
  eq('unlock', (await PDFDocument.load(unlocked)).getPageCount(), 3);

  // page count
  eq('count', (await PDFDocument.load(await makePdf(42))).getPageCount(), 42);

  // magic bytes
  const head = Buffer.from((await makePdf(1)).slice(0,4)).toString();
  eq('magic', head, '%PDF');

  console.log(fails ? `${fails} FAILURES` : 'PDF ALL PASS');
})();
