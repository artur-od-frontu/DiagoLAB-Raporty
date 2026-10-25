/**
 * Silnik renderowania PDF (serwer-only) — Playwright + headless Chromium.
 * Model danych raportu jest współdzielony z HTML (src/lib/report-payload.ts).
 *
 * Bezpieczeństwo zasobów: jeden proces przeglądarki (singleton) + kolejka
 * szeregowa zadań — renderowanie PDF nie mnoży procesów przy ruchu.
 */

import { chromium, type Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

/** Szeregowa kolejka zadań PDF — chroni pamięć serwera. */
let queue: Promise<unknown> = Promise.resolve();

export function enqueuePdf<T>(job: () => Promise<T>): Promise<T> {
  const result = queue.then(job, job);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export interface PdfOptions {
  reportNumber: string;
  demo?: boolean;
}

export async function renderPdf(html: string, opts: PdfOptions): Promise<Buffer> {
  return enqueuePdf(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
      const watermark = opts.demo
        ? `<div style="font-size:7.5px;width:100%;text-align:center;color:#c0392b;font-family:monospace;">DIAGOLAB RAPORTY+ · WERSJA DEMO — DANE PRZYKŁADOWE</div>`
        : `<div style="font-size:7.5px;width:100%;text-align:center;color:#8a94a6;font-family:monospace;">DiagoLAB Raporty+</div>`;
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", bottom: "18mm", left: "12mm", right: "12mm" },
        displayHeaderFooter: true,
        headerTemplate: watermark,
        footerTemplate: `<div style="font-size:8px;width:100%;padding:0 12mm;display:flex;justify-content:space-between;color:#667;font-family:monospace;">
          <span>${opts.reportNumber}</span>
          <span>Strona <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => {});
    }
  });
}
