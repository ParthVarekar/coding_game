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
        super(x, y, 32, 32);
        this.type = type;
        this.challengeId = challengeId;
        this.isRepaired = false;
        this.isSparking = false;
        this.sparkTime = 0;
    }

    update(dt) {
        if (this.isSparking) {
            this.sparkTime += dt;
            if (this.sparkTime > 1) { // Spark for 1 second
                this.isSparking = false;
                this.sparkTime = 0;
            }
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 16, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-16, -16, 32, 32);

        // Screen
        let screenColor = '#ef4444'; // Broken
        let glowColor = 'rgba(239, 68, 68, 0.5)';
        
        if (this.isRepaired) {
            screenColor = '#10b981'; // Repaired
            glowColor = 'rgba(16, 185, 129, 0.5)';
        } else if (this.isSparking) {
            // Flicker rapidly
            const flicker = Math.random() > 0.5 ? '#f59e0b' : '#fff';
            screenColor = flicker;
            glowColor = 'rgba(245, 158, 11, 0.8)';
            
            // Draw random spark lines
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2;
            for(let i=0; i<3; i++) {
                ctx.beginPath();
                ctx.moveTo((Math.random()-0.5)*40, (Math.random()-0.5)*40 - 10);
                ctx.lineTo((Math.random()-0.5)*40, (Math.random()-0.5)*40 - 10);
                ctx.stroke();
            }
        }

        ctx.fillStyle = screenColor;
        ctx.shadowColor = screenColor;
        ctx.shadowBlur = 15;
        
        // Pulse screen if broken but not sparking
        if (!this.isRepaired && !this.isSparking) {
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
            ctx.shadowBlur = 5 + pulse * 15;
        }

        ctx.fillRect(-12, -12, 24, 12);

        ctx.restore();
    }
}

export class BotEntity extends Entity {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.target = null;
        this.color = '#00e5ff'; // Default happy/cyan
        this.eyeColor = '#fff';
        this.hoverTime = 0;
        this.offsetX = -40; // Follow to the top-left of player
        this.offsetY = -40;
    }

    setTarget(target) {
        this.target = target;
    }

    setEmotion(emotion) {
        switch (emotion) {
            case 'happy':
                this.color = '#00e5ff';
                this.eyeColor = '#fff';
                break;
            case 'thinking':
                this.color = '#a855f7'; // Purple
                this.eyeColor = '#fff';
                break;
            case 'error':
                this.color = '#ef4444'; // Red
                this.eyeColor = '#fff';
                break;
        }
    }

    update(dt) {
        this.hoverTime += dt * 2;

        if (this.target) {
            // Determine desired position behind/above player based on player facing
            let targetOffsetX = this.offsetX;
            if (this.target.facing === 'left') targetOffsetX = 40;
            
            const targetX = this.target.x + targetOffsetX;
            const targetY = this.target.y + this.offsetY;

            // Lerp towards target position
            this.x += (targetX - this.x) * 5 * dt;
            this.y += (targetY - this.y) * 5 * dt;
        }
    }

    render(ctx) {
        ctx.save();
        
        const hoverOffset = Math.sin(this.hoverTime) * 5;
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2 + hoverOffset);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 30 - hoverOffset, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bot Body (Sphere)
        const gradient = ctx.createRadialGradient(-4, -4, 2, 0, 0, 12);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(0.2, this.color);
        gradient.addColorStop(1, '#06060c');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = this.eyeColor;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(4, -2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Antenna
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(0, -18);
        ctx.stroke();
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, -18, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class Portal extends Entity {
    constructor(x, y, targetMapId) {
        super(x, y, 64, 64);
        this.type = 'portal';
        this.targetMapId = targetMapId;
    }
    render(ctx) {
        ctx.save();
        ctx.translate(this.x + 32, this.y + 32);
        
        // Spinning energy ring
        const time = Date.now() / 1000;
        ctx.rotate(time * 2);
        
        ctx.strokeStyle = '#a855f7'; // Purple portal
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(-24, -24, 48, 48);
        
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 15;
        ctx.strokeRect(-16, -16, 32, 32);
        
        ctx.restore();
    }
}

export class EntityManager {
    constructor() {
        this.player = null;
        this.bot = null;
        this.interactables = [];
    }

    /**
     * Spawn entities based on JSON map data.
     */
    loadEntities(mapData) {
        this.clear();
        
        const start = mapData.playerStart || { x: 128, y: 128 };
        this.player = new Player(start.x, start.y);
        
        this.bot = new BotEntity(start.x, start.y);
        this.bot.setTarget(this.player);

        if (mapData.entities) {
            mapData.entities.forEach(ent => {
                if (ent.type === 'terminal') {
                    this.interactables.push(new Interactable(ent.x, ent.y, ent.type, ent.challengeId));
                } else if (ent.type === 'portal') {
                    this.interactables.push(new Portal(ent.x, ent.y, ent.targetMapId));
                }
            });
        }
    }

    clear() {
        this.player = null;
        this.bot = null;
        this.interactables = [];
    }

    update(dt, input, map) {
        this.player.update(dt, input, map);
        this.bot.update(dt);
        
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
        const renderList = [this.player, this.bot, ...this.interactables];
        renderList.sort((a, b) => (a.y + a.height) - (b.y + b.height));

        for (const ent of renderList) {
            if (camera.isVisible(ent.x, ent.y, ent.width, ent.height)) {
                ent.render(ctx);
            }
        }
    }
}
