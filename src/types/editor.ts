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

export type BitsyRoomSpritePlacement = {
  id: string;
  x: number;
  y: number;
};

export type BitsyRoomItemPlacement = {
  id: string;
  x: number;
  y: number;
};

export type BitsyRoom = {
  id: string;
  keyword: "ROOM" | "SET";
  tilemap: string[][];
  walls: string[];
  exits: GeneratedExit[];
  spritePlacements: BitsyRoomSpritePlacement[];
  itemPlacements: BitsyRoomItemPlacement[];
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

export type BitsySprite = {
  id: string;
  name: string | null;
  drawingId: string | null;
  frames: DrawingFrame[];
  isAvatar: boolean;
  blockRange: {
    start: number;
    end: number;
  };
  placementSource: "room" | "sprite_pos" | null;
};

export type BitsyItem = {
  id: string;
  name: string | null;
  drawingId: string | null;
  frames: DrawingFrame[];
};

export type BitsyEntityPlacement = {
  id: string;
  roomId: string;
  x: number;
  y: number;
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
  sprites: BitsySprite[];
  items: BitsyItem[];
  avatarStart: BitsyAvatarStart | null;
  avatarStartSource: BitsyAvatarStartSource | null;
  spritePlacements: BitsyEntityPlacement[];
  itemPlacements: BitsyEntityPlacement[];
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

export type RoomSlot = {
  roomId: string;
  templateRoomId: string | null;
};

export type WorldPoint = {
  x: number;
  y: number;
};

export type WorldEntityPlacement = {
  id: string;
  x: number;
  y: number;
};

export type GeneratedRoom = {
  id: string;
  sourceRoom: BitsyRoom | null;
  tilemap: string[][];
  walls: string[];
  exits: GeneratedExit[];
  spritePlacements: BitsyRoomSpritePlacement[];
  itemPlacements: BitsyRoomItemPlacement[];
  avatarStart: { x: number; y: number } | null;
};

export type ImportResult = {
  source: BitsySource;
  warnings: string[];
};
