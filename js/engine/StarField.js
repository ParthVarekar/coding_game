/**
 * StarField — Renders an animated parallax star field
 * on the background canvas. Always active behind all screens.
 */
export class StarField {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.w = 0;
        this.h = 0;
        this._raf = null;

        this._resize();
        window.addEventListener('resize', () => this._resize());
        this._createStars();
        this.start();
    }

    _resize() {
        this.w = this.canvas.width = window.innerWidth;
        this.h = this.canvas.height = window.innerHeight;
    }

    _createStars() {
        this.stars = [];
        const count = Math.floor((this.w * this.h) / 3000);
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                r: Math.random() * 1.5 + 0.3,
                speed: Math.random() * 0.15 + 0.02,
                alpha: Math.random() * 0.7 + 0.3,
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                twinklePhase: Math.random() * Math.PI * 2,
            });
        }
    }

    start() {
        let time = 0;
        const animate = () => {
            time += 0.016;
            this.ctx.clearRect(0, 0, this.w, this.h);

            // Deep space gradient
            const grad = this.ctx.createRadialGradient(
                this.w / 2, this.h / 2, 0,
                this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7
            );
            grad.addColorStop(0, '#0d0d1a');
            grad.addColorStop(1, '#06060c');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, this.w, this.h);

            // Draw stars
            for (const star of this.stars) {
                star.y += star.speed;
                if (star.y > this.h) {
                    star.y = 0;
                    star.x = Math.random() * this.w;
                }

                const twinkle = Math.sin(time * star.twinkleSpeed * 60 + star.twinklePhase) * 0.3 + 0.7;
                const alpha = star.alpha * twinkle;

                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
                this.ctx.fill();
            }

            // Subtle nebula glow
            const neb1 = this.ctx.createRadialGradient(
                this.w * 0.2, this.h * 0.3, 0,
                this.w * 0.2, this.h * 0.3, 300
            );
            neb1.addColorStop(0, 'rgba(0, 229, 255, 0.02)');
            neb1.addColorStop(1, 'transparent');
            this.ctx.fillStyle = neb1;
            this.ctx.fillRect(0, 0, this.w, this.h);

            const neb2 = this.ctx.createRadialGradient(
                this.w * 0.8, this.h * 0.7, 0,
                this.w * 0.8, this.h * 0.7, 250
            );
            neb2.addColorStop(0, 'rgba(168, 85, 247, 0.015)');
            neb2.addColorStop(1, 'transparent');
            this.ctx.fillStyle = neb2;
            this.ctx.fillRect(0, 0, this.w, this.h);

            this._raf = requestAnimationFrame(animate);
        };
        animate();
    }

    stop() {
        if (this._raf) cancelAnimationFrame(this._raf);
    }
}
