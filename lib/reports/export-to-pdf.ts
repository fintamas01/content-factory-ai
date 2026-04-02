// Client-only helper: capture a DOM node and download a multi-page PDF.
// Uses existing stack: html2canvas + jsPDF.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportElementToPdf(args: {
  element: HTMLElement;
  filename: string;
  /** A4 portrait by default */
  format?: "a4";
  scale?: number;
  backgroundColor?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const scale = Math.max(1, Math.min(3, args.scale ?? 2));
    const canvas = await html2canvas(args.element, {
      scale,
      useCORS: true,
      backgroundColor: args.backgroundColor ?? "#ffffff",
      windowWidth: args.element.scrollWidth,
      windowHeight: args.element.scrollHeight,
    });

    const pdf = new jsPDF({ unit: "pt", format: args.format ?? "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgData = canvas.toDataURL("image/png", 1.0);
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let y = 0;
    let remaining = imgH;

    // First page
    pdf.addImage(imgData, "PNG", 0, y, imgW, imgH);
    remaining -= pageH;

    // Extra pages: re-add same image, shifted up.
    while (remaining > 0) {
      pdf.addPage();
      y -= pageH;
      pdf.addImage(imgData, "PNG", 0, y, imgW, imgH);
      remaining -= pageH;
    }

    pdf.save(args.filename);
    return { ok: true };
  } catch (e) {
    console.error("exportElementToPdf:", e);
    return { ok: false, error: "PDF export failed." };
  }
}

