import {
  BITSY_MAP_SIZE,
  BITSY_TILE_SIZE,
  type BitsyAvatarStart,
  type BitsyRoom,
  type BitsySource,
  type BitsyTile,
  type DrawingFrame,
  type GeneratedRoom,
  type GridCell,
  type ImportResult,
  type TileBehaviorMap,
} from "@/types/editor";

const ROOM_DIRECTIVES = new Set(["ROOM", "SET"]);
const TILE_DIRECTIVE = "TIL";
const DRAWING_DIRECTIVE = "DRW";
const FLAG_DIRECTIVE = "!";
const BLANK_TILE_ID = "0";

function normalizeSource(raw: string): string {
  return raw.replace(/\r\n?/g, "\n");
}

function splitLines(raw: string): string[] {
  return normalizeSource(raw).split("\n");
}

function getDirective(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return "";
  }

  return trimmed.split(/\s+/, 1)[0] ?? "";
}

function getId(line: string): string {
  const trimmed = line.trim();
  const tokens = trimmed.split(/\s+/);
  return tokens[1] ?? "";
}

function isBitmapRow(line: string): boolean {
  return /^[01]{8}$/.test(line.trim());
}

function parseDrawingFrames(
  lines: string[],
  startIndex: number,
): { frames: DrawingFrame[]; nextIndex: number } {
  const frames: DrawingFrame[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const frame: DrawingFrame = [];

    for (let row = 0; row < BITSY_TILE_SIZE; row += 1) {
      const line = lines[index + row]?.trim() ?? "";
      if (!isBitmapRow(line)) {
        if (frames.length === 0) {
          return { frames: [], nextIndex: startIndex };
        }

        return { frames, nextIndex: index };
      }

      frame.push(Array.from(line, (char) => Number.parseInt(char, 10)));
    }

    frames.push(frame);
    index += BITSY_TILE_SIZE;

    if (lines[index]?.trim().startsWith(">")) {
      index += 1;
      continue;
    }

    break;
  }

  return { frames, nextIndex: index };
}

function parseRoomTileRow(line: string, roomFormat: 0 | 1): string[] {
  const trimmed = line.trim();
  if (roomFormat === 1 || trimmed.includes(",")) {
    return trimmed.split(",");
  }

  return Array.from(trimmed);
}

function parseAvatarStartCoords(line: string): { x: number; y: number } | null {
  const tokens = line.trim().split(/\s+/);
  const coordToken = tokens[2];
  if (!coordToken) {
    return null;
  }

  const [xToken, yToken] = coordToken.split(",");
  const x = Number.parseInt(xToken ?? "", 10);
  const y = Number.parseInt(yToken ?? "", 10);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  return { x, y };
}

function parseRoomBlock(
  lines: string[],
  startIndex: number,
  roomFormat: 0 | 1,
): {
  room: BitsyRoom;
  avatarStart: BitsyAvatarStart | null;
  nextIndex: number;
} {
  const keyword = getDirective(lines[startIndex]);
  const room: BitsyRoom = {
    id: getId(lines[startIndex]),
    keyword: keyword === "SET" ? "SET" : "ROOM",
    tilemap: [],
    walls: [],
    exits: [],
    pal: null,
    name: null,
    ava: null,
    tune: null,
  };
  let avatarStart: BitsyAvatarStart | null = null;

  let index = startIndex + 1;

  for (let row = 0; row < BITSY_MAP_SIZE && index < lines.length; row += 1) {
    room.tilemap.push(parseRoomTileRow(lines[index], roomFormat));
    index += 1;
  }

  while (index < lines.length && lines[index].trim().length > 0) {
    const directive = getDirective(lines[index]);
    if (directive === "PAL") {
      room.pal = getId(lines[index]);
    } else if (directive === "NAME") {
      room.name = lines[index].trim().slice(5).trim();
    } else if (directive === "AVA") {
      room.ava = getId(lines[index]);
    } else if (directive === "TUNE") {
      room.tune = getId(lines[index]);
    } else if (directive === "WAL") {
      room.walls = getId(lines[index])
        .split(",")
        .filter((value) => value.length > 0);
    } else if (directive === "EXT") {
      const tokens = lines[index].trim().split(/\s+/);
      const [sourceXToken, sourceYToken] = (tokens[1] ?? "").split(",");
      const [destXToken, destYToken] = (tokens[3] ?? "").split(",");
      const sourceX = Number.parseInt(sourceXToken ?? "", 10);
      const sourceY = Number.parseInt(sourceYToken ?? "", 10);
      const destX = Number.parseInt(destXToken ?? "", 10);
      const destY = Number.parseInt(destYToken ?? "", 10);

      if (
        tokens[2] &&
        !Number.isNaN(sourceX) &&
        !Number.isNaN(sourceY) &&
        !Number.isNaN(destX) &&
        !Number.isNaN(destY)
      ) {
        room.exits.push({
          x: sourceX,
          y: sourceY,
          destRoomId: tokens[2],
          destX,
          destY,
        });
      }
    } else if (directive === "SPR" && getId(lines[index]) === "A") {
      const coords = parseAvatarStartCoords(lines[index]);
      if (coords) {
        avatarStart = {
          roomId: room.id,
          x: coords.x,
          y: coords.y,
        };
      }
    }

    index += 1;
  }

  while (index < lines.length && lines[index].trim().length === 0) {
    index += 1;
  }

  return { room, avatarStart, nextIndex: index };
}

function parseTileBlock(
  lines: string[],
  startIndex: number,
): { tile: BitsyTile; nextIndex: number } {
  const tile: BitsyTile = {
    id: getId(lines[startIndex]),
    name: null,
    drawingId: null,
    frames: [],
    isWall: null,
  };

  let index = startIndex + 1;
  const nextLine = lines[index]?.trim() ?? "";

  if (getDirective(nextLine) === DRAWING_DIRECTIVE) {
    tile.drawingId = getId(nextLine);
    index += 1;
  } else if (isBitmapRow(nextLine)) {
    const parsed = parseDrawingFrames(lines, index);
    tile.frames = parsed.frames;
    index = parsed.nextIndex;
  }

  while (index < lines.length && lines[index].trim().length > 0) {
    const directive = getDirective(lines[index]);
    if (directive === "NAME") {
      tile.name = lines[index].trim().slice(5).trim();
    } else if (directive === "WAL") {
      tile.isWall = lines[index].trim().endsWith("true");
    }

    index += 1;
  }

  while (index < lines.length && lines[index].trim().length === 0) {
    index += 1;
  }

  return { tile, nextIndex: index };
}

function parseDrawingBlock(
  lines: string[],
  startIndex: number,
): { drawingId: string; frames: DrawingFrame[]; nextIndex: number } {
  const drawingId = getId(lines[startIndex]);
  const parsed = parseDrawingFrames(lines, startIndex + 1);
  let nextIndex = parsed.nextIndex;

  while (nextIndex < lines.length && lines[nextIndex].trim().length === 0) {
    nextIndex += 1;
  }

  return {
    drawingId,
    frames: parsed.frames,
    nextIndex,
  };
}

function parseRoomFormat(lines: string[]): 0 | 1 {
  for (const line of lines) {
    if (getDirective(line) !== FLAG_DIRECTIVE) {
      continue;
    }

    const tokens = line.trim().split(/\s+/);
    if (tokens[1] === "ROOM_FORMAT") {
      return tokens[2] === "1" ? 1 : 0;
    }
  }

  return 0;
}

function parseAvatarSpriteBlock(
  lines: string[],
  startIndex: number,
): {
  avatarStart: BitsyAvatarStart | null;
  blockRange: { start: number; end: number };
  nextIndex: number;
} {
  let index = startIndex + 1;
  let avatarStart: BitsyAvatarStart | null = null;

  while (index < lines.length && lines[index].trim().length > 0) {
    const directive = getDirective(lines[index]);
    if (directive === "POS") {
      const tokens = lines[index].trim().split(/\s+/);
      const roomId = tokens[1] ?? "";
      const [xToken, yToken] = (tokens[2] ?? "").split(",");
      const x = Number.parseInt(xToken ?? "", 10);
      const y = Number.parseInt(yToken ?? "", 10);

      if (roomId && !Number.isNaN(x) && !Number.isNaN(y)) {
        avatarStart = { roomId, x, y };
      }
    }

    index += 1;
  }

  while (index < lines.length && lines[index].trim().length === 0) {
    index += 1;
  }

  return {
    avatarStart,
    blockRange: { start: startIndex, end: index },
    nextIndex: index,
  };
}

function renderRoomTileRow(tileIds: string[], roomFormat: 0 | 1): string {
  return roomFormat === 1 ? tileIds.join(",") : tileIds.join("");
}

function collectUniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ids) {
    if (id === BLANK_TILE_ID || seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push(id);
  }

  return result;
}

function nextAvailableRoomId(usedIds: Set<string>): string {
  let candidate = 0;
  while (usedIds.has(String(candidate))) {
    candidate += 1;
  }

  const value = String(candidate);
  usedIds.add(value);
  return value;
}

function buildRoomIdList(source: BitsySource, neededCount: number): string[] {
  const usedIds = new Set(source.rooms.map((room) => room.id));
  const roomIds = source.rooms.map((room) => room.id);

  while (roomIds.length < neededCount) {
    roomIds.push(nextAvailableRoomId(usedIds));
  }

  return roomIds;
}

function findRoomIndexById(source: BitsySource, roomId: string): number {
  return source.rooms.findIndex((room) => room.id === roomId);
}

export function mapAvatarStartToWorldCell(
  source: BitsySource,
  width: number,
  roomSize = BITSY_MAP_SIZE,
): { x: number; y: number } | null {
  if (!source.avatarStart) {
    return null;
  }

  const roomIndex = findRoomIndexById(source, source.avatarStart.roomId);
  if (roomIndex < 0) {
    return null;
  }

  const chunkColumns = Math.max(1, Math.ceil(width / roomSize));
  const roomX = roomIndex % chunkColumns;
  const roomY = Math.floor(roomIndex / chunkColumns);

  return {
    x: roomX * roomSize + source.avatarStart.x,
    y: roomY * roomSize + source.avatarStart.y,
  };
}

function getDirectionalDelta(
  exit: { x: number; y: number },
  roomSize: number,
): { x: number; y: number } | null {
  if (exit.x === roomSize - 1) {
    return { x: 1, y: 0 };
  }
  if (exit.x === 0) {
    return { x: -1, y: 0 };
  }
  if (exit.y === roomSize - 1) {
    return { x: 0, y: 1 };
  }
  if (exit.y === 0) {
    return { x: 0, y: -1 };
  }

  return null;
}

type ImportedWorld = {
  width: number;
  height: number;
  cells: GridCell[];
  tileBehavior: TileBehaviorMap;
  startCell: { x: number; y: number } | null;
  warnings: string[];
};

function createTileBehaviorFromSource(source: BitsySource): {
  tileBehavior: TileBehaviorMap;
  warnings: string[];
} {
  const warnings: string[] = [];
  const tileBehavior: TileBehaviorMap = Object.fromEntries(
    source.tiles.map((tile) => [
      tile.id,
      {
        blocking: tile.isWall ?? false,
      },
    ]),
  );

  const conflictNoted = new Set<string>();
  for (const room of source.rooms) {
    const roomWallSet = new Set(room.walls);
    const usedTileIds = new Set(
      room.tilemap.flat().filter((id) => id !== BLANK_TILE_ID),
    );
    for (const tileId of usedTileIds) {
      const roomSaysBlocking = roomWallSet.has(tileId);
      const currentBlocking = tileBehavior[tileId]?.blocking ?? false;
      if (roomSaysBlocking && !currentBlocking) {
        tileBehavior[tileId] = { blocking: true };
      } else if (
        roomSaysBlocking !== currentBlocking &&
        !conflictNoted.has(tileId)
      ) {
        warnings.push(
          `Tile ${tileId} has inconsistent room-level wall settings. Import uses a single per-tile blocking rule, so it was normalized.`,
        );
        conflictNoted.add(tileId);
        if (roomSaysBlocking) {
          tileBehavior[tileId] = { blocking: true };
        }
      }
    }
  }

  return { tileBehavior, warnings };
}

export function hydrateWorldFromSource(
  source: BitsySource,
  roomSize = BITSY_MAP_SIZE,
): ImportedWorld {
  const { tileBehavior, warnings } = createTileBehaviorFromSource(source);
  if (source.rooms.length === 0) {
    const width = roomSize;
    const height = roomSize;
    return {
      width,
      height,
      cells: Array.from({ length: width * height }, () => ({
        materialId: null,
      })),
      tileBehavior,
      startCell: null,
      warnings,
    };
  }

  const roomMap = new Map(source.rooms.map((room) => [room.id, room]));
  const placements = new Map<string, { x: number; y: number }>();
  let nextComponentX = 0;

  for (const room of source.rooms) {
    if (placements.has(room.id)) {
      continue;
    }

    const queue = [room.id];
    placements.set(room.id, { x: nextComponentX, y: 0 });
    const componentIds: string[] = [];

    while (queue.length > 0) {
      const roomId = queue.shift();
      if (!roomId) {
        continue;
      }

      componentIds.push(roomId);
      const placed = placements.get(roomId);
      const currentRoom = roomMap.get(roomId);
      if (!placed || !currentRoom) {
        continue;
      }

      for (const exit of currentRoom.exits) {
        const delta = getDirectionalDelta(exit, roomSize);
        const destinationRoom = roomMap.get(exit.destRoomId);
        if (!delta || !destinationRoom) {
          continue;
        }

        if (!placements.has(exit.destRoomId)) {
          placements.set(exit.destRoomId, {
            x: placed.x + delta.x,
            y: placed.y + delta.y,
          });
          queue.push(exit.destRoomId);
        }
      }
    }

    const componentMaxX = Math.max(
      ...componentIds
        .map((id) => placements.get(id)?.x ?? nextComponentX)
        .concat(nextComponentX),
    );
    nextComponentX = componentMaxX + 1;
  }

  const allPositions = source.rooms.map(
    (room) => placements.get(room.id) ?? { x: 0, y: 0 },
  );
  const minX = Math.min(...allPositions.map((position) => position.x));
  const minY = Math.min(...allPositions.map((position) => position.y));
  const maxX = Math.max(...allPositions.map((position) => position.x));
  const maxY = Math.max(...allPositions.map((position) => position.y));
  const roomsWide = maxX - minX + 1;
  const roomsTall = maxY - minY + 1;
  const width = roomsWide * roomSize;
  const height = roomsTall * roomSize;
  const cells: GridCell[] = Array.from({ length: width * height }, () => ({
    materialId: null,
  }));

  for (const room of source.rooms) {
    const placement = placements.get(room.id);
    if (!placement) {
      continue;
    }

    const originX = (placement.x - minX) * roomSize;
    const originY = (placement.y - minY) * roomSize;
    room.tilemap.forEach((row, rowIndex) => {
      row.forEach((tileId, columnIndex) => {
        cells[getCellIndex(originX + columnIndex, originY + rowIndex, width)] =
          {
            materialId: tileId === BLANK_TILE_ID ? null : tileId,
          };
      });
    });
  }

  let startCell: { x: number; y: number } | null = null;
  if (source.avatarStart) {
    const placement = placements.get(source.avatarStart.roomId);
    if (placement) {
      startCell = {
        x: (placement.x - minX) * roomSize + source.avatarStart.x,
        y: (placement.y - minY) * roomSize + source.avatarStart.y,
      };
    }
  }

  return {
    width,
    height,
    cells,
    tileBehavior,
    startCell,
    warnings,
  };
}

function getCellIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

function isCellSolid(
  cells: GridCell[],
  tileBehavior: TileBehaviorMap,
  width: number,
  x: number,
  y: number,
): boolean {
  const materialId = cells[getCellIndex(x, y, width)]?.materialId;
  if (!materialId) {
    return false;
  }

  return tileBehavior[materialId]?.blocking ?? false;
}

function buildChunkTilemap(
  cells: GridCell[],
  width: number,
  chunkX: number,
  chunkY: number,
  roomSize: number,
): string[][] {
  const tilemap: string[][] = [];
  const originX = chunkX * roomSize;
  const originY = chunkY * roomSize;

  for (let y = 0; y < roomSize; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < roomSize; x += 1) {
      const cell = cells[getCellIndex(originX + x, originY + y, width)];
      row.push(cell?.materialId ?? BLANK_TILE_ID);
    }
    tilemap.push(row);
  }

  return tilemap;
}

function getInnerEdgeCoordinate(roomSize: number, side: "min" | "max"): number {
  if (roomSize <= 1) {
    return 0;
  }

  return side === "min" ? 1 : roomSize - 2;
}

function isLocalCellSolid(
  cells: GridCell[],
  tileBehavior: TileBehaviorMap,
  width: number,
  chunkX: number,
  chunkY: number,
  roomSize: number,
  localX: number,
  localY: number,
): boolean {
  const globalX = chunkX * roomSize + localX;
  const globalY = chunkY * roomSize + localY;
  return isCellSolid(cells, tileBehavior, width, globalX, globalY);
}

function hasEscapeStep(
  cells: GridCell[],
  tileBehavior: TileBehaviorMap,
  width: number,
  chunkX: number,
  chunkY: number,
  roomSize: number,
  localX: number,
  localY: number,
  blockedNeighbor: { x: number; y: number },
): boolean {
  const neighborOffsets = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (const offset of neighborOffsets) {
    const nextX = localX + offset.x;
    const nextY = localY + offset.y;
    if (nextX < 0 || nextY < 0 || nextX >= roomSize || nextY >= roomSize) {
      continue;
    }

    if (nextX === blockedNeighbor.x && nextY === blockedNeighbor.y) {
      continue;
    }

    if (
      !isLocalCellSolid(
        cells,
        tileBehavior,
        width,
        chunkX,
        chunkY,
        roomSize,
        nextX,
        nextY,
      )
    ) {
      return true;
    }
  }

  return false;
}

function findLandingSpot(
  cells: GridCell[],
  tileBehavior: TileBehaviorMap,
  width: number,
  chunkX: number,
  chunkY: number,
  roomSize: number,
  intended: { x: number; y: number },
  blockedNeighbor: { x: number; y: number },
): { x: number; y: number } {
  const candidates: Array<{
    x: number;
    y: number;
    distance: number;
    hasEscape: boolean;
  }> = [];
  const minCoordinate = roomSize > 2 ? 1 : 0;
  const maxCoordinate = roomSize > 2 ? roomSize - 2 : roomSize - 1;

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const candidateX = intended.x + offsetX;
      const candidateY = intended.y + offsetY;
      if (
        candidateX < minCoordinate ||
        candidateY < minCoordinate ||
        candidateX > maxCoordinate ||
        candidateY > maxCoordinate
      ) {
        continue;
      }

      if (
        isLocalCellSolid(
          cells,
          tileBehavior,
          width,
          chunkX,
          chunkY,
          roomSize,
          candidateX,
          candidateY,
        )
      ) {
        continue;
      }

      candidates.push({
        x: candidateX,
        y: candidateY,
        distance: Math.abs(offsetX) + Math.abs(offsetY),
        hasEscape: hasEscapeStep(
          cells,
          tileBehavior,
          width,
          chunkX,
          chunkY,
          roomSize,
          candidateX,
          candidateY,
          blockedNeighbor,
        ),
      });
    }
  }

  candidates.sort((left, right) => {
    if (left.hasEscape !== right.hasEscape) {
      return left.hasEscape ? -1 : 1;
    }

    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }

    if (left.y !== right.y) {
      return left.y - right.y;
    }

    return left.x - right.x;
  });

  return candidates[0] ?? intended;
}

function findHorizontalConnections(
  cells: GridCell[],
  tileBehavior: TileBehaviorMap,
  width: number,
  roomSize: number,
  leftChunkX: number,
  chunkY: number,
): number[] {
  const matches: number[] = [];
  const minY = roomSize > 2 ? 1 : 0;
  const maxY = roomSize > 2 ? roomSize - 2 : roomSize - 1;

  for (let localY = minY; localY <= maxY; localY += 1) {
    const globalY = chunkY * roomSize + localY;
    const leftX = (leftChunkX + 1) * roomSize - 1;
    const rightX = leftX + 1;
    const open =
      !isCellSolid(cells, tileBehavior, width, leftX, globalY) &&
      !isCellSolid(cells, tileBehavior, width, rightX, globalY);

    if (!open) {
      continue;
    }

    matches.push(localY);
  }

  return matches;
}

function findVerticalConnections(
  cells: GridCell[],
  tileBehavior: TileBehaviorMap,
  width: number,
  roomSize: number,
  chunkX: number,
  topChunkY: number,
): number[] {
  const matches: number[] = [];
  const minX = roomSize > 2 ? 1 : 0;
  const maxX = roomSize > 2 ? roomSize - 2 : roomSize - 1;

  for (let localX = minX; localX <= maxX; localX += 1) {
    const globalX = chunkX * roomSize + localX;
    const topY = (topChunkY + 1) * roomSize - 1;
    const bottomY = topY + 1;
    const open =
      !isCellSolid(cells, tileBehavior, width, globalX, topY) &&
      !isCellSolid(cells, tileBehavior, width, globalX, bottomY);

    if (!open) {
      continue;
    }

    matches.push(localX);
  }

  return matches;
}

export function parseBitsySource(rawSource: string): ImportResult {
  const raw = normalizeSource(rawSource).trim();
  if (raw.length === 0) {
    throw new Error("Paste a Bitsy game data export before importing.");
  }

  const lines = splitLines(raw);
  const roomFormat = parseRoomFormat(lines);
  const rooms: BitsyRoom[] = [];
  const roomBlockRanges: Array<{ start: number; end: number }> = [];
  const tiles: BitsyTile[] = [];
  const drawings = new Map<string, DrawingFrame[]>();
  let roomKeyword: "ROOM" | "SET" = "ROOM";
  let avatarStart: BitsyAvatarStart | null = null;
  let avatarStartSource: BitsySource["avatarStartSource"] = null;

  let index = 0;
  while (index < lines.length) {
    const directive = getDirective(lines[index]);

    if (ROOM_DIRECTIVES.has(directive)) {
      roomKeyword = directive === "SET" ? "SET" : "ROOM";
      const parsedRoom = parseRoomBlock(lines, index, roomFormat);
      const { room, nextIndex } = parsedRoom;
      rooms.push(room);
      roomBlockRanges.push({ start: index, end: nextIndex });
      if (avatarStart === null && parsedRoom.avatarStart !== null) {
        avatarStart = parsedRoom.avatarStart;
        avatarStartSource = { kind: "room" };
      }
      index = nextIndex;
      continue;
    }

    if (directive === TILE_DIRECTIVE) {
      const { tile, nextIndex } = parseTileBlock(lines, index);
      tiles.push(tile);
      index = nextIndex;
      continue;
    }

    if (directive === DRAWING_DIRECTIVE) {
      const { drawingId, frames, nextIndex } = parseDrawingBlock(lines, index);
      drawings.set(drawingId, frames);
      index = nextIndex;
      continue;
    }

    if (directive === "SPR" && getId(lines[index]) === "A") {
      const parsedSprite = parseAvatarSpriteBlock(lines, index);
      if (avatarStart === null && parsedSprite.avatarStart !== null) {
        avatarStart = parsedSprite.avatarStart;
        avatarStartSource = {
          kind: "sprite_pos",
          blockRange: parsedSprite.blockRange,
        };
      }
      index = parsedSprite.nextIndex;
      continue;
    }

    index += 1;
  }

  const resolvedTiles = tiles.map<BitsyTile>((tile) => ({
    ...tile,
    frames:
      tile.frames.length > 0
        ? tile.frames
        : (drawings.get(tile.drawingId ?? "") ?? []),
  }));

  if (resolvedTiles.length === 0) {
    throw new Error("No tile definitions were found in the pasted game data.");
  }

  const roomSectionRange =
    roomBlockRanges.length === 0
      ? null
      : {
          start: roomBlockRanges[0].start,
          end: roomBlockRanges[roomBlockRanges.length - 1].end,
        };

  const warnings: string[] = [];
  if (roomFormat === 0) {
    warnings.push(
      "This source uses ROOM_FORMAT 0. Export will preserve it, but multi-character tile ids are less forgiving.",
    );
  }

  if (rooms.length === 0) {
    warnings.push(
      "No ROOM blocks were found. Export will append generated rooms before the rest of the game data.",
    );
  }

  return {
    source: {
      raw,
      lines,
      roomFormat,
      roomKeyword,
      roomSectionRange,
      rooms,
      tiles: resolvedTiles,
      avatarStart,
      avatarStartSource,
    },
    warnings,
  };
}

export function generateRoomsFromGrid(
  source: BitsySource,
  cells: GridCell[],
  tileBehavior: TileBehaviorMap,
  width: number,
  height: number,
  startCell: { x: number; y: number } | null,
  roomSize = BITSY_MAP_SIZE,
): GeneratedRoom[] {
  const chunkColumns = Math.max(1, Math.ceil(width / roomSize));
  const chunkRows = Math.max(1, Math.ceil(height / roomSize));
  const generatedCount = chunkColumns * chunkRows;
  const roomIds = buildRoomIdList(source, generatedCount);
  const rooms: GeneratedRoom[] = [];

  for (let chunkY = 0; chunkY < chunkRows; chunkY += 1) {
    for (let chunkX = 0; chunkX < chunkColumns; chunkX += 1) {
      const roomIndex = chunkY * chunkColumns + chunkX;
      const tilemap = buildChunkTilemap(cells, width, chunkX, chunkY, roomSize);
      const walls = collectUniqueIds(
        tilemap.flatMap((row, rowIndex) =>
          row.filter((tileId, columnIndex) => {
            const globalX = chunkX * roomSize + columnIndex;
            const globalY = chunkY * roomSize + rowIndex;
            return (
              tileId !== BLANK_TILE_ID &&
              isCellSolid(cells, tileBehavior, width, globalX, globalY)
            );
          }),
        ),
      );

      rooms.push({
        id: roomIds[roomIndex],
        sourceRoom: source.rooms[roomIndex] ?? source.rooms[0] ?? null,
        tilemap,
        walls,
        exits: [],
        avatarStart: null,
      });
    }
  }

  if (startCell) {
    const startChunkX = Math.floor(startCell.x / roomSize);
    const startChunkY = Math.floor(startCell.y / roomSize);
    const roomIndex = startChunkY * chunkColumns + startChunkX;
    const room = rooms[roomIndex];
    if (room) {
      room.avatarStart = {
        x: startCell.x % roomSize,
        y: startCell.y % roomSize,
      };
    }
  }

  for (let chunkY = 0; chunkY < chunkRows; chunkY += 1) {
    for (let chunkX = 0; chunkX < chunkColumns; chunkX += 1) {
      const roomIndex = chunkY * chunkColumns + chunkX;
      const room = rooms[roomIndex];

      if (chunkX < chunkColumns - 1) {
        const matchYs = findHorizontalConnections(
          cells,
          tileBehavior,
          width,
          roomSize,
          chunkX,
          chunkY,
        );
        if (matchYs.length > 0) {
          const rightRoom = rooms[roomIndex + 1];
          for (const matchY of matchYs) {
            const rightLanding = findLandingSpot(
              cells,
              tileBehavior,
              width,
              chunkX + 1,
              chunkY,
              roomSize,
              {
                x: getInnerEdgeCoordinate(roomSize, "min"),
                y: matchY,
              },
              { x: 0, y: matchY },
            );
            const leftLanding = findLandingSpot(
              cells,
              tileBehavior,
              width,
              chunkX,
              chunkY,
              roomSize,
              {
                x: getInnerEdgeCoordinate(roomSize, "max"),
                y: matchY,
              },
              { x: roomSize - 1, y: matchY },
            );
            room.exits.push({
              x: roomSize - 1,
              y: matchY,
              destRoomId: rightRoom.id,
              destX: rightLanding.x,
              destY: rightLanding.y,
            });
            rightRoom.exits.push({
              x: 0,
              y: matchY,
              destRoomId: room.id,
              destX: leftLanding.x,
              destY: leftLanding.y,
            });
          }
        }
      }

      if (chunkY < chunkRows - 1) {
        const matchXs = findVerticalConnections(
          cells,
          tileBehavior,
          width,
          roomSize,
          chunkX,
          chunkY,
        );
        if (matchXs.length > 0) {
          const bottomRoom = rooms[roomIndex + chunkColumns];
          for (const matchX of matchXs) {
            const bottomLanding = findLandingSpot(
              cells,
              tileBehavior,
              width,
              chunkX,
              chunkY + 1,
              roomSize,
              {
                x: matchX,
                y: getInnerEdgeCoordinate(roomSize, "min"),
              },
              { x: matchX, y: 0 },
            );
            const topLanding = findLandingSpot(
              cells,
              tileBehavior,
              width,
              chunkX,
              chunkY,
              roomSize,
              {
                x: matchX,
                y: getInnerEdgeCoordinate(roomSize, "max"),
              },
              { x: matchX, y: roomSize - 1 },
            );
            room.exits.push({
              x: matchX,
              y: roomSize - 1,
              destRoomId: bottomRoom.id,
              destX: bottomLanding.x,
              destY: bottomLanding.y,
            });
            bottomRoom.exits.push({
              x: matchX,
              y: 0,
              destRoomId: room.id,
              destX: topLanding.x,
              destY: topLanding.y,
            });
          }
        }
      }
    }
  }

  return rooms;
}

function serializeRoom(room: GeneratedRoom, source: BitsySource): string[] {
  const lines: string[] = [];
  const keyword = source.roomKeyword;

  lines.push(`${keyword} ${room.id}`);
  for (const row of room.tilemap) {
    lines.push(renderRoomTileRow(row, source.roomFormat));
  }

  if (room.walls.length > 0) {
    lines.push(`WAL ${room.walls.join(",")}`);
  }

  for (const exit of room.exits) {
    lines.push(
      `EXT ${exit.x},${exit.y} ${exit.destRoomId} ${exit.destX},${exit.destY}`,
    );
  }

  if (
    room.avatarStart &&
    (source.avatarStartSource?.kind === "room" ||
      source.avatarStartSource === null)
  ) {
    lines.push(`SPR A ${room.avatarStart.x},${room.avatarStart.y}`);
  }

  const template = room.sourceRoom;
  if (template?.pal) {
    lines.push(`PAL ${template.pal}`);
  }
  if (template?.ava) {
    lines.push(`AVA ${template.ava}`);
  }
  if (template?.tune) {
    lines.push(`TUNE ${template.tune}`);
  }
  if (template?.name) {
    lines.push(`NAME ${template.name}`);
  }

  lines.push("");
  return lines;
}

function patchAvatarSpriteBlock(
  source: BitsySource,
  avatarRoomId: string,
  avatarX: number,
  avatarY: number,
): string[] {
  if (source.avatarStartSource?.kind !== "sprite_pos") {
    return source.lines;
  }

  const { start, end } = source.avatarStartSource.blockRange;
  const blockLines = source.lines.slice(start, end);
  const nextBlockLines: string[] = [];
  let insertedPos = false;

  for (const line of blockLines) {
    if (getDirective(line) === "POS") {
      nextBlockLines.push(`POS ${avatarRoomId} ${avatarX},${avatarY}`);
      insertedPos = true;
      continue;
    }

    nextBlockLines.push(line);
  }

  if (!insertedPos) {
    const insertionIndex = Math.max(1, nextBlockLines.length - 1);
    nextBlockLines.splice(
      insertionIndex,
      0,
      `POS ${avatarRoomId} ${avatarX},${avatarY}`,
    );
  }

  return [
    ...source.lines.slice(0, start),
    ...nextBlockLines,
    ...source.lines.slice(end),
  ];
}

export function exportMapOnlyGameData(
  source: BitsySource,
  cells: GridCell[],
  tileBehavior: TileBehaviorMap,
  width: number,
  height: number,
  startCell: { x: number; y: number } | null,
  roomSize = BITSY_MAP_SIZE,
): string {
  const rooms = generateRoomsFromGrid(
    source,
    cells,
    tileBehavior,
    width,
    height,
    startCell,
    roomSize,
  );
  const serializedRooms = rooms.flatMap((room) => serializeRoom(room, source));
  const avatarRoom = rooms.find((room) => room.avatarStart !== null) ?? null;
  const baseLines =
    avatarRoom && avatarRoom.avatarStart
      ? patchAvatarSpriteBlock(
          source,
          avatarRoom.id,
          avatarRoom.avatarStart.x,
          avatarRoom.avatarStart.y,
        )
      : source.lines;

  if (source.roomSectionRange === null) {
    return [...serializedRooms, ...baseLines].join("\n");
  }

  const prefix = baseLines.slice(0, source.roomSectionRange.start);
  const suffix = baseLines.slice(source.roomSectionRange.end);
  return [...prefix, ...serializedRooms, ...suffix].join("\n");
}
