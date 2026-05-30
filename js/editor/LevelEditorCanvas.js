/**
 * LevelEditorCanvas - Nexus-native tile editor surface.
 *
 * The interaction model is adapted from blurymind/tilemap-editor's lightweight
 * MIT-licensed approach (Copyright 2021 Todor Imreorov): active tool state,
 * snapped tile coordinates, drag painting, panning, and zooming stay in a small
 * vanilla JS canvas controller.
 */
const TILE_SIZE = 64;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.12;
const CUSTOM_TILE_START = 100;

const ENTITY_DEFAULTS = {
    terminal: () => ({
        type: 'terminal',
        challengeId: `custom_terminal_${Date.now().toString(36)}`,
    }),
    portal: () => ({
        type: 'portal',
        portalKind: 'forward',
        targetMapId: 'custom_next',
        color: '#00e5ff',
        requiredTerminals: [],
    }),
    returnPortal: () => ({
        type: 'portal',
        portalKind: 'return',
        targetMapId: 'custom_level_1',
        color: '#a855f7',
        requiredTerminals: [],
    }),
    bot: () => ({
        type: 'bot',
        botConfig: {
            greeting: 'Hello, Engineer. Custom level systems are online.',
            emotion: 'happy',
            behavior: 'follow',
        },
    }),
};

export class LevelEditorCanvas {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.onChange = options.onChange || (() => {});
        this.onStatus = options.onStatus || (() => {});
        this.onTerminalConfigure = options.onTerminalConfigure || (() => {});
        this.onPortalConfigure = options.onPortalConfigure || (() => {});
        this.onBotConfigure = options.onBotConfigure || (() => {});

        this.width = 20;
        this.height = 10;
        this.grid = this._createDefaultGrid(this.width, this.height);
        this.playerStart = { x: 5, y: 5 };
        this.entities = [
            {
                id: this._makeId('terminal'),
                type: 'terminal',
                x: 10,
                y: 5,
                challengeId: 'custom_terminal_1',
                terminalConfig: this._createDefaultTerminalConfig('custom_terminal_1'),
            },
            {
                id: this._makeId('portal'),
                type: 'portal',
                portalKind: 'forward',
                x: 14,
                y: 5,
                targetMapId: 'custom_next',
                color: '#00e5ff',
                requiredTerminals: [],
            },
        ];
        this.customAssets = [];
        this._customAssetImages = new Map();
        this.nextCustomTileId = CUSTOM_TILE_START;

        this.tool = 'paint';
        this.brush = { kind: 'tile', tileId: 1, label: 'Floor' };
        this.zoom = 0.9;
        this.offsetX = 0;
        this.offsetY = 0;
        this.hoverCell = null;
        this.selectedCell = null;
        this.selectedEntityId = null;
        this.lastPaintKey = null;

        this._isPainting = false;
        this._isPanning = false;
        this._spaceDown = false;
        this._panStart = null;
        this._resizeObserver = null;

        this._boundResize = () => this.resize();
        this._boundPointerDown = (event) => this._handlePointerDown(event);
        this._boundPointerMove = (event) => this._handlePointerMove(event);
        this._boundPointerUp = (event) => this._handlePointerUp(event);
        this._boundWheel = (event) => this._handleWheel(event);
        this._boundContextMenu = (event) => event.preventDefault();
        this._boundKeyDown = (event) => {
            if (event.code === 'Space') this._spaceDown = true;
        };
        this._boundKeyUp = (event) => {
            if (event.code === 'Space') this._spaceDown = false;
        };
    }

    mount() {
        this.canvas.addEventListener('pointerdown', this._boundPointerDown);
        this.canvas.addEventListener('pointermove', this._boundPointerMove);
        this.canvas.addEventListener('pointerup', this._boundPointerUp);
        this.canvas.addEventListener('pointercancel', this._boundPointerUp);
        this.canvas.addEventListener('pointerleave', this._boundPointerUp);
        this.canvas.addEventListener('wheel', this._boundWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._boundContextMenu);
        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('keyup', this._boundKeyUp);

        if ('ResizeObserver' in window) {
            this._resizeObserver = new ResizeObserver(this._boundResize);
            this._resizeObserver.observe(this.canvas.parentElement);
        } else {
            window.addEventListener('resize', this._boundResize);
        }

        this.resize();
        this.fitToView();
    }

    destroy() {
        this.canvas.removeEventListener('pointerdown', this._boundPointerDown);
        this.canvas.removeEventListener('pointermove', this._boundPointerMove);
        this.canvas.removeEventListener('pointerup', this._boundPointerUp);
        this.canvas.removeEventListener('pointercancel', this._boundPointerUp);
        this.canvas.removeEventListener('pointerleave', this._boundPointerUp);
        this.canvas.removeEventListener('wheel', this._boundWheel);
        this.canvas.removeEventListener('contextmenu', this._boundContextMenu);
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup', this._boundKeyUp);
        window.removeEventListener('resize', this._boundResize);
        this._resizeObserver?.disconnect();
    }

    loadMap(mapData) {
        if (!mapData) return;

        this.width = mapData.width || this.width;
        this.height = mapData.height || this.height;
        this.grid = this._normalizeGrid(mapData.grid, this.width, this.height);
        this.playerStart = this._worldToCell(mapData.playerStart || { x: TILE_SIZE * 2, y: TILE_SIZE * 2 });
        this.entities = (mapData.entities || []).map((entity) => {
            const cell = this._worldToCell(entity);
            const id = this._makeId(entity.type);
            const challengeId = entity.challengeId || `${id}_challenge`;
            const portalKind = entity.portalKind || entity.portalConfig?.portalKind || (entity.color === '#a855f7' ? 'return' : 'forward');
            return {
                ...entity,
                id,
                challengeId,
                terminalConfig: entity.type === 'terminal'
                    ? entity.terminalConfig || this._createDefaultTerminalConfig(challengeId)
                    : entity.terminalConfig,
                portalConfig: entity.type === 'portal'
                    ? entity.portalConfig || this._createDefaultPortalConfig(entity.targetMapId || entity.targetLevelId, portalKind)
                    : entity.portalConfig,
                portalKind: entity.type === 'portal' ? portalKind : entity.portalKind,
                graphRoute: entity.type === 'portal'
                    ? entity.graphRoute || entity.portalConfig?.graphRoute
                    : entity.graphRoute,
                color: entity.type === 'portal'
                    ? entity.color || (portalKind === 'return' ? '#a855f7' : '#00e5ff')
                    : entity.color,
                botConfig: entity.type === 'bot'
                    ? entity.botConfig || this._createDefaultBotConfig()
                    : entity.botConfig,
                requiredTerminals: entity.type === 'portal'
                    ? entity.requiredTerminals || entity.portalConfig?.requiredTerminals || []
                    : entity.requiredTerminals,
                x: cell.x,
                y: cell.y,
            };
        });
        this.customAssets = (mapData.customAssets || mapData.assets || []).map((asset) => ({ ...asset }));
        this._rebuildCustomAssetImages();
        this.nextCustomTileId = Math.max(
            CUSTOM_TILE_START,
            ...this.customAssets.map((asset) => Number(asset.tileId || 0) + 1)
        );
        this.hoverCell = null;
        this.selectedCell = null;
        this.selectedEntityId = null;
        this.lastPaintKey = null;
        this._isPainting = false;
        this._isPanning = false;

        this.fitToView();
        this.render();
        this._emitChange();
    }

    setTool(tool) {
        this.tool = tool;
        this._syncCursor();
        this._emitStatus();
        this.render();
    }

    setBrush(brush) {
        this.brush = brush;
        if (this.tool === 'erase' || this.tool === 'pan' || this.tool === 'select') {
            this.tool = 'paint';
        }
        this._syncCursor();
        this._emitStatus();
        this.render();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.viewportWidth = rect.width;
        this.viewportHeight = rect.height;
        this.render();
    }

    fitToView() {
        const pad = 80;
        const worldWidth = this.width * TILE_SIZE;
        const worldHeight = this.height * TILE_SIZE;
        const zoomX = (this.viewportWidth - pad) / worldWidth;
        const zoomY = (this.viewportHeight - pad) / worldHeight;
        this.zoom = this._clamp(Math.min(zoomX, zoomY), MIN_ZOOM, 1.25);
        this.offsetX = Math.round((this.viewportWidth - worldWidth * this.zoom) / 2);
        this.offsetY = Math.round((this.viewportHeight - worldHeight * this.zoom) / 2);
        this._emitStatus();
        this.render();
    }

    createBlank(width = 20, height = 10, options = {}) {
        const { clearAssets = false } = options;
        this.width = Math.max(4, Math.floor(width));
        this.height = Math.max(4, Math.floor(height));
        this.grid = this._createDefaultGrid(this.width, this.height);
        this.playerStart = {
            x: Math.floor(this.width / 2),
            y: Math.floor(this.height / 2),
        };
        this.entities = [];
        this.hoverCell = null;
        this.selectedCell = null;
        this.selectedEntityId = null;
        this.lastPaintKey = null;
        this._isPainting = false;
        this._isPanning = false;
        if (clearAssets) {
            this.customAssets = [];
            this._customAssetImages.clear();
            this.nextCustomTileId = CUSTOM_TILE_START;
        }
        this.fitToView();
        this._emitChange();
    }

    resizeGrid(width, height) {
        const nextWidth = this._clamp(Math.floor(Number(width) || this.width), 4, 120);
        const nextHeight = this._clamp(Math.floor(Number(height) || this.height), 4, 120);
        if (nextWidth === this.width && nextHeight === this.height) return;

        const nextGrid = Array.from({ length: nextHeight }, (_, y) => {
            return Array.from({ length: nextWidth }, (_, x) => {
                return this.grid[y]?.[x] ?? 0;
            });
        });

        this.width = nextWidth;
        this.height = nextHeight;
        this.grid = nextGrid;
        this.playerStart = {
            x: this._clamp(this.playerStart.x, 0, this.width - 1),
            y: this._clamp(this.playerStart.y, 0, this.height - 1),
        };
        this.entities = this.entities.filter((entity) => this._isInBounds(entity.x, entity.y));
        this.hoverCell = null;
        this.selectedCell = null;
        this.selectedEntityId = null;
        this.lastPaintKey = null;
        this.fitToView();
        this._emitChange();
        this._emitStatus();
    }

    addCustomAsset({ name, src, mimeType }) {
        const tileId = this.nextCustomTileId++;
        const asset = {
            id: this._makeId('asset'),
            tileId,
            name,
            src,
            mimeType,
        };

        this.customAssets.push(asset);
        this._loadCustomAssetImage(asset);
        this._emitChange();

        return {
            kind: 'tile',
            tileId,
            label: name,
            customAssetId: asset.id,
        };
    }

    updateTerminalConfig(entityId, config) {
        const terminal = this.entities.find((entity) => entity.id === entityId && entity.type === 'terminal');
        if (!terminal) return null;

        terminal.challengeId = config.challengeId;
        terminal.terminalConfig = { ...config };
        this.selectedEntityId = terminal.id;
        this._emitChange();
        this._emitStatus();
        this.render();

        return terminal;
    }

    updatePortalConfig(entityId, config) {
        const portal = this.entities.find((entity) => entity.id === entityId && entity.type === 'portal');
        if (!portal) return null;

        portal.targetMapId = config.targetMapId;
        portal.targetLevelId = config.targetLevelId || config.targetMapId;
        portal.requiredTerminals = [...config.requiredTerminals];
        portal.portalKind = config.portalKind || portal.portalKind || 'forward';
        portal.color = config.color || portal.color || (portal.portalKind === 'return' ? '#a855f7' : '#00e5ff');
        portal.graphRoute = config.graphRoute || portal.graphRoute || portal.portalConfig?.graphRoute;
        portal.portalConfig = {
            ...config,
            targetMapId: portal.targetMapId,
            targetLevelId: portal.targetLevelId,
            graphRoute: portal.graphRoute,
            portalKind: portal.portalKind,
        };
        this.selectedEntityId = portal.id;
        this._emitChange();
        this._emitStatus();
        this.render();

        return portal;
    }

    updateBotConfig(entityId, config) {
        const bot = this.entities.find((entity) => entity.id === entityId && entity.type === 'bot');
        if (!bot) return null;

        bot.botConfig = { ...config };
        this.selectedEntityId = bot.id;
        this._emitChange();
        this._emitStatus();
        this.render();

        return bot;
    }

    getSnapshot() {
        return {
            width: this.width,
            height: this.height,
            tileSize: TILE_SIZE,
            grid: this.grid.map((row) => [...row]),
            playerStart: { ...this.playerStart },
            entities: this.entities.map((entity) => ({ ...entity })),
            customAssets: this.customAssets.map((asset) => ({ ...asset })),
            nextCustomTileId: this.nextCustomTileId,
        };
    }

    render() {
        if (!this.ctx || !this.viewportWidth || !this.viewportHeight) return;

        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#050711';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();

        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.zoom, this.zoom);

        this._drawBackdrop(ctx);
        this._drawTiles(ctx);
        this._drawEntities(ctx);
        this._drawGrid(ctx);
        this._drawHover(ctx);

        ctx.restore();
    }

    _handlePointerDown(event) {
        this.canvas.setPointerCapture?.(event.pointerId);
        this.canvas.focus();

        const shouldPan = this.tool === 'pan' || event.button === 1 || event.button === 2 || this._spaceDown;
        if (shouldPan) {
            this._isPanning = true;
            this._panStart = {
                x: event.clientX,
                y: event.clientY,
                offsetX: this.offsetX,
                offsetY: this.offsetY,
            };
            return;
        }

        this._isPainting = true;
        this.lastPaintKey = null;
        this._applyAtPointer(event);
    }

    _handlePointerMove(event) {
        const cell = this._eventToCell(event);
        this.hoverCell = cell && this._isInBounds(cell.x, cell.y) ? cell : null;

        if (this._isPanning && this._panStart) {
            this.offsetX = this._panStart.offsetX + event.clientX - this._panStart.x;
            this.offsetY = this._panStart.offsetY + event.clientY - this._panStart.y;
            this.render();
            return;
        }

        if (this._isPainting) {
            this._applyAtPointer(event);
        } else {
            this._emitStatus();
            this.render();
        }
    }

    _handlePointerUp(event) {
        this.canvas.releasePointerCapture?.(event.pointerId);
        this._isPainting = false;
        this._isPanning = false;
        this._panStart = null;
        this.lastPaintKey = null;
    }

    _handleWheel(event) {
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        const worldBefore = this._screenToWorld(canvasX, canvasY);
        const nextZoom = event.deltaY < 0 ? this.zoom * ZOOM_STEP : this.zoom / ZOOM_STEP;

        this.zoom = this._clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        this.offsetX = canvasX - worldBefore.x * this.zoom;
        this.offsetY = canvasY - worldBefore.y * this.zoom;
        this._emitStatus();
        this.render();
    }

    _applyAtPointer(event) {
        const cell = this._eventToCell(event);
        if (!cell || !this._isInBounds(cell.x, cell.y)) return;

        const existingEntity = this._getEntityAtCell(cell.x, cell.y);
        if (this._shouldConfigureEntity(existingEntity)) {
            this._isPainting = false;
            this.selectedEntityId = existingEntity.id;
            this._openEntityConfigurator(existingEntity);
            this._emitStatus();
            this.render();
            return;
        }

        if (this.tool === 'select') {
            this.selectedEntityId = existingEntity?.id || null;
            this._emitStatus();
            this.render();
            return;
        }

        const paintKey = `${this.tool}-${this.brush.kind}-${this.brush.tileId || this.brush.entityType}-${cell.x}-${cell.y}`;
        if (paintKey === this.lastPaintKey) return;
        this.lastPaintKey = paintKey;
        this.selectedCell = cell;

        if (this.tool === 'erase') {
            this._eraseCell(cell.x, cell.y);
        } else if (this.brush.kind === 'tile') {
            this.grid[cell.y][cell.x] = this.brush.tileId;
        } else if (this.brush.kind === 'entity') {
            this._placeEntity(cell.x, cell.y, this.brush.entityType);
            if (this.brush.entityType !== 'playerStart') {
                this._isPainting = false;
            }
        }

        this._emitChange();
        this._emitStatus();
        this.render();
    }

    _placeEntity(x, y, entityType) {
        if (entityType === 'playerStart') {
            this.playerStart = { x, y };
            return;
        }

        this.entities = this.entities.filter((entity) => !(entity.x === x && entity.y === y));
        const id = this._makeId(entityType);
        const defaults = ENTITY_DEFAULTS[entityType]?.() || { type: entityType };
        const entity = {
            id,
            ...defaults,
            x,
            y
        };

        if (entity.type === 'terminal') {
            entity.challengeId = entity.challengeId || `${id}_challenge`;
            entity.terminalConfig = this._createDefaultTerminalConfig(entity.challengeId);
            this.selectedEntityId = entity.id;
        } else if (entity.type === 'portal') {
            entity.portalConfig = this._createDefaultPortalConfig(entity.targetMapId, entity.portalKind);
            entity.requiredTerminals = [];
            this.selectedEntityId = entity.id;
        } else if (entity.type === 'bot') {
            entity.botConfig = this._createDefaultBotConfig();
            this.selectedEntityId = entity.id;
        }

        this.entities.push(entity);
    }

    _eraseCell(x, y) {
        this.entities = this.entities.filter((entity) => !(entity.x === x && entity.y === y));
        if (this.playerStart.x !== x || this.playerStart.y !== y) {
            this.grid[y][x] = 0;
        }
    }

    _drawBackdrop(ctx) {
        const width = this.width * TILE_SIZE;
        const height = this.height * TILE_SIZE;
        ctx.fillStyle = '#070816';
        ctx.fillRect(-TILE_SIZE, -TILE_SIZE, width + TILE_SIZE * 2, height + TILE_SIZE * 2);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
        ctx.lineWidth = 2 / this.zoom;
        ctx.strokeRect(0, 0, width, height);
    }

    _drawTiles(ctx) {
        const bounds = this._visibleTileBounds();

        for (let y = bounds.startY; y < bounds.endY; y++) {
            for (let x = bounds.startX; x < bounds.endX; x++) {
                const tile = this.grid[y][x];
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                if (tile === 0) this._drawVoidTile(ctx, px, py, x, y);
                else if (tile >= CUSTOM_TILE_START) this._drawCustomTile(ctx, px, py, tile);
                else if (tile === 1) this._drawFloorTile(ctx, px, py);
                else if (tile === 2) this._drawWallTile(ctx, px, py);
                else if (tile === 3) this._drawHazardTile(ctx, px, py);
                else this._drawVoidTile(ctx, px, py, x, y);
            }
        }
    }

    _drawGrid(ctx) {
        const width = this.width * TILE_SIZE;
        const height = this.height * TILE_SIZE;
        ctx.strokeStyle = 'rgba(119, 232, 255, 0.16)';
        ctx.lineWidth = 1 / this.zoom;
        ctx.beginPath();

        for (let x = 0; x <= width; x += TILE_SIZE) {
            ctx.moveTo(x + 0.5 / this.zoom, 0);
            ctx.lineTo(x + 0.5 / this.zoom, height);
        }

        for (let y = 0; y <= height; y += TILE_SIZE) {
            ctx.moveTo(0, y + 0.5 / this.zoom);
            ctx.lineTo(width, y + 0.5 / this.zoom);
        }

        ctx.stroke();
    }

    _drawEntities(ctx) {
        this._drawPlayerStart(ctx, this.playerStart.x, this.playerStart.y);
        this.entities.forEach((entity) => {
            if (entity.type === 'terminal') this._drawTerminal(ctx, entity.x, entity.y);
            else if (entity.type === 'portal') this._drawPortal(ctx, entity.x, entity.y, entity.color);
            else if (entity.type === 'bot') this._drawBot(ctx, entity.x, entity.y, entity.botConfig?.emotion);
        });

        const selectedEntity = this.entities.find((entity) => entity.id === this.selectedEntityId);
        if (selectedEntity) this._drawSelectedEntity(ctx, selectedEntity);
    }

    _drawHover(ctx) {
        if (!this.hoverCell) return;

        const { x, y } = this.hoverCell;
        ctx.fillStyle = this.tool === 'erase' ? 'rgba(239, 68, 68, 0.16)' : 'rgba(0, 229, 255, 0.13)';
        ctx.strokeStyle = this.tool === 'erase' ? '#ef4444' : '#00e5ff';
        ctx.lineWidth = 2 / this.zoom;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }

    _drawVoidTile(ctx, x, y, cellX, cellY) {
        ctx.fillStyle = '#03050f';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        const starSeed = Math.abs(Math.sin((cellX + 1) * 12.9898 + (cellY + 1) * 78.233));
        if (starSeed > 0.62) {
            const sx = x + 10 + (starSeed * 37) % 42;
            const sy = y + 8 + (starSeed * 53) % 44;
            ctx.fillStyle = `rgba(119, 232, 255, ${0.12 + (starSeed - 0.62) * 0.32})`;
            ctx.fillRect(sx, sy, 1.5, 1.5);
        }

        if (this._hasPlayableNeighbor(cellX, cellY)) {
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        }
    }

    _drawFloorTile(ctx, x, y) {
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
        ctx.fillRect(x + 4, y + 4, 5, 5);
        ctx.fillRect(x + TILE_SIZE - 9, y + TILE_SIZE - 9, 5, 5);
    }

    _drawWallTile(ctx, x, y) {
        ctx.fillStyle = '#14142a';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#1a1a3a';
        ctx.fillRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.fillRect(x, y, TILE_SIZE, 5);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 14);
        ctx.lineTo(x + 25, y + 14);
        ctx.moveTo(x + TILE_SIZE - 12, y + TILE_SIZE - 14);
        ctx.lineTo(x + TILE_SIZE - 25, y + TILE_SIZE - 14);
        ctx.stroke();
    }

    _drawHazardTile(ctx, x, y) {
        this._drawFloorTile(ctx, x, y);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
        ctx.clip();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.42)';
        ctx.lineWidth = 4;
        for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += 16) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + TILE_SIZE, y + TILE_SIZE);
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawCustomTile(ctx, x, y, tileId) {
        const image = this._customAssetImages.get(tileId);

        if (image?.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
            return;
        }

        this._drawFloorTile(ctx, x, y);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
        ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.65)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16);
    }

    _drawPlayerStart(ctx, cellX, cellY) {
        const x = cellX * TILE_SIZE + TILE_SIZE / 2;
        const y = cellY * TILE_SIZE + TILE_SIZE / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.16)';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(-13, -13, 26, 26);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(-4, -17, 8, 34);
        ctx.fillRect(-17, -4, 34, 8);
        ctx.restore();
    }

    _drawTerminal(ctx, cellX, cellY) {
        const x = cellX * TILE_SIZE + TILE_SIZE / 2;
        const y = cellY * TILE_SIZE + TILE_SIZE / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-18, -18, 36, 36);
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 14;
        ctx.fillRect(-13, -12, 26, 13);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(-13, 8, 26, 4);
        ctx.restore();
    }

    _drawPortal(ctx, cellX, cellY, color = '#00e5ff') {
        const x = cellX * TILE_SIZE + TILE_SIZE / 2;
        const y = cellY * TILE_SIZE + TILE_SIZE / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(-24, -24, 48, 48);
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.setLineDash([]);
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.restore();
    }

    _drawBot(ctx, cellX, cellY, emotion = 'happy') {
        const x = cellX * TILE_SIZE + TILE_SIZE / 2;
        const y = cellY * TILE_SIZE + TILE_SIZE / 2;
        ctx.save();
        ctx.translate(x, y);
        const color = emotion === 'thinking' ? '#a855f7' : emotion === 'error' ? '#ef4444' : '#00e5ff';
        const gradient = ctx.createRadialGradient(-4, -4, 2, 0, 0, 14);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.25, color);
        gradient.addColorStop(1, '#06060c');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(5, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawSelectedEntity(ctx, entity) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3 / this.zoom;
        ctx.setLineDash([7 / this.zoom, 5 / this.zoom]);
        ctx.strokeRect(
            entity.x * TILE_SIZE + 7,
            entity.y * TILE_SIZE + 7,
            TILE_SIZE - 14,
            TILE_SIZE - 14
        );
        ctx.restore();
    }

    _eventToCell(event) {
        const rect = this.canvas.getBoundingClientRect();
        const world = this._screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
        return {
            x: Math.floor(world.x / TILE_SIZE),
            y: Math.floor(world.y / TILE_SIZE),
        };
    }

    _screenToWorld(x, y) {
        return {
            x: (x - this.offsetX) / this.zoom,
            y: (y - this.offsetY) / this.zoom,
        };
    }

    _worldToCell(point) {
        return {
            x: this._clamp(Math.floor((point.x || 0) / TILE_SIZE), 0, this.width - 1),
            y: this._clamp(Math.floor((point.y || 0) / TILE_SIZE), 0, this.height - 1),
        };
    }

    _visibleTileBounds() {
        const topLeft = this._screenToWorld(0, 0);
        const bottomRight = this._screenToWorld(this.viewportWidth, this.viewportHeight);

        return {
            startX: this._clamp(Math.floor(topLeft.x / TILE_SIZE) - 1, 0, this.width),
            startY: this._clamp(Math.floor(topLeft.y / TILE_SIZE) - 1, 0, this.height),
            endX: this._clamp(Math.ceil(bottomRight.x / TILE_SIZE) + 1, 0, this.width),
            endY: this._clamp(Math.ceil(bottomRight.y / TILE_SIZE) + 1, 0, this.height),
        };
    }

    _normalizeGrid(grid, width, height) {
        return Array.from({ length: height }, (_, y) => {
            const sourceRow = Array.isArray(grid?.[y]) ? grid[y] : [];
            return Array.from({ length: width }, (_, x) => Number(sourceRow[x] ?? 0));
        });
    }

    _createDefaultGrid(width, height) {
        return Array.from({ length: height }, (_, y) => {
            return Array.from({ length: width }, (_, x) => {
                const isEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
                return isEdge ? 2 : 1;
            });
        });
    }

    _isInBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    _hasPlayableNeighbor(x, y) {
        const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        return offsets.some(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (!this._isInBounds(nx, ny)) return false;
            const tile = this.grid[ny][nx];
            return tile === 1 || tile === 3 || tile >= CUSTOM_TILE_START;
        });
    }

    _getEntityAtCell(x, y) {
        return this.entities.find((entity) => entity.x === x && entity.y === y) || null;
    }

    getTerminalChallengeIds() {
        return this.entities
            .filter((entity) => entity.type === 'terminal')
            .map((entity) => entity.challengeId)
            .filter(Boolean);
    }

    _shouldConfigureEntity(entity) {
        if (!entity) return false;
        if (this.tool === 'select') return ['terminal', 'portal', 'bot'].includes(entity.type);
        const brushType = this.brush?.entityType === 'returnPortal' ? 'portal' : this.brush?.entityType;
        return brushType === entity.type && ['terminal', 'portal', 'bot'].includes(entity.type);
    }

    _openEntityConfigurator(entity) {
        if (entity.type === 'terminal') this.onTerminalConfigure(entity);
        else if (entity.type === 'portal') this.onPortalConfigure(entity);
        else if (entity.type === 'bot') this.onBotConfigure(entity);
    }

    _createDefaultTerminalConfig(challengeId) {
        return {
            challengeId,
            dialogueIntro: 'A damaged terminal flickers. Bot Buddy hovers closer, waiting for your diagnostic code.',
            dialogueHint: 'Think about the final Python state the terminal needs, then create that state step by step.',
            validation: {
                type: 'variableValue',
                variableName: 'x',
                expectedValue: '10',
                expression: "pyodide.globals.get('x') == 10",
            },
        };
    }

    _createDefaultPortalConfig(targetMapId = 'custom_next', portalKind = 'forward') {
        return {
            targetMapId,
            portalKind,
            requiredTerminals: [],
        };
    }

    _createDefaultBotConfig() {
        return {
            greeting: 'Hello, Engineer. Custom level systems are online.',
            emotion: 'happy',
            behavior: 'follow',
        };
    }

    _rebuildCustomAssetImages() {
        this._customAssetImages.clear();
        this.customAssets.forEach((asset) => this._loadCustomAssetImage(asset));
    }

    _loadCustomAssetImage(asset) {
        if (!asset?.src || !asset?.tileId) return;

        const image = new Image();
        image.onload = () => this.render();
        image.onerror = () => console.warn(`[LevelEditor] Failed to load custom asset: ${asset.name}`);
        image.src = asset.src;
        this._customAssetImages.set(asset.tileId, image);
    }

    _clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    _makeId(prefix) {
        return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
    }

    _emitStatus() {
        this.onStatus({
            tool: this.tool,
            brush: this.brush,
            zoom: this.zoom,
            hoverCell: this.hoverCell,
            selectedCell: this.selectedCell,
            selectedEntity: this.entities.find((entity) => entity.id === this.selectedEntityId) || null,
        });
    }

    _emitChange() {
        this.onChange(this.getSnapshot());
    }

    _syncCursor() {
        if (this.tool === 'pan') this.canvas.style.cursor = 'grab';
        else if (this.tool === 'erase') this.canvas.style.cursor = 'not-allowed';
        else if (this.tool === 'select') this.canvas.style.cursor = 'pointer';
        else this.canvas.style.cursor = 'crosshair';
    }
}
