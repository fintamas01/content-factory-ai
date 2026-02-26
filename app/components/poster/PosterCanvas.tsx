"use client";

import React, { forwardRef, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Text, Image as KonvaImage, Group, Ellipse } from "react-konva";

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

  /** Háttérkép URL */
  bgImageUrl?: string | null;

  /** Event / career-fair stílus: 3 kör alakú fotó slot */
  photo1Url?: string | null;
  photo2Url?: string | null;
  photo3Url?: string | null;

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
  { template, colors, logoUrl, bgImageUrl, photo1Url, photo2Url, photo3Url, brandFonts },
  ref
) {
  const stageRef = useRef<any>(null);

  const logoImg = useImage(logoUrl);
  const bgImg = useImage(bgImageUrl);
  const photo1Img = useImage(photo1Url);
  const photo2Img = useImage(photo2Url);
  const photo3Img = useImage(photo3Url);

  function getImageBySrcKey(srcKey: string | undefined) {
    if (srcKey === "bg") return bgImg;
    if (srcKey === "photo1") return photo1Img;
    if (srcKey === "photo2") return photo2Img;
    if (srcKey === "photo3") return photo3Img;
    return null;
  }

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

          // Image layer (bg or photo1/2/3, optional circle clip)
          if (l.type === "image") {
            const srcKey = l.srcKey ?? "bg";
            const img = getImageBySrcKey(srcKey);
            if (!img) return null;

            const fit: "cover" | "contain" = l.fit === "contain" ? "contain" : "cover";
            const rect = computeFitRect({
              imgW: img.naturalWidth || img.width,
              imgH: img.naturalHeight || img.height,
              boxX: l.x,
              boxY: l.y,
              boxW: l.width,
              boxH: l.height,
              fit,
            });

            const imageNode = (
              <KonvaImage
                image={img}
                x={rect.x - l.x}
                y={rect.y - l.y}
                width={rect.width}
                height={rect.height}
                opacity={l.opacity ?? 1}
                listening={false}
              />
            );

            if (l.clip === "circle") {
              const r = Math.min(l.width, l.height) / 2;
              return (
                <Group
                  key={l.id}
                  x={l.x}
                  y={l.y}
                  width={l.width}
                  height={l.height}
                  clipFunc={(ctx) => {
                    ctx.beginPath();
                    ctx.arc(l.width / 2, l.height / 2, r, 0, Math.PI * 2);
                    ctx.closePath();
                  }}
                >
                  {imageNode}
                </Group>
              );
            }

            return (
              <KonvaImage
                key={l.id}
                image={img}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                opacity={l.opacity ?? 1}
              />
            );
          }

          // Gradient layer (event / career-fair style)
          if (l.type === "gradient") {
            const angle = (l.angle ?? 0) * (Math.PI / 180);
            const cx = l.x + l.width / 2;
            const cy = l.y + l.height / 2;
            const dx = (l.width / 2) * Math.cos(angle);
            const dy = (l.height / 2) * Math.sin(angle);
            const start = { x: cx - dx, y: cy - dy };
            const end = { x: cx + dx, y: cy + dy };
            const colorStops = (l.colorStops ?? []).flatMap((s: { offset: number; color: string }) => [
              s.offset,
              resolveColor(s.color, colors),
            ]);
            return (
              <Rect
                key={l.id}
                x={l.x}
                y={l.y}
                width={l.width}
                height={l.height}
                fillLinearGradientStartPoint={start}
                fillLinearGradientEndPoint={end}
                fillLinearGradientColorStops={colorStops}
                opacity={l.opacity ?? 1}
              />
            );
          }

          // Ellipse / blob (decorative)
          if (l.type === "ellipse") {
            const fill = resolveColor(l.color, colors);
            return (
              <Ellipse
                key={l.id}
                x={l.x}
                y={l.y}
                radiusX={l.radiusX}
                radiusY={l.radiusY}
                fill={fill}
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