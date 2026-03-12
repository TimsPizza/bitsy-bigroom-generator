import { useMemo, useState } from "react";

import { EditorCanvas } from "@/components/EditorCanvas";
import { TilePreview } from "@/components/TilePreview";
import { useEditorStore } from "@/store/editorStore";

export function EditorPage() {
  const [interactionMode, setInteractionMode] = useState<"paint" | "start">(
    "paint",
  );
  const [showClearDialog, setShowClearDialog] = useState(false);
  const sourceText = useEditorStore((state) => state.sourceText);
  const importedSource = useEditorStore((state) => state.importedSource);
  const warnings = useEditorStore((state) => state.warnings);
  const importError = useEditorStore((state) => state.importError);
  const exportText = useEditorStore((state) => state.exportText);
  const width = useEditorStore((state) => state.width);
  const height = useEditorStore((state) => state.height);
  const roomSize = useEditorStore((state) => state.roomSize);
  const tileBehavior = useEditorStore((state) => state.tileBehavior);
  const startCell = useEditorStore((state) => state.startCell);
  const currentMaterialId = useEditorStore((state) => state.currentMaterialId);
  const setSourceText = useEditorStore((state) => state.setSourceText);
  const importGameData = useEditorStore((state) => state.importGameData);
  const setCurrentMaterialId = useEditorStore(
    (state) => state.setCurrentMaterialId,
  );
  const setTileBlocking = useEditorStore((state) => state.setTileBlocking);
  const setStartCell = useEditorStore((state) => state.setStartCell);
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
  const paintableTiles =
    importedSource?.tiles.filter((tile) => tile.id !== "0") ?? [];

  const selectedMaterial =
    paintableTiles.find((tile) => tile.id === currentMaterialId) ?? null;

  const startMarker = useMemo(() => {
    if (!startCell) {
      return { roomIndex: null, cell: null as { x: number; y: number } | null };
    }

    const chunkColumns = Math.max(1, Math.ceil(width / roomSize));
    const roomX = Math.floor(startCell.x / roomSize);
    const roomY = Math.floor(startCell.y / roomSize);

    return {
      roomIndex: roomY * chunkColumns + roomX,
      cell: startCell,
    };
  }, [roomSize, startCell, width]);

  const selectedTileBlocking =
    selectedMaterial && currentMaterialId
      ? (tileBehavior[currentMaterialId]?.blocking ?? false)
      : false;

  return (
    <div className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Bitsy Bigroom Generator</p>
        <h1 className="hero mt-3!">
          Paste existing game data, pick tile materials from the imported tile
          definitions, draw blocked walls on a larger grid, and regenerate only
          the ROOM blocks plus their exits.
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
                  resizeWorld(
                    nextRoomWidth * roomSize,
                    nextRoomHeight * roomSize,
                  );
                  setDraftRoomWidth(String(nextRoomWidth));
                  setDraftRoomHeight(String(nextRoomHeight));
                }}
              >
                Resize
              </button>
              <button
                className={`button ${interactionMode === "start" ? "accent" : ""}`}
                type="button"
                onClick={() => setInteractionMode("start")}
              >
                Set start
              </button>
              <button
                className={`button ${interactionMode === "paint" ? "accent" : ""}`}
                type="button"
                onClick={() => setInteractionMode("paint")}
              >
                Paint mode
              </button>
            </div>
          </div>

          <div className="panel stack-gap compact-panel materials-grid-panel">
            <div className="panel-header">
              <h2>Materials</h2>
            </div>
            <div className="selected-material">
              <span className="subtle-label">Current brush</span>
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
                      onClick={() => setCurrentMaterialId(tile.id)}
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
          </div>
        </div>

        <div className="panel editor-stage-panel stack-gap">
          <div className="panel-header editor-stage-header">
            <div>
              <h2>Map Editor</h2>
              <p className="panel-note">
                Shared room edges connect across every passable border cell,
                excluding corners so horizontal and vertical exits do not fight
                over the same tile. Left-click now toggles the current wall on
                and off.
              </p>
            </div>
            <div className="editor-stage-status">
              <span>
                {startMarker.roomIndex === null
                  ? "No start room marker"
                  : `Start room chunk #${startMarker.roomIndex + 1}`}
              </span>
              <span>
                {interactionMode === "start"
                  ? "Click to place start"
                  : selectedTileBlocking
                    ? "Toggling selected wall tile"
                    : "Toggling selected passable tile"}
              </span>
            </div>
          </div>
          <div className="canvas-scroller full-stage-scroller">
            <EditorCanvas
              interactionMode={interactionMode}
              startRoomIndex={startMarker.roomIndex}
              startCell={startMarker.cell}
              onPickStartCell={(cell) => {
                setStartCell(cell);
                setInteractionMode("paint");
              }}
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
            className="source-input compact-export"
            value={exportText}
            readOnly
            spellCheck={false}
          />
        </div>
      </section>

      {showClearDialog ? (
        <dialog
          className="confirm-dialog"
          open
          onClose={() => setShowClearDialog(false)}
        >
          <div className="confirm-dialog-content">
            <h2>Clear current map?</h2>
            <p>
              This wipes the current oversized map grid and keeps the imported
              Bitsy source text in place.
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
                  setShowClearDialog(false);
                }}
              >
                Clear map
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
