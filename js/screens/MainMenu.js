/**
 * MainMenu — Animated main menu with star field, glowing title,
 * and glassmorphism navigation buttons.
 */
import { Events } from '../utils/EventBus.js';

export class MainMenu {
    constructor(container, eventBus, gameState, audioManager) {
        this.container = container;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.audio = audioManager;
        this.el = null;
        this._particleRAF = null;
    }

    show() {
        this.el = document.createElement('div');
        this.el.className = 'screen active';
        this.el.id = 'screen-main-menu';
        this.el.innerHTML = this._buildHTML();
        this.container.appendChild(this.el);
        this._bindEvents();
        this._startParticles();

        // Stagger button reveal
        requestAnimationFrame(() => {
            const btns = this.el.querySelectorAll('.btn');
            btns.forEach((btn, i) => {
                btn.style.opacity = '0';
                btn.style.transform = 'translateY(16px)';
                setTimeout(() => {
                    btn.style.transition = 'opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out)';
                    btn.style.opacity = '1';
                    btn.style.transform = 'translateY(0)';
                }, 200 + i * 100);
            });
        });
    }

    hide() {
        if (this._particleRAF) cancelAnimationFrame(this._particleRAF);
        if (this.el) {
            this.el.classList.remove('active');
            setTimeout(() => this.el?.remove(), 500);
        }
    }

    _buildHTML() {
        const hasSave = this.gameState.hasSave();
        return `
            <div class="menu-container">
                <canvas id="menu-particles" style="position:absolute;inset:0;z-index:0;pointer-events:none;" aria-hidden="true"></canvas>
                <div class="menu-content" style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:var(--sp-8);">
                    <h1 class="game-title anim-fade-in">NEXUS-AI</h1>
                    <p class="game-subtitle anim-fade-in">Rebuild the Machine Intelligence</p>

                    <div class="menu-buttons stagger-children">
                        <button class="btn btn--primary" id="btn-new-game">
                            <span class="btn-icon">▶</span>
                            <span>New Game</span>
                        </button>
                        <button class="btn ${hasSave ? '' : 'btn--disabled'}" id="btn-continue" ${hasSave ? '' : 'disabled'}>
                            <span class="btn-icon">↻</span>
                            <span>Continue</span>
                        </button>
                        <button class="btn" id="btn-settings">
                            <span class="btn-icon">⚙</span>
                            <span>Settings</span>
                        </button>
                    </div>

                    <div class="menu-footer anim-fade-in">
                        <p class="menu-version">v0.1.0 — Phase 1: Foundational Python</p>
                    </div>
                </div>
            </div>
        `;
    }

    _bindEvents() {
        const newGameBtn = this.el.querySelector('#btn-new-game');
        const continueBtn = this.el.querySelector('#btn-continue');
        const settingsBtn = this.el.querySelector('#btn-settings');

        // Hover SFX for all buttons
        this.el.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => this.audio.playSFX('hover'));
        });

        newGameBtn.addEventListener('click', () => {
            this.audio.playSFX('click');
            this.audio.playSFX('boot');
            this.gameState.reset();
            this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'boot', data: { isNewGame: true } });
        });

        if (continueBtn && !continueBtn.disabled) {
            continueBtn.addEventListener('click', () => {
                this.audio.playSFX('click');
                this.gameState.load();
                this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'boot', data: { isNewGame: false } });
            });
        }

        settingsBtn.addEventListener('click', () => {
            this.audio.playSFX('click');
            this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'settings' });
        });
    }

    _startParticles() {
        const canvas = this.el.querySelector('#menu-particles');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let w, h;
        const particles = [];

        const resize = () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Create floating particles
        for (let i = 0; i < 60; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.5 + 0.1,
                color: Math.random() > 0.5 ? '0, 229, 255' : '168, 85, 247'
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, w, h);

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
                ctx.fill();

                // Glow
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color}, ${p.alpha * 0.15})`;
                ctx.fill();
            });

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0, 229, 255, ${0.08 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            this._particleRAF = requestAnimationFrame(animate);
        };
        animate();
    }
}
