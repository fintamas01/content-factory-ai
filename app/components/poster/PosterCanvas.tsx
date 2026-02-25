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

const PosterCanvas = forwardRef<any, Props>(function PosterCanvas(
  { template, colors, logoUrl },
  ref
) {
  const stageRef = useRef<any>(null);
  const logoImg = useImage(logoUrl);

  // ✅ forwardRef: parent eléri a stageRef-et
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
        {/* háttér */}
        <Rect x={0} y={0} width={W} height={H} fill={colors.primary} />

        {/* secondary block (ha van a template-ben ilyen rect) */}
        {/* Template layer-ek */}
        {template.layers.map((l: any) => {
          if (l.type === "rect") {
            const fill =
              l.fill === "primary"
                ? colors.primary
                : l.fill === "secondary"
                ? colors.secondary
                : l.fill === "accent"
                ? colors.accent
                : l.fill;

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
            const fill =
              l.fill === "primary"
                ? colors.primary
                : l.fill === "secondary"
                ? colors.secondary
                : l.fill === "accent"
                ? colors.accent
                : l.fill;

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

          // logo placeholder
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