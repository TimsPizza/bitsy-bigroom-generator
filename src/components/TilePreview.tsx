import { useEffect, useRef } from "react";

import { BITSY_TILE_SIZE, type DrawingFrame } from "@/types/editor";

type TilePreviewProps = {
  frames: DrawingFrame[];
  size?: number;
  className?: string;
};

const FOREGROUND = "#223128";
const BACKGROUND = "#f5efe2";
const GRIDLINE = "#d7cdbb";

export function TilePreview({
  frames,
  size = 48,
  className,
}: TilePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const pixelSize = Math.max(1, Math.floor(size / BITSY_TILE_SIZE));
    const renderSize = pixelSize * BITSY_TILE_SIZE;
    const frame =
      frames[0] ??
      Array.from({ length: BITSY_TILE_SIZE }, () =>
        Array.from({ length: BITSY_TILE_SIZE }, () => 0),
      );

    canvas.width = renderSize;
    canvas.height = renderSize;

    context.clearRect(0, 0, renderSize, renderSize);
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, renderSize, renderSize);

    context.strokeStyle = GRIDLINE;
    context.lineWidth = 1;
    for (let step = 0; step <= BITSY_TILE_SIZE; step += 1) {
      const offset = step * pixelSize + 0.5;
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset, renderSize);
      context.stroke();
      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(renderSize, offset);
      context.stroke();
    }

    context.fillStyle = FOREGROUND;
    frame.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 1) {
          return;
        }

        context.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      });
    });
  }, [frames, size]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
