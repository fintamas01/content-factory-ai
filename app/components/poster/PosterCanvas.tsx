"use client";

import React, { forwardRef, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Text, Image as KonvaImage } from "react-konva";

type PosterTemplate = {
  id: string;
  width: number;
  height: number;
  layers: any[];
};

type Props = {
  template: PosterTemplate;
  colors: { primary: string; secondary: string; accent: string };
  logoUrl: string | null;
};

function useImage(url: string | null) {
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const image = new window.Image();
    image.crossOrigin = "anonymous"; // ✅ fontos exporthoz
    image.src = url;
    image.onload = () => setImg(image);
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

const PosterCanvas = forwardRef<any, Props>(function PosterCanvas(
  { template, colors, logoUrl },
  ref
) {
  const stageRef = useRef<any>(null);
  const logoImg = useImage(logoUrl);

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
        {/* Alap háttér (ha nincs bg layer, akkor is legyen valami) */}
        <Rect x={0} y={0} width={W} height={H} fill={colors.primary} />

        {template.layers.map((l: any) => {
          // ✅ template-ekben nálad "color" van, de támogatjuk a "fill"-t is:
          const rawColor = l.fill ?? l.color;

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

            return (
              <Text
                key={l.id}
                x={l.x}
                y={l.y}
                width={l.width}
                text={l.text}
                fontSize={l.fontSize}
                fontStyle={l.fontStyle ?? "normal"}
                fontFamily={l.fontFamily ?? "Inter"}
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