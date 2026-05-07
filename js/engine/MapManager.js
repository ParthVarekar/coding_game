/**
 * MapManager — Handles the 2D tile grid, procedurally renders tiles,
 * and provides collision detection for the game world.
 */
export class MapManager {
    constructor() {
        this.tileSize = 64;
        this.width = 0;
        this.height = 0;
        this.grid = []; // 2D array of tile IDs
        
        // Tile types
        this.TILES = {
            EMPTY: 0,
            FLOOR: 1,
            WALL: 2,
            HAZARD: 3,
        };
    }

    /**
     * Load a map from JSON data.
     * @param {Object} mapData - The map object from maps.json
     */
    loadMap(mapData) {
        this.width = mapData.width;
        this.height = mapData.height;
        this.grid = mapData.grid;
    }

    getBounds() {
        return {
            x: 0,
            y: 0,
            width: this.width * this.tileSize,
            height: this.height * this.tileSize
        };
    }

    getTileAt(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return this.TILES.WALL; // Treat out of bounds as walls
        }
        return this.grid[y][x];
    }

    /**
     * Check if a world coordinate bounding box collides with a wall.
     * @returns {boolean} true if collision detected
     */
    checkCollision(x, y, width, height) {
        // Calculate grid cells covered by the bounding box
        const left = Math.floor(x / this.tileSize);
        const right = Math.floor((x + width - 1) / this.tileSize);
        const top = Math.floor(y / this.tileSize);
        const bottom = Math.floor((y + height - 1) / this.tileSize);

        for (let ty = top; ty <= bottom; ty++) {
            for (let tx = left; tx <= right; tx++) {
                if (this.getTileAt(tx, ty) === this.TILES.WALL) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Render the map to the canvas, culling tiles outside the camera viewport.
     * Uses procedural canvas drawing to mimic sci-fi tiles without external assets.
     */
    render(ctx, camera) {
        const ts = this.tileSize;
        
        // Calculate visible grid range
        const startX = Math.max(0, Math.floor(camera.x / ts));
        const endX = Math.min(this.width, Math.ceil((camera.x + camera.viewportWidth) / ts));
        const startY = Math.max(0, Math.floor(camera.y / ts));
        const endY = Math.min(this.height, Math.ceil((camera.y + camera.viewportHeight) / ts));

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = this.grid[y][x];
                const px = x * ts;
                const py = y * ts;

                switch (tile) {
                    case this.TILES.FLOOR:
                        this._drawFloorTile(ctx, px, py, ts);
                        break;
                    case this.TILES.WALL:
                        this._drawWallTile(ctx, px, py, ts);
                        break;
                    case this.TILES.HAZARD:
                        this._drawHazardTile(ctx, px, py, ts);
                        break;
                }
            }
        }
    }

    _drawFloorTile(ctx, x, y, size) {
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(x, y, size, size);
        
        // Grid lines
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, size, size);
        
        // Subtle corner accents
        ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
        ctx.fillRect(x + 2, y + 2, 4, 4);
    }

    _drawWallTile(ctx, x, y, size) {
        // Base structure
        ctx.fillStyle = '#14142a';
        ctx.fillRect(x, y, size, size);
        
        // Bevel / depth
        ctx.fillStyle = '#1a1a3a';
        ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
        
        // Top highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, size, 4);
        
        // Inner detail lines
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 10);
        ctx.lineTo(x + 20, y + 10);
        ctx.moveTo(x + size - 10, y + size - 10);
        ctx.lineTo(x + size - 20, y + size - 10);
        ctx.stroke();
    }

    _drawHazardTile(ctx, x, y, size) {
        // Floor base
        this._drawFloorTile(ctx, x, y, size);
        
        // Hazard stripes (procedural pattern)
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 4, y + 4, size - 8, size - 8);
        ctx.clip();
        
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'; // error color
        ctx.fillRect(x, y, size, size);
        
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 4;
        for (let i = -size; i < size * 2; i += 16) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + size, y + size);
            ctx.stroke();
        }
        ctx.restore();
    }
}
