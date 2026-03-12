export const BITSY_MAP_SIZE = 16;
export const BITSY_TILE_SIZE = 8;

export type DrawingFrame = number[][];

export type BitsyTile = {
  id: string;
  name: string | null;
  drawingId: string | null;
  frames: DrawingFrame[];
  isWall: boolean | null;
};

export type BitsyRoom = {
  id: string;
  keyword: "ROOM" | "SET";
  tilemap: string[][];
  walls: string[];
  exits: GeneratedExit[];
  pal: string | null;
  name: string | null;
  ava: string | null;
  tune: string | null;
};

export type BitsyAvatarStart = {
  roomId: string;
  x: number;
  y: number;
};

export type BitsyAvatarStartSource =
  | {
      kind: "room";
    }
  | {
      kind: "sprite_pos";
      blockRange: {
        start: number;
        end: number;
      };
    };

export type BitsySource = {
  raw: string;
  lines: string[];
  roomFormat: 0 | 1;
  roomKeyword: "ROOM" | "SET";
  roomSectionRange: {
    start: number;
    end: number;
  } | null;
  rooms: BitsyRoom[];
  tiles: BitsyTile[];
  avatarStart: BitsyAvatarStart | null;
  avatarStartSource: BitsyAvatarStartSource | null;
};

export type GridCell = {
  materialId: string | null;
};

export type TileBehaviorMap = Record<
  string,
  {
    blocking: boolean;
  }
>;

export type GeneratedExit = {
  x: number;
  y: number;
  destRoomId: string;
  destX: number;
  destY: number;
};

export type GeneratedRoom = {
  id: string;
  sourceRoom: BitsyRoom | null;
  tilemap: string[][];
  walls: string[];
  exits: GeneratedExit[];
  avatarStart: { x: number; y: number } | null;
};

export type ImportResult = {
  source: BitsySource;
  warnings: string[];
};
