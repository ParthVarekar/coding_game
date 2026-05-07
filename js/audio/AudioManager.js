/**
 * AudioManager — Web Audio API scaffolding for Nexus-AI.
 * Generates procedural sound effects (beeps, boops, drones)
 * for immediate feedback. Polished audio assets will be
 * integrated in a future phase.
 */
import { Events } from '../utils/EventBus.js';

export class AudioManager {
    /**
     * @param {import('../utils/EventBus.js').EventBus} eventBus
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        /** @type {AudioContext|null} */
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this._initialized = false;

        // Subscribe to audio events
        this.eventBus.on(Events.AUDIO_PLAY_SFX, (sfxName) => this.playSFX(sfxName));
        this.eventBus.on(Events.SETTINGS_CHANGED, (settings) => this._applySettings(settings));
    }

    /**
     * Initialize AudioContext (must be called after user gesture).
     */
    init() {
        if (this._initialized) return;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Master → output
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.7;
            this.masterGain.connect(this.ctx.destination);

            // SFX bus
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.8;
            this.sfxGain.connect(this.masterGain);

            // Music bus
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.5;
            this.musicGain.connect(this.masterGain);

            this._initialized = true;
        } catch (err) {
            console.warn('[AudioManager] Web Audio API not available:', err);
        }
    }

    /**
     * Resume the audio context if it was suspended by the browser.
     */
    async resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // ─── SFX Dispatch ────────────────────────────────────────

    playSFX(name) {
        if (!this._initialized) return;

        switch (name) {
            case 'click':      this._playClick(); break;
            case 'hover':      this._playHover(); break;
            case 'success':    this._playSuccess(); break;
            case 'error':      this._playError(); break;
            case 'xp_gain':    this._playXPGain(); break;
            case 'level_up':   this._playLevelUp(); break;
            case 'badge':      this._playBadge(); break;
            case 'type':       this._playType(); break;
            case 'boot':       this._playBoot(); break;
            case 'transition': this._playTransition(); break;
            default:           this._playClick(); break;
        }
    }

    // ─── Procedural SFX Generators ───────────────────────────

    _playClick() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.connect(gain).connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    _playHover() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain).connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
    }

    _playSuccess() {
        // Ascending arpeggio: C5 → E5 → G5
        const notes = [523, 659, 784];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.1 + 0.2);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(this.ctx.currentTime + i * 0.1);
            osc.stop(this.ctx.currentTime + i * 0.1 + 0.2);
        });
    }

    _playError() {
        // Low buzz with descending pitch
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain).connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    _playXPGain() {
        // Quick shimmer
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(gain).connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    _playLevelUp() {
        // Triumphant ascending fanfare
        const notes = [392, 523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.12);
            gain.gain.setValueAtTime(0.18, this.ctx.currentTime + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.12 + 0.35);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(this.ctx.currentTime + i * 0.12);
            osc.stop(this.ctx.currentTime + i * 0.12 + 0.35);
        });
    }

    _playBadge() {
        // Sparkle effect
        for (let i = 0; i < 6; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000 + i * 200, this.ctx.currentTime + i * 0.06);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.06 + 0.15);
            osc.connect(gain).connect(this.sfxGain);
            osc.start(this.ctx.currentTime + i * 0.06);
            osc.stop(this.ctx.currentTime + i * 0.06 + 0.15);
        }
    }

    _playType() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400 + Math.random() * 200, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);
        osc.connect(gain).connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.02);
    }

    _playBoot() {
        // System boot sequence — ascending sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2000, this.ctx.currentTime + 0.8);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);
        osc.connect(gain).connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.9);
    }

    _playTransition() {
        // Swoosh
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        osc.connect(gain).connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }

    // ─── Settings Integration ────────────────────────────────

    _applySettings(settings) {
        if (!this._initialized) return;
        if (settings.masterVolume !== undefined) {
            this.masterGain.gain.setValueAtTime(settings.masterVolume, this.ctx.currentTime);
        }
        if (settings.sfxVolume !== undefined) {
            this.sfxGain.gain.setValueAtTime(settings.sfxVolume, this.ctx.currentTime);
        }
        if (settings.musicVolume !== undefined) {
            this.musicGain.gain.setValueAtTime(settings.musicVolume, this.ctx.currentTime);
        }
    }
}
