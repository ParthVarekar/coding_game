/**
 * main.js — Nexus-AI Application Entry Point
 * Initializes all subsystems, manages screen transitions,
 * and starts the star field background.
 */
import { EventBus, Events } from './utils/EventBus.js';
import { GameState } from './state/GameState.js';
import { AudioManager } from './audio/AudioManager.js';
import { StarField } from './engine/StarField.js';
import { ToastManager } from './ui/ToastManager.js';
import { MainMenu } from './screens/MainMenu.js';
import { Settings } from './screens/Settings.js';
import { BootScreen } from './screens/BootScreen.js';

class NexusApp {
    constructor() {
        this.eventBus = new EventBus();
        this.gameState = new GameState(this.eventBus);
        this.audio = new AudioManager(this.eventBus);
        this.toast = new ToastManager('toast-container');

        this.appContainer = document.getElementById('app');
        this.currentScreen = null;
        this.screens = {};

        // Register screens
        this.screens.mainMenu = new MainMenu(this.appContainer, this.eventBus, this.gameState, this.audio);
        this.screens.settings = new Settings(this.appContainer, this.eventBus, this.gameState, this.audio);
        this.screens.boot = new BootScreen(this.appContainer, this.eventBus, this.gameState, this.audio);

        this._bindEvents();
    }

    init() {
        // Start star field
        this.starField = new StarField('star-canvas');

        // Initialize audio on first user interaction
        const initAudio = () => {
            this.audio.init();
            this.audio.resume();
            document.removeEventListener('click', initAudio);
            document.removeEventListener('keydown', initAudio);
        };
        document.addEventListener('click', initAudio);
        document.addEventListener('keydown', initAudio);

        // Show main menu
        this._showScreen('mainMenu');

        console.log('[Nexus-AI] Initialized successfully.');
    }

    _bindEvents() {
        // Screen navigation
        this.eventBus.on(Events.SCREEN_CHANGE, ({ screen, data }) => {
            this.audio.playSFX('transition');
            this._showScreen(screen, data);
        });

        // XP toast
        this.eventBus.on(Events.XP_GAINED, ({ amount, reason }) => {
            this.toast.showXP(amount, reason);
        });

        // Badge toast
        this.eventBus.on(Events.BADGE_EARNED, (badge) => {
            this.audio.playSFX('badge');
            this.toast.showBadge(badge);
        });

        // Level up toast
        this.eventBus.on(Events.LEVEL_UP, ({ level, title }) => {
            this.audio.playSFX('level_up');
            this.toast.show(`Level ${level}! — ${title}`, 'success', 4000);
        });

        // "Game" screen placeholder — for now show a message and allow return
        // This will be replaced with the actual game world in Phase 3
    }

    _showScreen(name, data) {
        // Hide current
        if (this.currentScreen && this.screens[this.currentScreen]) {
            this.screens[this.currentScreen].hide();
        }

        // Handle "game" screen specially until Phase 3 is built
        if (name === 'game') {
            this.currentScreen = name;
            this._showGamePlaceholder();
            return;
        }

        // Show new
        if (this.screens[name]) {
            this.currentScreen = name;
            // Small delay for transition
            setTimeout(() => {
                this.screens[name].show(data);
            }, name === this.currentScreen ? 0 : 100);
        } else {
            console.warn(`[NexusApp] Unknown screen: ${name}`);
        }
    }

    _showGamePlaceholder() {
        // Temporary game world placeholder until the full renderer is built
        const el = document.createElement('div');
        el.className = 'screen active';
        el.id = 'screen-game-placeholder';
        el.innerHTML = `
            <div class="settings-panel anim-scale-in" style="text-align:center;">
                <h2 style="margin-bottom:var(--sp-4);">⚡ Systems Online</h2>
                <p style="color:var(--text-secondary);margin-bottom:var(--sp-4);">
                    Supply Depot Alpha — Sector 7<br>
                    <span style="color:var(--cyan);font-family:var(--font-mono);font-size:0.85rem;">
                        Phase 1: Foundational Python
                    </span>
                </p>
                <div style="margin-bottom:var(--sp-6);">
                    <div style="display:flex;justify-content:center;gap:var(--sp-6);margin-bottom:var(--sp-4);">
                        <div>
                            <div style="font-size:2rem;color:var(--cyan);">LV ${this.gameState.data.player.level}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">${this.gameState.data.player.title}</div>
                        </div>
                        <div>
                            <div style="font-size:2rem;color:var(--purple);">${this.gameState.data.player.xp}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">Total XP</div>
                        </div>
                        <div>
                            <div style="font-size:2rem;color:var(--teal);">⚡${this.gameState.data.megajoules}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">Megajoules</div>
                        </div>
                    </div>
                    <div class="xp-bar-container" style="width:100%;margin:0 auto;">
                        <div class="xp-bar-fill" style="width:${this.gameState.getLevelProgress() * 100}%;"></div>
                    </div>
                </div>
                <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:var(--sp-6);">
                    Game world rendering engine coming in Development Phase 3.<br>
                    Core shell, state management, and audio systems are operational.
                </p>
                <div style="display:flex;gap:var(--sp-3);justify-content:center;">
                    <button class="btn" id="btn-test-xp">
                        <span>+50 XP Test</span>
                    </button>
                    <button class="btn" id="btn-test-badge">
                        <span>Test Badge</span>
                    </button>
                    <button class="btn btn--primary" id="btn-back-menu">
                        <span class="btn-icon">←</span>
                        <span>Menu</span>
                    </button>
                </div>
            </div>
        `;
        this.appContainer.appendChild(el);

        // Test buttons
        el.querySelector('#btn-test-xp').addEventListener('click', () => {
            this.audio.playSFX('click');
            this.gameState.addXP(50, 'System test');
            this.gameState.addMegajoules(25);
            // Refresh display
            this._refreshPlaceholder(el);
        });

        el.querySelector('#btn-test-badge').addEventListener('click', () => {
            this.audio.playSFX('click');
            this.gameState.earnBadge('first_code');
        });

        el.querySelector('#btn-back-menu').addEventListener('click', () => {
            this.audio.playSFX('click');
            el.classList.remove('active');
            setTimeout(() => el.remove(), 500);
            this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'mainMenu' });
        });

        // Hover SFX
        el.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => this.audio.playSFX('hover'));
        });
    }

    _refreshPlaceholder(el) {
        const lvEl = el.querySelector('div[style*="2rem"][style*="cyan"]');
        if (lvEl) lvEl.textContent = `LV ${this.gameState.data.player.level}`;
        const xpEl = el.querySelectorAll('div[style*="2rem"]')[1];
        if (xpEl) xpEl.textContent = this.gameState.data.player.xp;
        const mjEl = el.querySelectorAll('div[style*="2rem"]')[2];
        if (mjEl) mjEl.textContent = `⚡${this.gameState.data.megajoules}`;
        const xpBar = el.querySelector('.xp-bar-fill');
        if (xpBar) xpBar.style.width = `${this.gameState.getLevelProgress() * 100}%`;
    }
}

// ─── Launch ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const app = new NexusApp();
    app.init();
});
