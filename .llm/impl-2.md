# Implementation Log 2

- Time: 2026-03-12T17:13:09Z
- Base Commit: b5214533950ae607e9f1df0a9ef9a23f316af21e
- Head Commit: b5214533950ae607e9f1df0a9ef9a23f316af21e

## Tasks Completed in this Cycle (3)
1) Top grid toolbox and wall toggle interaction
2) Per-tile blocking configuration
3) Inner-room landing after room transitions

## High-level Summary
- Reworked the editor layout so tools live above the canvas instead of floating over it.
- Changed left-click painting into a proper toggle, so clicking an occupied wall cell clears it.
- Moved blocking behavior from per-cell paint state to per-tile configuration, matching Bitsy's actual model.
- Adjusted generated exits so crossing a room boundary lands the player one tile inside the destination room.

## Changes Since Last Snapshot
### Commit Summary
```
b521453 (HEAD -> main, origin/main, origin/HEAD) init
1ed5eef Initial commit
```

### File Changes
```
M src/App.tsx
M src/styles/global.css
?? src/components/
?? src/lib/
?? src/store/
?? src/types/
```

### Key Patches (Trimmed)
```diff
diff --git a/src/components/EditorPage.tsx b/src/components/EditorPage.tsx
@@
-      <section className="workspace-stage">
-        <div className="floating-toolbox-shell">
+      <section className="workspace-stage stack-gap">
+        <div className="toolbox-grid">
@@
-        <div className="panel stack-gap compact-panel export-panel-bottom">
+        <div className="panel stack-gap compact-panel export-panel-bottom">
```

```diff
diff --git a/src/components/EditorCanvas.tsx b/src/components/EditorCanvas.tsx
@@
+  function resolveLeftClickMode(cell: { x: number; y: number }): "paint" | "erase" {
+    const existingCell = cells[cell.y * width + cell.x];
+    return existingCell?.materialId ? "erase" : "paint";
+  }
@@
-          const mode = event.button === 2 ? "erase" : "paint";
+          const mode = event.button === 2 ? "erase" : resolveLeftClickMode(cell);
```

```diff
diff --git a/src/store/editorStore.ts b/src/store/editorStore.ts
@@
-  currentSolid: boolean;
+  tileBehavior: TileBehaviorMap;
@@
-  setCurrentSolid: (solid: boolean) => void;
+  setTileBlocking: (materialId: string, blocking: boolean) => void;
@@
-      solid: currentSolid,
+      materialId: currentMaterialId,
```

```diff
diff --git a/src/lib/bitsy.ts b/src/lib/bitsy.ts
@@
+function getInnerEdgeCoordinate(roomSize: number, side: "min" | "max"): number {
+  if (roomSize <= 1) return 0;
+  return side === "min" ? 1 : roomSize - 2;
+}
@@
-              destX: 0,
+              destX: getInnerEdgeCoordinate(roomSize, "min"),
@@
-              destY: 0,
+              destY: getInnerEdgeCoordinate(roomSize, "min"),
```

## Decisions & Rationale
- Killing the floating toolbox was the right call. It was stealing working space and adding UI noise for no benefit.
- Blocking had to move to tile-level config because Bitsy itself treats wall behavior at tile granularity. Per-cell blocking with the same tile id is fake freedom that collapses into garbage on export.
- Destination exits now land one tile inside the target room so transitions feel like traversal, not like getting stapled to the seam.

## Risks & Follow-ups
- Export still does not remap NPCs, items, or endings into regenerated rooms.
- If users want the same artwork to exist in both blocking and passable forms, the exporter will need tile cloning instead of pretending one tile id can mean two different collision rules.
- CSS output remains bloated relative to the tiny UI because the project baseline is still carrying a lot of weight.

## References
- project.md: placeholder charter only; no substantive guidance was available.
