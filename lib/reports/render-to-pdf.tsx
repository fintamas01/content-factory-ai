"use client";

import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { exportElementToPdf } from "./export-to-pdf";

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function renderReportToPdf(args: {
  filename: string;
  node: ReactNode;
  backgroundColor?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "794px"; // ~A4 at 96dpi
  host.style.background = args.backgroundColor ?? "#ffffff";
  host.style.zIndex = "9999";
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(args.node);

  // Give the browser time to layout + paint before capture
  await nextFrame();
  await nextFrame();

  const res = await exportElementToPdf({
    element: host,
    filename: args.filename,
    format: "a4",
    scale: 2,
    backgroundColor: args.backgroundColor ?? "#ffffff",
  });

  root.unmount();
  host.remove();
  return res;
}

