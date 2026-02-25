"use client";

import React, { useMemo } from "react";
import { Stage, Layer, Rect, Text } from "react-konva";
import type { PosterTemplate, PosterLayer } from "@/lib/poster/templates/ig-post-1";

type Props = {
  template: PosterTemplate;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
};

export default function PosterCanvas({ template, colors }: Props) {
  const layers = useMemo(() => {
    return template.layers.map((l: PosterLayer) => {
      if (l.type === "rect" && l.id === "bg") return { ...l, color: colors.primary };
      if (l.type === "rect" && l.id === "card") return { ...l, color: colors.secondary };
      if (l.type === "text" && l.id === "cta") return { ...l, color: colors.accent };
      return l;
    });
  }, [template.layers, colors]);

  return (
    <div className="w-full flex justify-center">
      <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <Stage width={template.width} height={template.height}>
          <Layer>
            {layers.map((l) => {
              if (l.type === "rect") {
                return (
                  <Rect
                    key={l.id}
                    x={l.x}
                    y={l.y}
                    width={l.width}
                    height={l.height}
                    fill={l.color}
                    cornerRadius={l.cornerRadius ?? 0}
                    opacity={l.opacity ?? 1}
                  />
                );
              }

              if (l.type === "text") {
                return (
                  <Text
                    key={l.id}
                    x={l.x}
                    y={l.y}
                    width={l.width}
                    text={l.text}
                    fontSize={l.fontSize}
                    fontStyle={l.fontStyle ?? "normal"}
                    fill={l.color}
                    lineHeight={l.lineHeight ?? 1.2}
                  />
                );
              }

              if (l.type === "logo") {
                return (
                  <Rect
                    key={l.id}
                    x={l.x}
                    y={l.y}
                    width={l.width}
                    height={l.height}
                    fill={"rgba(255,255,255,0.06)"}
                    stroke={"rgba(255,255,255,0.18)"}
                    cornerRadius={20}
                  />
                );
              }

              return null;
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}