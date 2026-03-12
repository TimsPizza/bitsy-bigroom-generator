import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { BITSY_TILE_SIZE, type DrawingFrame } from "@/types/editor";
import { useEditorStore } from "@/store/editorStore";

const CELL_SIZE = 16;
const EMPTY_FILL = "#f8f2e8";
const SOLID_FILL = "#d96d2d";
const PASSABLE_FILL = "#5b9a65";
const GRIDLINE = "rgba(30, 33, 26, 0.12)";
const ROOM_GRIDLINE = "rgba(30, 33, 26, 0.35)";
const START_ROOM_OUTLINE = "#dd3d2a";
const START_ROOM_FILL = "rgba(221, 61, 42, 0.14)";
const START_MARKER_FILL = "#fff5db";
const START_MARKER_STROKE = "#7d1f17";

type EditorCanvasProps = {
  interactionMode: "paint" | "start";
  startRoomIndex: number | null;
  startCell: { x: number; y: number } | null;
  onPickStartCell: (cell: { x: number; y: number }) => void;
};

function drawFrame(
  context: CanvasRenderingContext2D,
  frame: DrawingFrame,
  x: number,
  y: number,
  color: string,
) {
  const pixelSize = CELL_SIZE / BITSY_TILE_SIZE;
  context.fillStyle = color;

  frame.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value !== 1) {
        return;
      }

      context.fillRect(
        x + columnIndex * pixelSize,
        y + rowIndex * pixelSize,
        pixelSize,
        pixelSize,
      );
    });
  });
}

export function EditorCanvas({
  interactionMode,
  startRoomIndex,
  startCell,
  onPickStartCell,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const width = useEditorStore((state) => state.width);
  const height = useEditorStore((state) => state.height);
  const roomSize = useEditorStore((state) => state.roomSize);
  const cells = useEditorStore((state) => state.cells);
  const tileBehavior = useEditorStore((state) => state.tileBehavior);
  const importedSource = useEditorStore((state) => state.importedSource);
  const paintCell = useEditorStore((state) => state.paintCell);
  const eraseCell = useEditorStore((state) => state.eraseCell);
  const [dragMode, setDragMode] = useState<"paint" | "erase" | null>(null);

  const materialFrames = useMemo(() => {
    const framesById = new Map<string, DrawingFrame>();
    importedSource?.tiles.forEach((tile) => {
      if (tile.frames[0]) {
        framesById.set(tile.id, tile.frames[0]);
      }
    });
    return framesById;
  }, [importedSource]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    canvas.width = width * CELL_SIZE;
    canvas.height = height * CELL_SIZE;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = EMPTY_FILL;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = cells[y * width + x];
        const originX = x * CELL_SIZE;
        const originY = y * CELL_SIZE;

        if (cell.materialId) {
          context.fillStyle = tileBehavior[cell.materialId]?.blocking
            ? SOLID_FILL
            : PASSABLE_FILL;
          context.fillRect(originX, originY, CELL_SIZE, CELL_SIZE);

          const frame = materialFrames.get(cell.materialId);
          if (frame) {
            drawFrame(context, frame, originX, originY, "#1b2017");
          }
        }

        context.strokeStyle = GRIDLINE;
        context.lineWidth = 1;
        context.strokeRect(originX, originY, CELL_SIZE, CELL_SIZE);
      }
    }

    context.strokeStyle = ROOM_GRIDLINE;
    context.lineWidth = 2;
    for (let x = 0; x <= width; x += roomSize) {
      context.beginPath();
      context.moveTo(x * CELL_SIZE + 0.5, 0);
      context.lineTo(x * CELL_SIZE + 0.5, canvas.height);
      context.stroke();
    }

    for (let y = 0; y <= height; y += roomSize) {
      context.beginPath();
      context.moveTo(0, y * CELL_SIZE + 0.5);
      context.lineTo(canvas.width, y * CELL_SIZE + 0.5);
      context.stroke();
    }

    if (startRoomIndex !== null) {
      const chunkColumns = Math.max(1, Math.ceil(width / roomSize));
      const roomX = startRoomIndex % chunkColumns;
      const roomY = Math.floor(startRoomIndex / chunkColumns);
      const outlineX = roomX * roomSize * CELL_SIZE;
      const outlineY = roomY * roomSize * CELL_SIZE;
      const outlineWidth =
        Math.min(roomSize, width - roomX * roomSize) * CELL_SIZE;
      const outlineHeight =
        Math.min(roomSize, height - roomY * roomSize) * CELL_SIZE;

      context.fillStyle = START_ROOM_FILL;
      context.fillRect(outlineX, outlineY, outlineWidth, outlineHeight);
      context.strokeStyle = START_ROOM_OUTLINE;
      context.lineWidth = 4;
      context.strokeRect(
        outlineX + 1.5,
        outlineY + 1.5,
        outlineWidth - 3,
        outlineHeight - 3,
      );

      context.fillStyle = START_ROOM_OUTLINE;
      context.font = '700 12px "Source Code Pro", monospace';
      context.textBaseline = "top";
      context.fillText("START ROOM", outlineX + 8, outlineY + 8);
    }

    if (startCell) {
      const markerX = startCell.x * CELL_SIZE + CELL_SIZE / 2;
      const markerY = startCell.y * CELL_SIZE + CELL_SIZE / 2;
      context.beginPath();
      context.arc(markerX, markerY, 5, 0, Math.PI * 2);
      context.fillStyle = START_MARKER_FILL;
      context.fill();
      context.strokeStyle = START_MARKER_STROKE;
      context.lineWidth = 2;
      context.stroke();
    }
  }, [
    cells,
    height,
    materialFrames,
    roomSize,
    startCell,
    startRoomIndex,
    tileBehavior,
    width,
  ]);

  function getCellFromEvent(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * height);

    if (x < 0 || y < 0 || x >= width || y >= height) {
      return null;
    }

    return { x, y };
  }

  function applyDrag(
    mode: "paint" | "erase",
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const cell = getCellFromEvent(event);
    if (!cell) {
      return;
    }

    if (mode === "paint") {
      paintCell(cell.x, cell.y);
      return;
    }

    eraseCell(cell.x, cell.y);
  }

  function resolveLeftClickMode(cell: {
    x: number;
    y: number;
  }): "paint" | "erase" {
    const existingCell = cells[cell.y * width + cell.x];
    return existingCell?.materialId ? "erase" : "paint";
  }

  return (
    <div className="editor-canvas-shell">
      <canvas
        ref={canvasRef}
        className={`editor-canvas ${interactionMode === "start" ? "start-mode" : ""}`}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          const cell = getCellFromEvent(event);
          if (!cell) {
            return;
          }

          if (interactionMode === "start") {
            onPickStartCell(cell);
            setDragMode(null);
            return;
          }

          const mode =
            event.button === 2 ? "erase" : resolveLeftClickMode(cell);
          setDragMode(mode);
          applyDrag(mode, event);
        }}
        onPointerMove={(event) => {
          if (!dragMode || interactionMode !== "paint") {
            return;
          }

          applyDrag(dragMode, event);
        }}
        onPointerLeave={() => setDragMode(null)}
        onPointerUp={() => setDragMode(null)}
      />
      <div className="editor-canvas-caption">
        <span>Room guides every {roomSize} cells.</span>
        <span>
          {interactionMode === "start"
            ? "Click a cell to place the avatar start."
            : startRoomIndex === null
              ? "No start room detected."
              : "Start room highlighted in red."}
        </span>
        <span>
          {Math.ceil(width / roomSize)} x {Math.ceil(height / roomSize)}{" "}
          generated rooms
        </span>
      </div>
    </div>
  );
}
