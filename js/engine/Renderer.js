/**
 * Renderer — Core game loop and 2D canvas rendering engine.
 * Orchestrates MapManager, EntityManager, Camera, and InputManager.
 */
import { InputManager } from './InputManager.js';
import { MapManager } from './MapManager.js';
import { EntityManager } from './EntityManager.js';
import { Camera } from './Camera.js';
import { Events } from '../utils/EventBus.js';

export class Renderer {
    constructor(containerId, eventBus) {
        this.container = document.getElementById(containerId);
        this.eventBus = eventBus;
        
        // Setup Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'game-world-canvas';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // optimize for opaque bg
        
        // Systems
        this.input = new InputManager();
        this.map = new MapManager();
        this.entities = new EntityManager();
        this.camera = new Camera(0, 0);
        
        // Loop state
        this.lastTime = 0;
        this.rafId = null;
        this.isRunning = false;

        // Interaction state
        this.activeInteractable = null;

        this._resize = this._resize.bind(this);
        window.addEventListener('resize', this._resize);
    }

    async init(mapData, gameState) {
        this._resize();
        
        // Load map and entities from data
        this.map.loadMap(mapData);
        this.entities.loadEntities(mapData, gameState);
        
        // Setup camera
        this.camera.setTarget(this.entities.player);
        const bounds = this.map.getBounds();
        this.camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
        
        // Initial camera snap to target
        this.camera.x = this.entities.player.x - this.camera.viewportWidth / 2;
        this.camera.y = this.entities.player.y - this.camera.viewportHeight / 2;

        // Listen for IDE focus events to disable game input
        this.eventBus.on(Events.IDE_FOCUSED, () => this.input.setEnabled(false));
        this.eventBus.on(Events.IDE_BLURRED, () => this.input.setEnabled(true));
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame((time) => this._loop(time));
    }

    stop() {
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    _resize() {
        // Handle high-DPI displays
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.camera.resize(rect.width, rect.height);
    }

    _loop(currentTime) {
        if (!this.isRunning) return;

        // Calculate delta time in seconds, capped to prevent huge jumps on tab switch
        let dt = (currentTime - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; 
        this.lastTime = currentTime;

        this._update(dt);
        this._render();

        this.input.update(); // clear justPressed states
        this.rafId = requestAnimationFrame((time) => this._loop(time));
    }

    _update(dt) {
        this.entities.update(dt, this.input, this.map);
        this.camera.update(dt);

        // Interaction Check
        const nearby = this.entities.getNearbyInteractable();
        if (nearby !== this.activeInteractable) {
            this.activeInteractable = nearby;
            if (nearby) {
                // Show interaction prompt
                this.eventBus.emit('SHOW_PROMPT', { text: "Press [E] to Inspect" });
            } else {
                // Hide prompt
                this.eventBus.emit('HIDE_PROMPT');
            }
        }

        // Handle interaction input
        if (nearby && (this.input.isJustPressed('e') || this.input.isJustPressed('enter'))) {
            if (nearby.type === 'portal') {
                const isReversePortal = nearby.color === '#a855f7';
                const allRepaired = this.entities.areAllTerminalsRepaired();

                if (isReversePortal || allRepaired) {
                    this.eventBus.emit(Events.MAP_TRANSITION, { targetMapId: nearby.targetMapId });
                } else {
                    this.eventBus.emit('SHOW_PROMPT', { 
                        text: "ACCESS DENIED: Restore all terminals in this sector first.",
                        isError: true 
                    });
                    this.eventBus.emit(Events.AUDIO_PLAY_SFX, 'error');
                }
            } else {
                this.eventBus.emit('INTERACT', { entity: nearby });
            }
        }
    }

    _render() {
        // Clear background
        this.ctx.fillStyle = '#06060c';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply camera transform
        this.camera.apply(this.ctx);

        // Draw Map
        this.map.render(this.ctx, this.camera);

        // Draw Entities (Player, Terminals)
        this.entities.render(this.ctx, this.camera);

        // Draw interaction indicator if applicable
        if (this.activeInteractable) {
            this._drawInteractionHighlight(this.activeInteractable);
        }

        // Restore camera transform
        this.camera.restore(this.ctx);
    }

    _drawInteractionHighlight(ent) {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        
        const pad = 8;
        this.ctx.strokeRect(
            ent.x - pad, 
            ent.y - pad, 
            ent.width + pad * 2, 
            ent.height + pad * 2
        );
        
        this.ctx.fillStyle = '#00e5ff';
        this.ctx.font = '12px "JetBrains Mono"';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('[E]', ent.x + ent.width / 2, ent.y - pad - 4);
        
        this.ctx.restore();
    }

    destroy() {
        this.stop();
        this.input.destroy();
        window.removeEventListener('resize', this._resize);
        this.canvas.remove();
    }
}
