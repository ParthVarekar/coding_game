# Nexus-AI Architecture & Content Pipeline

This document defines the boundary between the **Core Engine** and **Game Content**. To ensure stability, we have established a "Core Engine Freeze."

## ❄️ Core Engine Freeze
The following files and directories are considered **Locked**. DO NOT modify these files to add new story content, levels, or challenges unless explicitly instructed by the user for architectural reasons.

### Logic & Systems
- `js/editor/PythonWorker.js` & `PythonRunner.js` (Execution Sandbox)
- `js/engine/Renderer.js`, `Camera.js`, `InputManager.js` (Game Loop & Hardware)
- `js/engine/MapManager.js` & `EntityManager.js` (Data processing logic)
- `js/utils/EventBus.js` (Communication Layer)

### UI & Shell
- `index.html` (Application Skeleton)
- `css/index.css` (Visual Design System)
- `js/main.js` (Application Entry Point)

---

## 🛠 Content Pipeline (Data-Driven)
All new game content MUST be added through the following JSON files. No JavaScript changes are required to create new levels.

### 1. `data/curriculum.json`
Defines the Python challenges and dialogue.
- **Challenge ID**: Unique key linked to terminals.
- **Validation**: Defines `expectedOutput` and `state` checks (Logic-based validation).
- **Dialogue**: Introduction and hint sequences.

### 2. `data/maps.json`
Defines the physical game world.
- **Grid**: A 2D array of tile IDs (1: Floor, 2: Wall, 3: Hazard).
- **playerStart**: `{x, y}` spawn point.
- **Entities**: Array of interactable objects.
  - `type`: "terminal" or other interactable types.
  - `challengeId`: Links this terminal to a specific challenge in `curriculum.json`.

---

## 🚀 How to Add a New Level

1. **Design the Map**: Open `data/maps.json` and add a new entry to the `maps` array.
2. **Define the Grid**: Create the tile layout. Use `2` for boundaries and `1` for walking space.
3. **Place Terminals**: Add entries to the `entities` array. Set their `x` and `y` coordinates (world coordinates = tile index * 64).
4. **Create the Challenge**: Open `data/curriculum.json` and add a new challenge with an `id` matching the `challengeId` you used in the map.
5. **Test**: Refresh the game. The engine will automatically render the new map and link the terminals to the new Python logic.
