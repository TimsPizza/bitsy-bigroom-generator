import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useEditorStore } from "@/store/editorStore";
import { BITSY_TILE_SIZE, type DrawingFrame, type WorldPoint } from "@/types/editor";

const CELL_SIZE = 16;
const EMPTY_FILL = "#f8f2e8";
const SOLID_FILL = "#d96d2d";
const PASSABLE_FILL = "#5b9a65";
const GRIDLINE = "rgba(30, 33, 26, 0.12)";
const ROOM_GRIDLINE = "rgba(30, 33, 26, 0.35)";
const AVATAR_ROOM_OUTLINE = "#dd3d2a";
const AVATAR_ROOM_FILL = "rgba(221, 61, 42, 0.14)";
const SELECTED_ROOM_OUTLINE = "#245d93";
const SELECTED_ROOM_FILL = "rgba(36, 93, 147, 0.12)";
const ROOM_LABEL_FILL = "rgba(255, 250, 241, 0.92)";
const ROOM_LABEL_TEXT = "#4c4433";
const AVATAR_MARKER_FILL = "#fff5db";
const AVATAR_MARKER_STROKE = "#7d1f17";
const SPRITE_MARKER_FILL = "rgba(103, 143, 214, 0.92)";
const ITEM_MARKER_FILL = "rgba(248, 206, 109, 0.92)";

type EditorCanvasProps = {
  interactionMode: "paint" | "avatar" | "sprite" | "item" | "rearrange";
  avatarRoomIndex: number | null;
  avatarPlacement: WorldPoint | null;
  selectedRoomIndex: number | null;
  selectedSpriteId: string | null;
  selectedItemId: string | null;
  onSelectRoom: (roomIndex: number | null) => void;
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

function drawRoomOverlay(
  context: CanvasRenderingContext2D,
  roomIndex: number,
  roomColumns: number,
  roomSize: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
) {
  const roomX = roomIndex % roomColumns;
  const roomY = Math.floor(roomIndex / roomColumns);
  const outlineX = roomX * roomSize * CELL_SIZE;
  const outlineY = roomY * roomSize * CELL_SIZE;
  const outlineWidth = Math.min(roomSize, width - roomX * roomSize) * CELL_SIZE;
  const outlineHeight = Math.min(roomSize, height - roomY * roomSize) * CELL_SIZE;

  context.fillStyle = fill;
  context.fillRect(outlineX, outlineY, outlineWidth, outlineHeight);
  context.strokeStyle = stroke;
  context.lineWidth = 4;
  context.strokeRect(
    outlineX + 1.5,
    outlineY + 1.5,
    outlineWidth - 3,
    outlineHeight - 3,
  );
}

export function EditorCanvas({
  interactionMode,
  avatarRoomIndex,
  avatarPlacement,
  selectedRoomIndex,
  selectedSpriteId,
  selectedItemId,
  onSelectRoom,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const width = useEditorStore((state) => state.width);
  const height = useEditorStore((state) => state.height);
  const roomSize = useEditorStore((state) => state.roomSize);
  const cells = useEditorStore((state) => state.cells);
  const tileBehavior = useEditorStore((state) => state.tileBehavior);
  const importedSource = useEditorStore((state) => state.importedSource);
  const roomSlots = useEditorStore((state) => state.roomSlots);
  const spritePlacements = useEditorStore((state) => state.spritePlacements);
  const itemPlacements = useEditorStore((state) => state.itemPlacements);
  const paintCell = useEditorStore((state) => state.paintCell);
  const eraseCell = useEditorStore((state) => state.eraseCell);
  const setAvatarPlacement = useEditorStore((state) => state.setAvatarPlacement);
  const setSpritePlacement = useEditorStore((state) => state.setSpritePlacement);
  const placeItem = useEditorStore((state) => state.placeItem);
  const clearPlacementsAt = useEditorStore((state) => state.clearPlacementsAt);
  const swapRooms = useEditorStore((state) => state.swapRooms);
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

  const spriteFrames = useMemo(() => {
    const framesById = new Map<string, DrawingFrame>();
    importedSource?.sprites.forEach((sprite) => {
      if (sprite.frames[0]) {
        framesById.set(sprite.id, sprite.frames[0]);
      }
    });
    return framesById;
  }, [importedSource]);

  const itemFrames = useMemo(() => {
    const framesById = new Map<string, DrawingFrame>();
    importedSource?.items.forEach((item) => {
      if (item.frames[0]) {
        framesById.set(item.id, item.frames[0]);
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

    const roomColumns = Math.max(1, Math.ceil(width / roomSize));
    if (avatarRoomIndex !== null) {
      drawRoomOverlay(
        context,
        avatarRoomIndex,
        roomColumns,
        roomSize,
        width,
        height,
        AVATAR_ROOM_FILL,
        AVATAR_ROOM_OUTLINE,
      );
    }

    if (selectedRoomIndex !== null) {
      drawRoomOverlay(
        context,
        selectedRoomIndex,
        roomColumns,
        roomSize,
        width,
        height,
        SELECTED_ROOM_FILL,
        SELECTED_ROOM_OUTLINE,
      );
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

    roomSlots.forEach((slot, roomIndex) => {
      const roomX = roomIndex % roomColumns;
      const roomY = Math.floor(roomIndex / roomColumns);
      const labelX = roomX * roomSize * CELL_SIZE + 6;
      const labelY = roomY * roomSize * CELL_SIZE + 6;
      context.fillStyle = ROOM_LABEL_FILL;
      context.fillRect(labelX - 2, labelY - 2, 54, 14);
      context.fillStyle = ROOM_LABEL_TEXT;
      context.font = '700 10px "Source Code Pro", monospace';
      context.textBaseline = "top";
      context.fillText(slot.roomId, labelX, labelY);
    });

    itemPlacements.forEach((placement) => {
      const markerX = placement.x * CELL_SIZE;
      const markerY = placement.y * CELL_SIZE;
      context.fillStyle = ITEM_MARKER_FILL;
      context.fillRect(markerX + 2, markerY + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      const frame = itemFrames.get(placement.id);
      if (frame) {
        drawFrame(context, frame, markerX, markerY, "#34250c");
      } else {
        context.fillStyle = "#34250c";
        context.font = '700 9px "Source Code Pro", monospace';
        context.fillText(placement.id, markerX + 2, markerY + 3);
      }
    });

    spritePlacements.forEach((placement) => {
      const markerX = placement.x * CELL_SIZE;
      const markerY = placement.y * CELL_SIZE;
      context.fillStyle = SPRITE_MARKER_FILL;
      context.fillRect(markerX + 1, markerY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      const frame = spriteFrames.get(placement.id);
      if (frame) {
        drawFrame(context, frame, markerX, markerY, "#0d1d2f");
      } else {
        context.fillStyle = "#0d1d2f";
        context.font = '700 9px "Source Code Pro", monospace';
        context.fillText(placement.id, markerX + 2, markerY + 3);
      }
    });

    if (avatarPlacement) {
      const markerX = avatarPlacement.x * CELL_SIZE + CELL_SIZE / 2;
      const markerY = avatarPlacement.y * CELL_SIZE + CELL_SIZE / 2;
      context.beginPath();
      context.arc(markerX, markerY, 6, 0, Math.PI * 2);
      context.fillStyle = AVATAR_MARKER_FILL;
      context.fill();
      context.strokeStyle = AVATAR_MARKER_STROKE;
      context.lineWidth = 2;
      context.stroke();

      const avatarFrame = spriteFrames.get("A");
      if (avatarFrame) {
        drawFrame(
          context,
          avatarFrame,
          avatarPlacement.x * CELL_SIZE,
          avatarPlacement.y * CELL_SIZE,
          "#541610",
        );
      } else {
        context.fillStyle = AVATAR_MARKER_STROKE;
        context.font = '700 10px "Source Code Pro", monospace';
        context.fillText(
          "A",
          avatarPlacement.x * CELL_SIZE + 4,
          avatarPlacement.y * CELL_SIZE + 3,
        );
      }
    }
  }, [
    avatarPlacement,
    avatarRoomIndex,
    cells,
    height,
    itemFrames,
    itemPlacements,
    materialFrames,
    roomSize,
    roomSlots,
    selectedRoomIndex,
    spriteFrames,
    spritePlacements,
    tileBehavior,
    width,
  ]);

  function getCellFromEvent(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): WorldPoint | null {
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

  function getRoomIndexFromCell(cell: WorldPoint): number {
    const roomColumns = Math.max(1, Math.ceil(width / roomSize));
    const roomX = Math.floor(cell.x / roomSize);
    const roomY = Math.floor(cell.y / roomSize);
    return roomY * roomColumns + roomX;
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

  function resolveLeftClickMode(cell: WorldPoint): "paint" | "erase" {
    const existingCell = cells[cell.y * width + cell.x];
    return existingCell?.materialId ? "erase" : "paint";
  }

  function handleEntityPlacement(
    cell: WorldPoint,
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    if (event.button === 2) {
      clearPlacementsAt(cell.x, cell.y);
      return;
    }

    if (interactionMode === "avatar") {
      setAvatarPlacement(cell);
      return;
    }

    if (interactionMode === "sprite" && selectedSpriteId) {
      setSpritePlacement(selectedSpriteId, cell);
      return;
    }

    if (interactionMode === "item" && selectedItemId) {
      placeItem(selectedItemId, cell);
    }
  }

  return (
    <div className="editor-canvas-shell">
      <canvas
        ref={canvasRef}
        className={`editor-canvas ${interactionMode !== "paint" ? "start-mode" : ""}`}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          const cell = getCellFromEvent(event);
          if (!cell) {
            return;
          }

          if (interactionMode === "rearrange") {
            if (event.button === 2) {
              onSelectRoom(null);
              setDragMode(null);
              return;
            }

            const roomIndex = getRoomIndexFromCell(cell);
            if (selectedRoomIndex === null) {
              onSelectRoom(roomIndex);
            } else if (selectedRoomIndex === roomIndex) {
              onSelectRoom(null);
            } else {
              swapRooms(selectedRoomIndex, roomIndex);
              onSelectRoom(null);
            }
            setDragMode(null);
            return;
          }

          if (interactionMode !== "paint") {
            handleEntityPlacement(cell, event);
            setDragMode(null);
            return;
          }

          const mode = event.button === 2 ? "erase" : resolveLeftClickMode(cell);
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
          {interactionMode === "paint"
            ? "Left drag toggles current tile, right drag erases."
            : interactionMode === "rearrange"
              ? "Click one room, then click another room to swap them."
              : "Left click places the selected entity, right click clears entities on that cell."}
        </span>
        <span>
          {Math.ceil(width / roomSize)} x {Math.ceil(height / roomSize)} room slots
        </span>
      </div>
    </div>
  );
}
