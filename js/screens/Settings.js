/**
 * Settings — Settings screen with volume, difficulty,
 * font size controls, and save export/import.
 */
import { Events } from '../utils/EventBus.js';

export class Settings {
    constructor(container, eventBus, gameState, audioManager) {
        this.container = container;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.audio = audioManager;
        this.el = null;
    }

    show() {
        this.el = document.createElement('div');
        this.el.className = 'screen active';
        this.el.id = 'screen-settings';
        this.el.innerHTML = this._buildHTML();
        this.container.appendChild(this.el);
        this._bindEvents();
    }

    hide() {
        if (this.el) {
            this.el.classList.remove('active');
            setTimeout(() => this.el?.remove(), 500);
        }
    }

    _buildHTML() {
        const s = this.gameState.data.settings;
        return `
            <div class="settings-panel anim-scale-in">
                <h2>⚙ Settings</h2>

                <div class="setting-group">
                    <label>Master Volume <span class="value">${Math.round(s.masterVolume * 100)}%</span></label>
                    <input type="range" id="setting-master-vol" min="0" max="1" step="0.05" value="${s.masterVolume}">
                </div>

                <div class="setting-group">
                    <label>SFX Volume <span class="value">${Math.round(s.sfxVolume * 100)}%</span></label>
                    <input type="range" id="setting-sfx-vol" min="0" max="1" step="0.05" value="${s.sfxVolume}">
                </div>

                <div class="setting-group">
                    <label>Music Volume <span class="value">${Math.round(s.musicVolume * 100)}%</span></label>
                    <input type="range" id="setting-music-vol" min="0" max="1" step="0.05" value="${s.musicVolume}">
                </div>

                <div class="divider"></div>

                <div class="setting-group">
                    <label>Difficulty</label>
                    <select class="custom-select" id="setting-difficulty">
                        <option value="easy" ${s.difficulty === 'easy' ? 'selected' : ''}>Easy — Extra hints, relaxed timers</option>
                        <option value="normal" ${s.difficulty === 'normal' ? 'selected' : ''}>Normal — Balanced experience</option>
                        <option value="hard" ${s.difficulty === 'hard' ? 'selected' : ''}>Hard — Minimal hints, strict timers</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label>Editor Font Size <span class="value">${s.fontSize}px</span></label>
                    <input type="range" id="setting-font-size" min="10" max="24" step="1" value="${s.fontSize}">
                </div>

                <div class="divider"></div>

                <div class="setting-group" style="display:flex;gap:var(--sp-3);">
                    <button class="btn" id="btn-export-save" style="flex:1;">
                        <span>Export Save</span>
                    </button>
                    <button class="btn" id="btn-import-save" style="flex:1;">
                        <span>Import Save</span>
                    </button>
                    <input type="file" id="import-file" accept=".json" style="display:none;">
                </div>

                <div class="divider"></div>

                <button class="btn btn--primary" id="btn-settings-back" style="width:100%;">
                    <span class="btn-icon">←</span>
                    <span>Back to Menu</span>
                </button>
            </div>
        `;
    }

    _bindEvents() {
        // Volume sliders
        const bindSlider = (id, key) => {
            const slider = this.el.querySelector(`#${id}`);
            const label = slider.parentElement.querySelector('.value');
            slider.addEventListener('input', () => {
                const val = parseFloat(slider.value);
                label.textContent = key === 'fontSize' ? `${val}px` : `${Math.round(val * 100)}%`;
                this.gameState.updateSettings({ [key]: val });
            });
            slider.addEventListener('change', () => this.audio.playSFX('click'));
        };

        bindSlider('setting-master-vol', 'masterVolume');
        bindSlider('setting-sfx-vol', 'sfxVolume');
        bindSlider('setting-music-vol', 'musicVolume');
        bindSlider('setting-font-size', 'fontSize');

        // Difficulty
        this.el.querySelector('#setting-difficulty').addEventListener('change', (e) => {
            this.audio.playSFX('click');
            this.gameState.updateSettings({ difficulty: e.target.value });
        });

        // Export/Import
        this.el.querySelector('#btn-export-save').addEventListener('click', () => {
            this.audio.playSFX('click');
            this.gameState.exportSave();
        });
        this.el.querySelector('#btn-import-save').addEventListener('click', () => {
            this.audio.playSFX('click');
            this.el.querySelector('#import-file').click();
        });
        this.el.querySelector('#import-file').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await this.gameState.importSave(e.target.files[0]);
                this.audio.playSFX('success');
            }
        });

        // Back
        this.el.querySelector('#btn-settings-back').addEventListener('click', () => {
            this.audio.playSFX('click');
            this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'mainMenu' });
        });

        // Hover SFX
        this.el.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => this.audio.playSFX('hover'));
        });
    }
}
