import { useEffect, useMemo, useState } from "react";

import { EditorCanvas } from "@/components/EditorCanvas";
import { TilePreview } from "@/components/TilePreview";
import { useEditorStore } from "@/store/editorStore";

export function EditorPage() {
  const [interactionMode, setInteractionMode] = useState<
    "paint" | "avatar" | "sprite" | "item" | "rearrange"
  >("paint");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const sourceText = useEditorStore((state) => state.sourceText);
  const importedSource = useEditorStore((state) => state.importedSource);
  const warnings = useEditorStore((state) => state.warnings);
  const importError = useEditorStore((state) => state.importError);
  const exportText = useEditorStore((state) => state.exportText);
  const width = useEditorStore((state) => state.width);
  const height = useEditorStore((state) => state.height);
  const roomSize = useEditorStore((state) => state.roomSize);
  const tileBehavior = useEditorStore((state) => state.tileBehavior);
  const roomSlots = useEditorStore((state) => state.roomSlots);
  const avatarPlacement = useEditorStore((state) => state.avatarPlacement);
  const spritePlacements = useEditorStore((state) => state.spritePlacements);
  const itemPlacements = useEditorStore((state) => state.itemPlacements);
  const currentMaterialId = useEditorStore((state) => state.currentMaterialId);
  const setSourceText = useEditorStore((state) => state.setSourceText);
  const importGameData = useEditorStore((state) => state.importGameData);
  const setCurrentMaterialId = useEditorStore((state) => state.setCurrentMaterialId);
  const setTileBlocking = useEditorStore((state) => state.setTileBlocking);
  const resizeWorld = useEditorStore((state) => state.resizeWorld);
  const clearMap = useEditorStore((state) => state.clearMap);
  const buildExport = useEditorStore((state) => state.buildExport);

  const [draftRoomWidth, setDraftRoomWidth] = useState(
    String(Math.max(1, width / roomSize)),
  );
  const [draftRoomHeight, setDraftRoomHeight] = useState(
    String(Math.max(1, height / roomSize)),
  );
  const [copyLabel, setCopyLabel] = useState("Copy export");
  const paintableTiles = importedSource?.tiles.filter((tile) => tile.id !== "0") ?? [];
  const avatarDefinition =
    importedSource?.sprites.find((sprite) => sprite.isAvatar) ?? null;
  const spriteDefinitions =
    importedSource?.sprites.filter((sprite) => !sprite.isAvatar) ?? [];
  const itemDefinitions = importedSource?.items ?? [];

  useEffect(() => {
    if (
      selectedSpriteId &&
      spriteDefinitions.some((sprite) => sprite.id === selectedSpriteId)
    ) {
      return;
    }

    setSelectedSpriteId(spriteDefinitions[0]?.id ?? null);
  }, [selectedSpriteId, spriteDefinitions]);

  useEffect(() => {
    if (selectedItemId && itemDefinitions.some((item) => item.id === selectedItemId)) {
      return;
    }

    setSelectedItemId(itemDefinitions[0]?.id ?? null);
  }, [itemDefinitions, selectedItemId]);

  useEffect(() => {
    if (selectedRoomIndex !== null && selectedRoomIndex < roomSlots.length) {
      return;
    }

    setSelectedRoomIndex(null);
  }, [roomSlots.length, selectedRoomIndex]);

  const selectedMaterial =
    paintableTiles.find((tile) => tile.id === currentMaterialId) ?? null;
  const selectedSprite =
    spriteDefinitions.find((sprite) => sprite.id === selectedSpriteId) ?? null;
  const selectedItem =
    itemDefinitions.find((item) => item.id === selectedItemId) ?? null;
  const selectedRoom = selectedRoomIndex !== null ? roomSlots[selectedRoomIndex] ?? null : null;

  const avatarMarker = useMemo(() => {
    if (!avatarPlacement) {
      return { roomIndex: null, cell: null as typeof avatarPlacement };
    }

    const chunkColumns = Math.max(1, Math.ceil(width / roomSize));
    const roomX = Math.floor(avatarPlacement.x / roomSize);
    const roomY = Math.floor(avatarPlacement.y / roomSize);

    return {
      roomIndex: roomY * chunkColumns + roomX,
      cell: avatarPlacement,
    };
  }, [avatarPlacement, roomSize, width]);

  const selectedTileBlocking =
    selectedMaterial && currentMaterialId
      ? (tileBehavior[currentMaterialId]?.blocking ?? false)
      : false;

  const modeSummary =
    interactionMode === "paint"
      ? selectedTileBlocking
        ? "Painting blocking tiles"
        : "Painting passable tiles"
      : interactionMode === "avatar"
        ? "Click a cell to move the avatar"
        : interactionMode === "sprite"
          ? selectedSprite
            ? `Click a cell to place sprite ${selectedSprite.id}`
            : "Import a sprite definition first"
          : interactionMode === "item"
            ? selectedItem
              ? `Click a cell to place item ${selectedItem.id}`
              : "Import an item definition first"
            : selectedRoom
              ? `Selected room ${selectedRoom.roomId}; click another room to swap`
              : "Click one room, then click another room to swap";

  return (
    <div className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Bitsy Bigroom Generator</p>
        <h1 className="hero mt-3!">
          Import Bitsy game data, repaint room chunks, rearrange whole rooms,
          and place avatar, sprite, and item instances without losing
          serialization fidelity.
        </h1>
      </section>

      <section className="workspace-stage stack-gap">
        <div className="toolbox-grid">
          <div className="panel stack-gap compact-panel min-h-full">
            <div className="panel-header">
              <h2>Import</h2>
              <button
                className="button accent"
                type="button"
                onClick={() => {
                  const imported = importGameData();
                  if (!imported) {
                    return;
                  }

                  setDraftRoomWidth(String(imported.roomColumns));
                  setDraftRoomHeight(String(imported.roomRows));
                  setSelectedRoomIndex(null);
                  setInteractionMode("paint");
                }}
              >
                Parse source
              </button>
            </div>
            <textarea
              className="source-input compact-input min-h-full resize-none!"
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Paste Bitsy game data here"
              spellCheck={false}
            />
            {warnings.length > 0 ? (
              <div className="message-strip warning">
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            {importError ? (
              <p className="message-strip error">{importError}</p>
            ) : null}
          </div>

          <div className="panel stack-gap compact-panel min-h-full!">
            <div className="panel-header">
              <h2>World</h2>
              <button
                className="button danger"
                type="button"
                onClick={() => setShowClearDialog(true)}
              >
                Clear map
              </button>
            </div>
            <div className="control-grid">
              <label>
                <span>Rooms wide</span>
                <input
                  value={draftRoomWidth}
                  onChange={(event) => setDraftRoomWidth(event.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label>
                <span>Rooms tall</span>
                <input
                  value={draftRoomHeight}
                  onChange={(event) => setDraftRoomHeight(event.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>
            <div className="button-row">
              <button
                className="button rounded-none"
                type="button"
                onClick={() => {
                  const nextRoomWidth = Math.max(
                    1,
                    Number.parseInt(draftRoomWidth, 10) || 1,
                  );
                  const nextRoomHeight = Math.max(
                    1,
                    Number.parseInt(draftRoomHeight, 10) || 1,
                  );
                  resizeWorld(nextRoomWidth * roomSize, nextRoomHeight * roomSize);
                  setDraftRoomWidth(String(nextRoomWidth));
                  setDraftRoomHeight(String(nextRoomHeight));
                  setSelectedRoomIndex(null);
                }}
              >
                Resize
              </button>
            </div>
            <div className="button-row mode-row">
              <button
                className={`button ${interactionMode === "paint" ? "accent" : ""}`}
                type="button"
                onClick={() => {
                  setInteractionMode("paint");
                  setSelectedRoomIndex(null);
                }}
              >
                Paint
              </button>
              <button
                className={`button ${interactionMode === "rearrange" ? "accent" : ""}`}
                type="button"
                onClick={() => setInteractionMode("rearrange")}
              >
                Rearrange
              </button>
              <button
                className={`button ${interactionMode === "avatar" ? "accent" : ""}`}
                type="button"
                onClick={() => {
                  setInteractionMode("avatar");
                  setSelectedRoomIndex(null);
                }}
              >
                Avatar
              </button>
              <button
                className={`button ${interactionMode === "sprite" ? "accent" : ""}`}
                type="button"
                onClick={() => {
                  setInteractionMode("sprite");
                  setSelectedRoomIndex(null);
                }}
              >
                Sprite
              </button>
              <button
                className={`button ${interactionMode === "item" ? "accent" : ""}`}
                type="button"
                onClick={() => {
                  setInteractionMode("item");
                  setSelectedRoomIndex(null);
                }}
              >
                Item
              </button>
            </div>
            <div className="stats-grid">
              <div>
                <strong>{roomSlots.length}</strong>
                <span>Room slots</span>
              </div>
              <div>
                <strong>{spritePlacements.length}</strong>
                <span>Placed sprites</span>
              </div>
              <div>
                <strong>{itemPlacements.length}</strong>
                <span>Placed items</span>
              </div>
              <div>
                <strong>{avatarPlacement ? "1" : "0"}</strong>
                <span>Avatar instances</span>
              </div>
            </div>
          </div>

          <div className="panel stack-gap compact-panel materials-grid-panel">
            <div className="panel-header">
              <h2>Materials & Entities</h2>
            </div>
            <div className="selected-material">
              <span className="subtle-label">Current paint brush</span>
              <div className="selected-material-card">
                {selectedMaterial ? (
                  <TilePreview frames={selectedMaterial.frames} size={64} />
                ) : (
                  <div className="empty-preview" />
                )}
                <div>
                  <strong>
                    {selectedMaterial?.name ??
                      selectedMaterial?.id ??
                      "Nothing selected"}
                  </strong>
                  <p>
                    {selectedMaterial
                      ? `Tile ${selectedMaterial.id}`
                      : "Import data first."}
                  </p>
                  {selectedMaterial ? (
                    <p>
                      {selectedTileBlocking ? "Blocking tile" : "Passable tile"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="material-grid compact-material-grid">
              {paintableTiles.map((tile) => {
                const label = tile.name ?? tile.id;
                const blocking = tileBehavior[tile.id]?.blocking ?? false;
                return (
                  <div
                    key={tile.id}
                    className={`material-card ${tile.id === currentMaterialId ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      className="material-select"
                      onClick={() => {
                        setCurrentMaterialId(tile.id);
                        setInteractionMode("paint");
                      }}
                    >
                      <TilePreview frames={tile.frames} />
                      <strong>{label}</strong>
                      <span>{tile.id}</span>
                    </button>
                    <label className="material-toggle">
                      <input
                        type="checkbox"
                        checked={blocking}
                        onChange={(event) =>
                          setTileBlocking(tile.id, event.target.checked)
                        }
                      />
                      <span>{blocking ? "blocking" : "passable"}</span>
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="entity-section">
              <div className="panel-header">
                <h3>Avatar</h3>
                <span className="entity-meta">
                  {avatarPlacement ? "Placed" : "Missing"}
                </span>
              </div>
              <button
                className={`entity-pick ${interactionMode === "avatar" ? "active" : ""}`}
                type="button"
                onClick={() => setInteractionMode("avatar")}
              >
                {avatarDefinition ? (
                  <TilePreview frames={avatarDefinition.frames} size={48} />
                ) : (
                  <div className="empty-preview entity-preview" />
                )}
                <div>
                  <strong>{avatarDefinition?.name ?? "Avatar A"}</strong>
                  <p>Exactly one avatar is supported, matching Bitsy rules.</p>
                </div>
              </button>
            </div>
            <div className="entity-section">
              <div className="panel-header">
                <h3>Sprites</h3>
                <span className="entity-meta">{spriteDefinitions.length} defs</span>
              </div>
              <div className="entity-grid">
                {spriteDefinitions.map((sprite) => (
                  <button
                    key={sprite.id}
                    className={`entity-pick ${selectedSpriteId === sprite.id ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedSpriteId(sprite.id);
                      setInteractionMode("sprite");
                    }}
                  >
                    <TilePreview frames={sprite.frames} size={48} />
                    <div>
                      <strong>{sprite.name ?? sprite.id}</strong>
                      <p>{sprite.id}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="entity-section">
              <div className="panel-header">
                <h3>Items</h3>
                <span className="entity-meta">{itemDefinitions.length} defs</span>
              </div>
              <div className="entity-grid">
                {itemDefinitions.map((item) => (
                  <button
                    key={item.id}
                    className={`entity-pick ${selectedItemId === item.id ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setInteractionMode("item");
                    }}
                  >
                    <TilePreview frames={item.frames} size={48} />
                    <div>
                      <strong>{item.name ?? item.id}</strong>
                      <p>{item.id}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel editor-stage-panel stack-gap">
          <div className="panel-header editor-stage-header">
            <div>
              <h2>Map Editor</h2>
              <p className="panel-note">
                Rooms keep stable ids while you swap whole 16x16 chunks. Entity
                placements follow their room when rearranging, and right-click
                clears entities on the target cell.
              </p>
            </div>
            <div className="editor-stage-status">
              <span>
                {avatarMarker.roomIndex === null
                  ? "No avatar room"
                  : `Avatar room ${roomSlots[avatarMarker.roomIndex]?.roomId ?? "?"}`}
              </span>
              <span>{modeSummary}</span>
              <span>
                {selectedRoom ? `Swap source: ${selectedRoom.roomId}` : "No room selected"}
              </span>
            </div>
          </div>
          <div className="canvas-scroller full-stage-scroller">
            <EditorCanvas
              interactionMode={interactionMode}
              avatarRoomIndex={avatarMarker.roomIndex}
              avatarPlacement={avatarMarker.cell}
              selectedRoomIndex={selectedRoomIndex}
              selectedSpriteId={selectedSpriteId}
              selectedItemId={selectedItemId}
              onSelectRoom={setSelectedRoomIndex}
            />
          </div>
        </div>

        <div className="panel stack-gap compact-panel export-panel-bottom">
          <div className="panel-header">
            <h2>Export</h2>
            <div className="button-row">
              <button
                className="button accent"
                type="button"
                onClick={buildExport}
              >
                Build export
              </button>
              <button
                className="button"
                type="button"
                onClick={async () => {
                  if (!exportText) {
                    return;
                  }

                  await navigator.clipboard.writeText(exportText);
                  setCopyLabel("Copied");
                  window.setTimeout(() => setCopyLabel("Copy export"), 1200);
                }}
              >
                {copyLabel}
              </button>
            </div>
          </div>
          <textarea
            className="source-input compact-export resize-none!"
            value={exportText}
            readOnly
            placeholder="Build export to regenerate ROOM blocks with room moves and entity placements."
            spellCheck={false}
          />
        </div>
      </section>

      <dialog
        className="confirm-dialog"
        open={showClearDialog}
        onClose={() => setShowClearDialog(false)}
      >
        <div className="confirm-dialog-content">
          <h2>Clear the entire map?</h2>
          <p>
            This removes all painted tiles plus avatar, sprite, and item placements
            from the current world grid.
          </p>
          <div className="button-row confirm-dialog-actions">
            <button
              className="button"
              type="button"
              onClick={() => setShowClearDialog(false)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              type="button"
              onClick={() => {
                clearMap();
                setSelectedRoomIndex(null);
                setShowClearDialog(false);
              }}
            >
              Clear map
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
