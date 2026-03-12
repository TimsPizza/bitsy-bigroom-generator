import { create } from "zustand";

import {
  exportMapOnlyGameData,
  hydrateWorldFromSource,
  parseBitsySource,
} from "@/lib/bitsy";
import {
  BITSY_MAP_SIZE,
  type BitsySource,
  type GridCell,
  type TileBehaviorMap,
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
  startCell: { x: number; y: number } | null;
  currentMaterialId: string | null;
  setSourceText: (value: string) => void;
  importGameData: () => { roomColumns: number; roomRows: number } | null;
  setStartCell: (cell: { x: number; y: number } | null) => void;
  setCurrentMaterialId: (materialId: string) => void;
  setTileBlocking: (materialId: string, blocking: boolean) => void;
  paintCell: (x: number, y: number) => void;
  eraseCell: (x: number, y: number) => void;
  clearMap: () => void;
  resizeWorld: (width: number, height: number) => void;
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
  startCell: null,
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
        startCell: importedWorld.startCell,
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
  setStartCell: (startCell) => set({ startCell }),
  setCurrentMaterialId: (materialId) => set({ currentMaterialId: materialId }),
  setTileBlocking: (materialId, blocking) =>
    set((state) => ({
      tileBehavior: {
        ...state.tileBehavior,
        [materialId]: {
          blocking,
        },
      },
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

    set({ cells: nextCells });
  },
  eraseCell: (x, y) => {
    const { width, height, cells } = get();
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const nextCells = copyGrid(cells);
    nextCells[y * width + x] = createEmptyCell();
    set({ cells: nextCells });
  },
  clearMap: () =>
    set((state) => ({
      cells: createGrid(state.width, state.height),
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

    const startCell =
      previous.startCell &&
      previous.startCell.x < width &&
      previous.startCell.y < height
        ? previous.startCell
        : null;

    set({ width, height, cells: resized, startCell, exportText: "" });
  },
  buildExport: () => {
    const {
      importedSource,
      cells,
      width,
      height,
      roomSize,
      startCell,
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
      startCell,
      roomSize,
    );
    set({ exportText, importError: null });
  },
}));
