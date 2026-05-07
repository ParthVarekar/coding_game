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
import { GameScreen } from './screens/GameScreen.js';
import { DashboardOverlay } from './screens/DashboardOverlay.js';

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
        this.screens.game = new GameScreen(this.appContainer, this.eventBus, this.gameState, this.audio, this.toast);

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

        // Initialize Stealth Assessment Dashboard (Teacher View)
        const dashboard = new DashboardOverlay(document.body, this.gameState);

        // Start Boot Sequence
        this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'boot' });

        // Expose for easy testing
        window.toggleTeacherDashboard = () => dashboard.toggle();

        console.log('[Nexus-AI] Initialized successfully.');
    }

    _bindEvents() {
        // Screen navigation
        this.eventBus.on(Events.SCREEN_CHANGE, ({ screen, data }) => {
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

    }

    _showScreen(name, data) {
        // Hide current
        if (this.currentScreen && this.screens[this.currentScreen]) {
            this.screens[this.currentScreen].hide();
        }

        // Show new
        if (this.screens[name]) {
            this.currentScreen = name;
            // Small delay for transition
            setTimeout(() => {
                this.screens[name].show(data);
            }, 100);
        } else {
            console.warn(`[NexusApp] Unknown screen: ${name}`);
        }
    }
}

// ─── Launch ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const app = new NexusApp();
    app.init();
});
