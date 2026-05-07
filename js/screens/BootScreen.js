/**
 * BootScreen — Simulated system boot sequence with typing text
 * and progress bar. Transitions to game world on completion.
 */
import { Events } from '../utils/EventBus.js';

const BOOT_LINES_NEW = [
    '> NEXUS-AI CORE v0.1.0',
    '> Initializing neural pathways...',
    '> Scanning for legacy Python interpreter... FOUND',
    '> Loading memory banks... 12 sectors corrupted',
    '> Calibrating Bot Buddy companion... ONLINE',
    '> Establishing uplink to Supply Depot Alpha...',
    '> WARNING: Central AI infrastructure compromised',
    '> Directive: Restore systems using foundational code',
    '> Boot sequence complete. Welcome, Engineer.',
    '',
    '> Starting mission briefing...',
];

const BOOT_LINES_CONTINUE = [
    '> NEXUS-AI CORE v0.1.0',
    '> Restoring previous session...',
    '> Loading save data... OK',
    '> Reconnecting to facility network...',
    '> Systems nominal. Welcome back, Engineer.',
];

export class BootScreen {
    constructor(container, eventBus, gameState, audioManager) {
        this.container = container;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.audio = audioManager;
        this.el = null;
        this._timeouts = [];
    }

    show(data = {}) {
        this.el = document.createElement('div');
        this.el.className = 'screen active';
        this.el.id = 'screen-boot';
        this.el.innerHTML = `
            <div class="boot-screen">
                <div class="boot-terminal" id="boot-terminal"></div>
                <div class="boot-progress">
                    <div class="boot-progress-fill" id="boot-progress-fill"></div>
                </div>
            </div>
        `;
        this.container.appendChild(this.el);

        const lines = data.isNewGame ? BOOT_LINES_NEW : BOOT_LINES_CONTINUE;
        this._runSequence(lines);
    }

    hide() {
        this._timeouts.forEach(t => clearTimeout(t));
        this._timeouts = [];
        if (this.el) {
            this.el.classList.remove('active');
            setTimeout(() => this.el?.remove(), 500);
        }
    }

    _runSequence(lines) {
        const terminal = this.el.querySelector('#boot-terminal');
        const progressFill = this.el.querySelector('#boot-progress-fill');
        let currentLine = 0;

        const addLine = () => {
            if (currentLine >= lines.length) {
                // Boot complete — transition to game
                const t = setTimeout(() => {
                    this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'game' });
                }, 800);
                this._timeouts.push(t);
                return;
            }

            const line = lines[currentLine];
            const lineEl = document.createElement('div');
            lineEl.className = 'boot-text';
            lineEl.style.animation = 'none';
            lineEl.style.textAlign = 'left';
            lineEl.style.opacity = '0';
            terminal.appendChild(lineEl);

            // Type out each character
            let charIdx = 0;
            const typeChar = () => {
                if (charIdx < line.length) {
                    lineEl.textContent += line[charIdx];
                    lineEl.style.opacity = '1';
                    this.audio.playSFX('type');
                    charIdx++;
                    const t = setTimeout(typeChar, 20 + Math.random() * 30);
                    this._timeouts.push(t);
                } else {
                    lineEl.style.opacity = '1';
                    currentLine++;
                    progressFill.style.width = `${(currentLine / lines.length) * 100}%`;
                    const t = setTimeout(addLine, 150 + Math.random() * 200);
                    this._timeouts.push(t);
                }
            };

            if (line === '') {
                currentLine++;
                const t = setTimeout(addLine, 300);
                this._timeouts.push(t);
            } else {
                typeChar();
            }
        };

        addLine();
    }
}
