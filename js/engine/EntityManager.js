/**
 * EntityManager — Manages all dynamic entities in the game world.
 * Includes the Player class and interactable objects.
 */

class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = '#fff';
    }
    update(dt) {}
    render(ctx) {}
}

export class Player extends Entity {
    constructor(x, y) {
        super(x, y, 32, 32);
        this.speed = 250; // pixels per second
        this.color = '#00e5ff'; // cyan
        this.facing = 'down';
        
        // Animation state
        this.bobTime = 0;
        this.isMoving = false;
    }

    update(dt, input, map) {
        let dx = 0;
        let dy = 0;
        
        const axis = input.getAxis();
        dx = axis.x * this.speed * dt;
        dy = axis.y * this.speed * dt;

        this.isMoving = (dx !== 0 || dy !== 0);

        if (this.isMoving) {
            this.bobTime += dt * 15;
            
            // Update facing direction
            if (Math.abs(dx) > Math.abs(dy)) {
                this.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.facing = dy > 0 ? 'down' : 'up';
            }
        } else {
            this.bobTime = 0;
        }

        // Apply movement with collision (sliding along walls)
        if (dx !== 0) {
            if (!map.checkCollision(this.x + dx, this.y, this.width, this.height)) {
                this.x += dx;
            }
        }
        if (dy !== 0) {
            if (!map.checkCollision(this.x, this.y + dy, this.width, this.height)) {
                this.y += dy;
            }
        }
    }

    render(ctx) {
        ctx.save();
        
        // Bobbing animation offset
        const bobOffset = this.isMoving ? Math.sin(this.bobTime) * 3 : 0;
        
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2 + bobOffset);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 16 - bobOffset, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main body (procedural sci-fi suit)
        ctx.fillStyle = '#14142a'; // dark suit
        ctx.fillRect(-12, -14, 24, 28);
        
        // Glowing visor based on facing direction
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        
        if (this.facing === 'down') {
            ctx.fillRect(-8, -10, 16, 6);
        } else if (this.facing === 'up') {
            // Visor not visible from back
        } else if (this.facing === 'right') {
            ctx.fillRect(2, -10, 8, 6);
        } else if (this.facing === 'left') {
            ctx.fillRect(-10, -10, 8, 6);
        }

        // Shoulders/accents
        ctx.fillStyle = '#4b5563';
        ctx.shadowBlur = 0;
        ctx.fillRect(-14, -12, 4, 10);
        ctx.fillRect(10, -12, 4, 10);

        ctx.restore();
    }
}

export class Interactable extends Entity {
    constructor(x, y, type, challengeId) {
        super(x, y, 48, 48);
        this.type = type; // 'terminal', 'door'
        this.challengeId = challengeId;
        this.isRepaired = false;
        
        this.pulseTime = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.pulseTime += dt * 3;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'terminal') {
            // Terminal base
            ctx.fillStyle = '#1a1a3a';
            ctx.fillRect(0, 16, 48, 32);
            
            // Screen
            const screenColor = this.isRepaired ? '#22c55e' : '#ef4444';
            ctx.fillStyle = screenColor;
            
            // Pulse effect if broken
            if (!this.isRepaired) {
                const alpha = (Math.sin(this.pulseTime) * 0.3 + 0.7).toFixed(2);
                ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 15;
            } else {
                ctx.shadowColor = '#22c55e';
                ctx.shadowBlur = 10;
            }
            
            ctx.fillRect(4, 0, 40, 24);
        }

        ctx.restore();
    }
}

export class EntityManager {
    constructor() {
        this.player = new Player(128, 128);
        this.interactables = [];
    }

    loadPrototypeEntities() {
        // Add a broken terminal in the map
        // Map is 20x15, tile size 64. Let's put it near the center right
        this.interactables.push(new Interactable(12 * 64 + 8, 6 * 64 + 8, 'terminal', 'challenge_1'));
        
        // Reset player pos
        this.player.x = 3 * 64;
        this.player.y = 3 * 64;
    }

    update(dt, input, map) {
        this.player.update(dt, input, map);
        
        for (const ent of this.interactables) {
            ent.update(dt);
        }
    }

    /**
     * Check if player is near any interactable object.
     * Returns the object if nearby, null otherwise.
     */
    getNearbyInteractable() {
        const interactionRange = 64; // pixels
        const px = this.player.x + this.player.width / 2;
        const py = this.player.y + this.player.height / 2;

        for (const ent of this.interactables) {
            const ex = ent.x + ent.width / 2;
            const ey = ent.y + ent.height / 2;
            
            const dist = Math.sqrt((px - ex)**2 + (py - ey)**2);
            if (dist <= interactionRange) {
                return ent;
            }
        }
        return null;
    }

    render(ctx, camera) {
        // Sort entities by Y position for proper pseudo-depth layering
        const renderList = [this.player, ...this.interactables];
        renderList.sort((a, b) => (a.y + a.height) - (b.y + b.height));

        for (const ent of renderList) {
            if (camera.isVisible(ent.x, ent.y, ent.width, ent.height)) {
                ent.render(ctx);
            }
        }
    }
}
