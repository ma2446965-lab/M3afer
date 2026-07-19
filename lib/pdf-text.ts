// CLIENT-ONLY helper — extracted on upload in the browser.
// Uses pdfjs-dist (already a dependency) with its bundled worker asset so we
// never depend on a CDN. Dynamic import keeps pdfjs out of the SSR path
// (it needs browser APIs like DOMMatrix) and out of the initial bundle.

const MAX_PAGES = 30;       // plenty for a ملزمة/chapter; keeps quota + time sane
const MAX_CHARS = 24000;    // fed to Gemini (server also trims its own input)

export async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Self-hosted worker served from /public (bulletproof with any bundler —
  // the import.meta.url asset pattern breaks Next's default webpack parsing).
  // Keep this file in sync when upgrading pdfjs-dist:
  //   cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages = Math.min(doc.numPages, MAX_PAGES);
  let out = "";
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ") + "\n";
    if (out.length > MAX_CHARS) break;
  }
  return out.replace(/[ \t]+/g, " ").trim().slice(0, MAX_CHARS);
}
