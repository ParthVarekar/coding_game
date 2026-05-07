/**
 * Camera — Manages the viewport into the 2D game world.
 * Follows a target (usually the player) with smooth interpolation (lerping).
 * Implements screen shake and coordinate conversion.
 */
export class Camera {
    constructor(viewportWidth, viewportHeight) {
        this.x = 0;
        this.y = 0;
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        
        this.target = null;
        this.lerpFactor = 0.1; // Smoothness of following (0 to 1)

        // Screen shake state
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        this.shakeX = 0;
        this.shakeY = 0;

        // Map boundaries (optional)
        this.bounds = null;
    }

    resize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    setTarget(target) {
        this.target = target;
    }

    setBounds(x, y, width, height) {
        this.bounds = { x, y, width, height };
    }

    shake(intensity = 10, durationMs = 200) {
        this.shakeIntensity = intensity;
        this.shakeTime = durationMs;
    }

    update(dt) {
        if (this.target) {
            // Calculate target position (center target in viewport)
            let targetX = this.target.x - this.viewportWidth / 2;
            let targetY = this.target.y - this.viewportHeight / 2;

            // Constrain to bounds if set
            if (this.bounds) {
                targetX = Math.max(this.bounds.x, Math.min(targetX, this.bounds.x + this.bounds.width - this.viewportWidth));
                targetY = Math.max(this.bounds.y, Math.min(targetY, this.bounds.y + this.bounds.height - this.viewportHeight));
            }

            // Lerp to target position
            this.x += (targetX - this.x) * this.lerpFactor;
            this.y += (targetY - this.y) * this.lerpFactor;
        }

        // Apply screen shake
        if (this.shakeTime > 0) {
            this.shakeTime -= dt * 1000;
            if (this.shakeTime > 0) {
                this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
                this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
                // Decay intensity
                this.shakeIntensity *= 0.9;
            } else {
                this.shakeTime = 0;
                this.shakeX = 0;
                this.shakeY = 0;
                this.shakeIntensity = 0;
            }
        }
    }

    /**
     * Apply camera transformation to the canvas context.
     * @param {CanvasRenderingContext2D} ctx 
     */
    apply(ctx) {
        ctx.save();
        ctx.translate(-Math.round(this.x + this.shakeX), -Math.round(this.y + this.shakeY));
    }

    /**
     * Restore canvas context after rendering camera-space objects.
     * @param {CanvasRenderingContext2D} ctx 
     */
    restore(ctx) {
        ctx.restore();
    }

    /**
     * Convert screen coordinates to world coordinates.
     */
    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.x,
            y: screenY + this.y
        };
    }

    /**
     * Check if a bounding box is visible within the viewport (for culling).
     */
    isVisible(x, y, w, h) {
        // Add a small buffer to prevent popping
        const buffer = 32;
        return (
            x + w + buffer > this.x &&
            x - buffer < this.x + this.viewportWidth &&
            y + h + buffer > this.y &&
            y - buffer < this.y + this.viewportHeight
        );
    }
}
