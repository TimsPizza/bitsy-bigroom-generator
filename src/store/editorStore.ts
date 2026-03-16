import { create } from "zustand";

import {
  exportMapOnlyGameData,
  hydrateWorldFromSource,
  nextAvailableRoomId,
  parseBitsySource,
} from "@/lib/bitsy";
import {
  BITSY_MAP_SIZE,
  type BitsySource,
  type GridCell,
  type RoomSlot,
  type TileBehaviorMap,
  type WorldEntityPlacement,
  type WorldPoint,
} from "@/types/editor";

type EditorStore = {
  sourceText: string;
  importedSource: BitsySource | null;
  warnings: string[];
  importError: string | null;
  exportText: string;
  width: number;
  height: number;
  roomSize: number;
  cells: GridCell[];
  tileBehavior: TileBehaviorMap;
  roomSlots: RoomSlot[];
  avatarPlacement: WorldPoint | null;
  spritePlacements: WorldEntityPlacement[];
  itemPlacements: WorldEntityPlacement[];
  currentMaterialId: string | null;
  setSourceText: (value: string) => void;
  importGameData: () => { roomColumns: number; roomRows: number } | null;
  setAvatarPlacement: (cell: WorldPoint | null) => void;
  setSpritePlacement: (spriteId: string, cell: WorldPoint | null) => void;
  placeItem: (itemId: string, cell: WorldPoint) => void;
  clearPlacementsAt: (x: number, y: number) => void;
  setCurrentMaterialId: (materialId: string | null) => void;
  setTileBlocking: (materialId: string, blocking: boolean) => void;
  paintCell: (x: number, y: number) => void;
  eraseCell: (x: number, y: number) => void;
  clearMap: () => void;
  resizeWorld: (width: number, height: number) => void;
  swapRooms: (fromIndex: number, toIndex: number) => void;
  buildExport: () => void;
};

function createEmptyCell(): GridCell {
  return {
    materialId: null,
  };
}

function createGrid(width: number, height: number): GridCell[] {
  return Array.from({ length: width * height }, createEmptyCell);
}

function clampDimension(value: number): number {
  const normalized = Number.isFinite(value)
    ? Math.trunc(value)
    : BITSY_MAP_SIZE;
  const clamped = Math.max(BITSY_MAP_SIZE, normalized);
  return Math.ceil(clamped / BITSY_MAP_SIZE) * BITSY_MAP_SIZE;
}

function copyGrid(cells: GridCell[]): GridCell[] {
  return cells.map((cell) => ({ ...cell }));
}

function getChunkCount(size: number, roomSize: number): number {
  return Math.max(1, Math.ceil(size / roomSize));
}

function createRoomSlots(
  count: number,
  source: BitsySource | null,
  existingSlots: RoomSlot[] = [],
): RoomSlot[] {
  const usedIds = new Set(
    existingSlots.map((slot) => slot.roomId).concat(source?.rooms.map((room) => room.id) ?? []),
  );
  const slots = existingSlots.slice(0, count).map((slot) => ({ ...slot }));

  while (slots.length < count) {
    slots.push({
      roomId: nextAvailableRoomId(usedIds),
      templateRoomId: source?.rooms[0]?.id ?? null,
    });
  }

  return slots;
}

function resizeRoomSlots(
  roomSlots: RoomSlot[],
  previousWidth: number,
  previousHeight: number,
  nextWidth: number,
  nextHeight: number,
  roomSize: number,
  source: BitsySource | null,
): RoomSlot[] {
  const previousColumns = getChunkCount(previousWidth, roomSize);
  const previousRows = getChunkCount(previousHeight, roomSize);
  const nextColumns = getChunkCount(nextWidth, roomSize);
  const nextRows = getChunkCount(nextHeight, roomSize);
  const resized = Array.from({ length: nextColumns * nextRows }, () => null as RoomSlot | null);

  for (let roomY = 0; roomY < Math.min(previousRows, nextRows); roomY += 1) {
    for (let roomX = 0; roomX < Math.min(previousColumns, nextColumns); roomX += 1) {
      resized[roomY * nextColumns + roomX] = {
        ...roomSlots[roomY * previousColumns + roomX],
      };
    }
  }

  const usedIds = new Set(
    resized.flatMap((slot) => (slot ? [slot.roomId] : [])).concat(
      source?.rooms.map((room) => room.id) ?? [],
    ),
  );

  return resized.map(
    (slot) =>
      slot ?? {
        roomId: nextAvailableRoomId(usedIds),
        templateRoomId: source?.rooms[0]?.id ?? null,
      },
  );
}

function isInsideBounds(point: WorldPoint, width: number, height: number): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
}

function getRoomBounds(
  roomIndex: number,
  roomColumns: number,
  roomSize: number,
): { originX: number; originY: number } {
  const roomX = roomIndex % roomColumns;
  const roomY = Math.floor(roomIndex / roomColumns);
  return {
    originX: roomX * roomSize,
    originY: roomY * roomSize,
  };
}

function isPointInsideRoom(
  point: WorldPoint,
  roomIndex: number,
  roomColumns: number,
  roomSize: number,
): boolean {
  const { originX, originY } = getRoomBounds(roomIndex, roomColumns, roomSize);
  return (
    point.x >= originX &&
    point.y >= originY &&
    point.x < originX + roomSize &&
    point.y < originY + roomSize
  );
}

function movePointBetweenRooms(
  point: WorldPoint,
  fromIndex: number,
  toIndex: number,
  roomColumns: number,
  roomSize: number,
): WorldPoint {
  const fromBounds = getRoomBounds(fromIndex, roomColumns, roomSize);
  const toBounds = getRoomBounds(toIndex, roomColumns, roomSize);
  return {
    x: toBounds.originX + (point.x - fromBounds.originX),
    y: toBounds.originY + (point.y - fromBounds.originY),
  };
}

function swapWorldPlacements<T extends WorldPoint>(
  placements: T[],
  fromIndex: number,
  toIndex: number,
  roomColumns: number,
  roomSize: number,
): T[] {
  return placements.map((placement) => {
    if (isPointInsideRoom(placement, fromIndex, roomColumns, roomSize)) {
      return {
        ...placement,
        ...movePointBetweenRooms(placement, fromIndex, toIndex, roomColumns, roomSize),
      };
    }

    if (isPointInsideRoom(placement, toIndex, roomColumns, roomSize)) {
      return {
        ...placement,
        ...movePointBetweenRooms(placement, toIndex, fromIndex, roomColumns, roomSize),
      };
    }

    return placement;
  });
}

function swapRoomCells(
  cells: GridCell[],
  width: number,
  roomSize: number,
  fromIndex: number,
  toIndex: number,
): GridCell[] {
  const nextCells = copyGrid(cells);
  const roomColumns = getChunkCount(width, roomSize);
  const fromBounds = getRoomBounds(fromIndex, roomColumns, roomSize);
  const toBounds = getRoomBounds(toIndex, roomColumns, roomSize);

  for (let offsetY = 0; offsetY < roomSize; offsetY += 1) {
    for (let offsetX = 0; offsetX < roomSize; offsetX += 1) {
      const fromCellIndex =
        (fromBounds.originY + offsetY) * width + fromBounds.originX + offsetX;
      const toCellIndex =
        (toBounds.originY + offsetY) * width + toBounds.originX + offsetX;
      const fromCell = nextCells[fromCellIndex];
      nextCells[fromCellIndex] = { ...nextCells[toCellIndex] };
      nextCells[toCellIndex] = { ...fromCell };
    }
  }

  return nextCells;
}

function createInitialRoomSlots(): RoomSlot[] {
  return createRoomSlots(16, null);
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  sourceText: "",
  importedSource: null,
  warnings: [],
  importError: null,
  exportText: "",
  width: 64,
  height: 64,
  roomSize: BITSY_MAP_SIZE,
  cells: createGrid(64, 64),
  tileBehavior: {},
  roomSlots: createInitialRoomSlots(),
  avatarPlacement: null,
  spritePlacements: [],
  itemPlacements: [],
  currentMaterialId: null,
  setSourceText: (value) => set({ sourceText: value, importError: null }),
  importGameData: () => {
    try {
      const { source, warnings } = parseBitsySource(get().sourceText);
      const importedWorld = hydrateWorldFromSource(source);
      const roomColumns = Math.max(1, importedWorld.width / BITSY_MAP_SIZE);
      const roomRows = Math.max(1, importedWorld.height / BITSY_MAP_SIZE);
      set({
        importedSource: source,
        warnings: [...warnings, ...importedWorld.warnings],
        importError: null,
        exportText: "",
        width: importedWorld.width,
        height: importedWorld.height,
        cells: importedWorld.cells,
        tileBehavior: importedWorld.tileBehavior,
        roomSlots: importedWorld.roomSlots,
        avatarPlacement: importedWorld.avatarPlacement,
        spritePlacements: importedWorld.spritePlacements,
        itemPlacements: importedWorld.itemPlacements,
        currentMaterialId:
          source.tiles.find((tile) => tile.id !== "0")?.id ??
          source.tiles[0]?.id ??
          null,
      });
      return { roomColumns, roomRows };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to parse Bitsy game data.";
      set({
        importedSource: null,
        warnings: [],
        importError: message,
      });
      return null;
    }
  },
  setAvatarPlacement: (avatarPlacement) =>
    set({
      avatarPlacement,
      exportText: "",
    }),
  setSpritePlacement: (spriteId, cell) =>
    set((state) => ({
      spritePlacements: cell
        ? [
            ...state.spritePlacements.filter((placement) => placement.id !== spriteId),
            {
              id: spriteId,
              x: cell.x,
              y: cell.y,
            },
          ]
        : state.spritePlacements.filter((placement) => placement.id !== spriteId),
      exportText: "",
    })),
  placeItem: (itemId, cell) =>
    set((state) => {
      const alreadyPlaced = state.itemPlacements.some(
        (placement) =>
          placement.id === itemId && placement.x === cell.x && placement.y === cell.y,
      );
      if (alreadyPlaced) {
        return state;
      }

      return {
        itemPlacements: [
          ...state.itemPlacements,
          {
            id: itemId,
            x: cell.x,
            y: cell.y,
          },
        ],
        exportText: "",
      };
    }),
  clearPlacementsAt: (x, y) =>
    set((state) => ({
      avatarPlacement:
        state.avatarPlacement?.x === x && state.avatarPlacement.y === y
          ? null
          : state.avatarPlacement,
      spritePlacements: state.spritePlacements.filter(
        (placement) => placement.x !== x || placement.y !== y,
      ),
      itemPlacements: state.itemPlacements.filter(
        (placement) => placement.x !== x || placement.y !== y,
      ),
      exportText: "",
    })),
  setCurrentMaterialId: (currentMaterialId) => set({ currentMaterialId }),
  setTileBlocking: (materialId, blocking) =>
    set((state) => ({
      tileBehavior: {
        ...state.tileBehavior,
        [materialId]: {
          blocking,
        },
      },
      exportText: "",
    })),
  paintCell: (x, y) => {
    const { width, height, cells, currentMaterialId } = get();
    if (
      currentMaterialId === null ||
      x < 0 ||
      y < 0 ||
      x >= width ||
      y >= height
    ) {
      return;
    }

    const nextCells = copyGrid(cells);
    nextCells[y * width + x] = {
      materialId: currentMaterialId,
    };

    set({ cells: nextCells, exportText: "" });
  },
  eraseCell: (x, y) => {
    const { width, height, cells } = get();
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const nextCells = copyGrid(cells);
    nextCells[y * width + x] = createEmptyCell();
    set({ cells: nextCells, exportText: "" });
  },
  clearMap: () =>
    set((state) => ({
      cells: createGrid(state.width, state.height),
      avatarPlacement: null,
      spritePlacements: [],
      itemPlacements: [],
      exportText: "",
    })),
  resizeWorld: (nextWidth, nextHeight) => {
    const width = clampDimension(nextWidth);
    const height = clampDimension(nextHeight);
    const previous = get();
    const resized = createGrid(width, height);

    for (let y = 0; y < Math.min(height, previous.height); y += 1) {
      for (let x = 0; x < Math.min(width, previous.width); x += 1) {
        resized[y * width + x] = { ...previous.cells[y * previous.width + x] };
      }
    }

    const avatarPlacement =
      previous.avatarPlacement && isInsideBounds(previous.avatarPlacement, width, height)
        ? previous.avatarPlacement
        : null;
    const spritePlacements = previous.spritePlacements.filter((placement) =>
      isInsideBounds(placement, width, height),
    );
    const itemPlacements = previous.itemPlacements.filter((placement) =>
      isInsideBounds(placement, width, height),
    );
    const roomSlots = resizeRoomSlots(
      previous.roomSlots,
      previous.width,
      previous.height,
      width,
      height,
      previous.roomSize,
      previous.importedSource,
    );

    set({
      width,
      height,
      cells: resized,
      roomSlots,
      avatarPlacement,
      spritePlacements,
      itemPlacements,
      exportText: "",
    });
  },
  swapRooms: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) {
      return;
    }

    const state = get();
    const roomColumns = getChunkCount(state.width, state.roomSize);
    const nextRoomSlots = state.roomSlots.map((slot) => ({ ...slot }));
    const fromSlot = nextRoomSlots[fromIndex];
    const toSlot = nextRoomSlots[toIndex];
    if (!fromSlot || !toSlot) {
      return;
    }

    nextRoomSlots[fromIndex] = toSlot;
    nextRoomSlots[toIndex] = fromSlot;

    const avatarPlacement = state.avatarPlacement
      ? swapWorldPlacements(
          [state.avatarPlacement],
          fromIndex,
          toIndex,
          roomColumns,
          state.roomSize,
        )[0] ?? null
      : null;

    set({
      cells: swapRoomCells(state.cells, state.width, state.roomSize, fromIndex, toIndex),
      roomSlots: nextRoomSlots,
      avatarPlacement,
      spritePlacements: swapWorldPlacements(
        state.spritePlacements,
        fromIndex,
        toIndex,
        roomColumns,
        state.roomSize,
      ),
      itemPlacements: swapWorldPlacements(
        state.itemPlacements,
        fromIndex,
        toIndex,
        roomColumns,
        state.roomSize,
      ),
      exportText: "",
    });
  },
  buildExport: () => {
    const {
      importedSource,
      cells,
      width,
      height,
      roomSize,
      roomSlots,
      avatarPlacement,
      spritePlacements,
      itemPlacements,
      tileBehavior,
    } = get();
    if (!importedSource) {
      set({ importError: "Import Bitsy game data before exporting." });
      return;
    }

    const exportText = exportMapOnlyGameData(
      importedSource,
      cells,
      tileBehavior,
      width,
      height,
      roomSlots,
      avatarPlacement,
      spritePlacements,
      itemPlacements,
      roomSize,
    );
    set({ exportText, importError: null });
  },
}));
