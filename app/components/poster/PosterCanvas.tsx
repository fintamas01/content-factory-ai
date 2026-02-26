"use client";

import React, { forwardRef, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Text, Image as KonvaImage } from "react-konva";

type PosterTemplate = {
  id: string;
  width: number;
  height: number;
  layers: any[];
};

type BrandFonts = {
  headline?: string | null;
  body?: string | null;
};

type Props = {
  template: PosterTemplate;
  colors: { primary: string; secondary: string; accent: string };
  logoUrl: string | null;

  // ✅ ÚJ: háttérkép URL (signed/public)
  bgImageUrl?: string | null;

  brandFonts?: BrandFonts | null;
};

function useImage(url: string | null | undefined) {
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }

    const image = new window.Image();
    image.crossOrigin = "anonymous"; // ✅ exporthoz fontos
    image.src = url;
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
  }, [url]);

  return img;
}

// ✅ token -> valós szín feloldása, kompatibilis "fill" és "color" mezőkkel
function resolveColor(
  raw: any,
  colors: { primary: string; secondary: string; accent: string }
) {
  const v = raw ?? "";
  if (v === "primary") return colors.primary;
  if (v === "secondary") return colors.secondary;
  if (v === "accent") return colors.accent;
  return v; // hex/rgb/rgba stb.
}

function sanitizeFontFamily(input?: string | null) {
  if (!input) return null;

  const v = String(input).trim();

  const bannedExact = new Set([
    "inherit",
    "initial",
    "unset",
    "revert",
    "revert-layer",
    "default",
    "auto",
  ]);

  if (bannedExact.has(v.toLowerCase())) return null;

  const bannedContains = [
    "icon",
    "icons",
    "fi-icons",
    "fontawesome",
    "material icons",
  ];

  const lower = v.toLowerCase();
  if (bannedContains.some((x) => lower.includes(x))) return null;

  return v;
}

function resolveFontFamily(layer: any, brandFonts?: BrandFonts | null) {
  // 1) layer fontFamily (ha valid)
  const layerFont = sanitizeFontFamily(layer?.fontFamily);
  if (layerFont) return layerFont;

  // 2) headline/body alapján brand font
  const isHeadline =
    layer?.id === "headline" ||
    layer?.role === "headline" ||
    layer?.variant === "headline";

  const candidateRaw = isHeadline ? brandFonts?.headline : brandFonts?.body;
  const candidate = sanitizeFontFamily(candidateRaw);

  // 3) fallback
  return candidate || "Inter";
}

// ✅ cover/contain számolás
function computeFitRect(params: {
  imgW: number;
  imgH: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  fit: "cover" | "contain";
}) {
  const { imgW, imgH, boxX, boxY, boxW, boxH, fit } = params;

  const scaleX = boxW / imgW;
  const scaleY = boxH / imgH;

  const scale = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);

  const drawW = imgW * scale;
  const drawH = imgH * scale;

  const x = boxX + (boxW - drawW) / 2;
  const y = boxY + (boxH - drawH) / 2;

  return { x, y, width: drawW, height: drawH };
}

const PosterCanvas = forwardRef<any, Props>(function PosterCanvas(
  { template, colors, logoUrl, bgImageUrl, brandFonts },
  ref
) {
  const stageRef = useRef<any>(null);

  const logoImg = useImage(logoUrl);
  const bgImg = useImage(bgImageUrl);

  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") ref(stageRef.current);
    else (ref as any).current = stageRef.current;
  }, [ref]);

  const W = template.width;
  const H = template.height;

  return (
    <Stage width={W} height={H} ref={stageRef}>
      <Layer>
        {/* Fallback háttér */}
        <Rect x={0} y={0} width={W} height={H} fill={colors.primary} />

        {template.layers.map((l: any) => {
          const rawColor = l.fill ?? l.color;

          // ✅ ÚJ: image layer (háttérkép)
          if (l.type === "image") {
            if (!bgImg) return null;

            const fit: "cover" | "contain" = l.fit === "contain" ? "contain" : "cover";

            const rect = computeFitRect({
              imgW: bgImg.naturalWidth || bgImg.width,
              imgH: bgImg.naturalHeight || bgImg.height,
              boxX: l.x,
              boxY: l.y,
              boxW: l.width,
              boxH: l.height,
              fit,
            });

            return (
              <KonvaImage
                key={l.id}
                image={bgImg}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                opacity={l.opacity ?? 1}
              />
            );
          }

          if (l.type === "rect") {
            const fill = resolveColor(rawColor, colors);
            return (
              <Rect
                key={l.id}
                x={l.x}
                y={l.y}
                width={l.width}
                height={l.height}
                fill={fill}
                opacity={l.opacity ?? 1}
                cornerRadius={l.cornerRadius ?? 0}
              />
            );
          }

          if (l.type === "text") {
            const fill = resolveColor(rawColor, colors);
            const fontFamily = resolveFontFamily(l, brandFonts);

            return (
              <Text
                key={l.id}
                x={l.x}
                y={l.y}
                width={l.width}
                text={l.text}
                fontSize={l.fontSize}
                fontStyle={l.fontStyle ?? "normal"}
                fontFamily={fontFamily}
                fill={fill}
                opacity={l.opacity ?? 1}
                lineHeight={l.lineHeight ?? 1.2}
              />
            );
          }

          if (l.type === "logo") {
            if (!logoImg) return null;
            return (
              <KonvaImage
                key={l.id}
                image={logoImg}
                x={l.x}
                y={l.y}
                width={l.width}
                height={l.height}
                opacity={l.opacity ?? 1}
              />
            );
          }

          return null;
        })}
      </Layer>
    </Stage>
  );
});

export default PosterCanvas;