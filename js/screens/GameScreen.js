/**
 * GameScreen — Main gameplay screen with split-pane layout:
 * Left: Game world canvas / narrative
 * Right: Code editor + console output
 * Top: HUD with XP, level, megajoules
 */
import { Events } from '../utils/EventBus.js';
import { CodeEditor } from '../editor/CodeEditor.js';
import { PythonRunner } from '../editor/PythonRunner.js';
import { Renderer } from '../engine/Renderer.js';

export class GameScreen {
    constructor(container, eventBus, gameState, audioManager, toastManager) {
        this.container = container;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.audio = audioManager;
        this.toast = toastManager;
        this.el = null;
        this.codeEditor = new CodeEditor(container, eventBus, gameState);
        this.pythonRunner = new PythonRunner(eventBus);
        this.renderer = null;
        this._codingStartTime = null;
    }

    async show() {
        this.el = document.createElement('div');
        this.el.className = 'screen active';
        this.el.id = 'screen-game';
        this.el.innerHTML = this._buildHTML();
        this.container.appendChild(this.el);

        this._bindEvents();
        await this._initSystems();
    }

    hide() {
        if (this.renderer) this.renderer.destroy();
        if (this.codeEditor) this.codeEditor.destroy();
        if (this.el) {
            this.el.classList.remove('active');
            setTimeout(() => this.el?.remove(), 500);
        }
    }

    _buildHTML() {
        const p = this.gameState.data.player;
        return `
            <!-- HUD -->
            <div class="hud" id="game-hud">
                <div class="hud-left">
                    <div class="level-badge" id="hud-level">
                        <span>LV</span>
                        <span id="hud-level-num">${p.level}</span>
                    </div>
                    <div class="xp-bar-container" id="hud-xp-bar" title="XP: ${p.xp}">
                        <div class="xp-bar-fill" id="hud-xp-fill" style="width:${this.gameState.getLevelProgress() * 100}%"></div>
                    </div>
                    <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-muted);">${p.xp} XP</span>
                </div>
                <div class="hud-center" style="font-family:var(--font-display);font-size:0.9rem;color:var(--text-secondary);">
                    Supply Depot Alpha — <span style="color:var(--cyan);">Phase 1</span>
                </div>
                <div class="hud-right">
                    <div class="megajoules-meter" id="hud-megajoules">
                        <span class="megajoules-icon">⚡</span>
                        <span id="hud-mj-value">${this.gameState.data.megajoules}</span>
                        <span style="color:var(--text-muted);font-size:0.75rem;">MJ</span>
                    </div>
                    <button class="btn" id="btn-menu" style="padding:var(--sp-2) var(--sp-4);font-size:0.8rem;">
                        <span>☰ Menu</span>
                    </button>
                </div>
            </div>

            <!-- Split Pane Layout -->
            <div class="game-layout" id="game-layout">
                <!-- Left: Game World Panel -->
                <div class="game-panel" id="game-world-panel">
                    <div class="panel-header">
                        <span class="panel-tab active" id="game-tab">🌐 Supply Depot Alpha</span>
                    </div>
                    <div class="game-world-content" id="game-world-container" style="padding:0; overflow:hidden;">
                        <!-- Canvas will be injected here -->
                    </div>
                    <!-- Overlay for interaction prompts -->
                    <div id="interaction-prompt" style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:var(--cyan); padding:8px 16px; border:1px solid var(--cyan); border-radius:4px; font-family:var(--font-mono); font-size:0.9rem; pointer-events:none; opacity:0; transition:opacity 0.2s;">
                        Press [E] to Inspect
                    </div>
                </div>

                <!-- Resize Handle -->
                <div class="resize-handle" id="resize-handle" title="Drag to resize"></div>

                <!-- Right: Code Editor Panel -->
                <div class="editor-panel" id="editor-panel">
                    <div class="panel-header">
                        <span class="panel-tab active">📝 Code Editor</span>
                        <div class="panel-actions">
                            <button class="run-btn" id="btn-run" title="Run code (Ctrl+Enter)">
                                <span>▶</span> Run
                            </button>
                            <button class="clear-btn" id="btn-clear-console" title="Clear console">
                                Clear
                            </button>
                        </div>
                    </div>
                    <div class="editor-container" id="editor-container">
                        <!-- CodeMirror will be injected here -->
                    </div>
                    <div class="console-container" id="console-container">
                        <div class="panel-header console-header">
                            <span class="panel-tab active">⬛ Console Output</span>
                            <span class="pyodide-status" id="pyodide-status">Loading Python...</span>
                        </div>
                        <div class="console-output" id="console-output">
                            <div class="console-line console-info">Initializing Python runtime...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async _initSystems() {
        // Init CodeMirror
        const editorContainer = this.el.querySelector('#editor-container');
        try {
            await this.codeEditor.init();
            this.codeEditor.create(
                editorContainer,
                '# Welcome to Nexus-AI!\n# Write your Python code here.\n\nprint("Hello, Engineer!")\n',
                (code) => this._runCode(code)
            );
            this._appendConsole('Code editor loaded.', 'info');
        } catch (err) {
            this._appendConsole('Failed to load code editor: ' + err.message, 'error');
        }

        // Init Pyodide
        const statusEl = this.el.querySelector('#pyodide-status');
        try {
            await this.pythonRunner.init((msg) => {
                if (statusEl) statusEl.textContent = msg;
                this._appendConsole(msg, 'info');
            });
            if (statusEl) {
                statusEl.textContent = '🟢 Python Ready';
                statusEl.style.color = 'var(--success)';
            }
        } catch (err) {
            if (statusEl) {
                statusEl.textContent = '🔴 Python Failed';
                statusEl.style.color = 'var(--error)';
            }
            this._appendConsole('Failed to load Python: ' + err.message, 'error');
        }

        // Init Game Renderer
        this.renderer = new Renderer('game-world-container', this.eventBus);
        await this.renderer.init();
        this.renderer.start();
    }

    _bindEvents() {
        // Run button
        this.el.querySelector('#btn-run')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            const code = this.codeEditor.getCode();
            this._runCode(code);
        });

        // Clear console
        this.el.querySelector('#btn-clear-console')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            const output = this.el.querySelector('#console-output');
            if (output) output.innerHTML = '';
        });

        // Menu button
        this.el.querySelector('#btn-menu')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'mainMenu' });
        });

        // Resize handle
        this._initResizeHandle();

        // Track coding time
        this._codingStartTime = Date.now();

        // HUD update listeners
        this.eventBus.on(Events.XP_GAINED, () => this._updateHUD());
        this.eventBus.on(Events.MEGAJOULES_CHANGED, () => this._updateHUD());
        this.eventBus.on(Events.LEVEL_UP, () => this._updateHUD());

        // Game World Interaction Listeners
        const promptEl = this.el.querySelector('#interaction-prompt');
        this.eventBus.on('SHOW_PROMPT', ({ text }) => {
            if (promptEl) {
                promptEl.textContent = text;
                promptEl.style.opacity = '1';
            }
        });
        this.eventBus.on('HIDE_PROMPT', () => {
            if (promptEl) promptEl.style.opacity = '0';
        });
        this.eventBus.on('INTERACT', ({ entity }) => {
            this._handleInteraction(entity);
        });

        // Editor focus tracking for InputManager
        const editorContainer = this.el.querySelector('#editor-container');
        editorContainer?.addEventListener('focusin', () => this.eventBus.emit(Events.IDE_FOCUSED));
        editorContainer?.addEventListener('focusout', () => this.eventBus.emit(Events.IDE_BLURRED));
    }

    _handleInteraction(entity) {
        if (entity.type === 'terminal' && !entity.isRepaired) {
            this.audio.playSFX('type');
            this.codeEditor.setCode(`# Challenge: Fix the terminal power loop
# The terminal needs exactly 10 power units to reboot.
# Fix the loop below to print numbers 1 through 10.

power = 0
for i in range(5):
    power += 1
    print(f"Power level: {power}")
`);
            this.codeEditor.focus();
            this._appendConsole(`[SYSTEM] Accessing broken terminal ${entity.challengeId}...`, 'info');
        } else if (entity.type === 'terminal' && entity.isRepaired) {
            this._appendConsole(`[SYSTEM] Terminal is fully operational.`, 'success');
        }
    }

    async _runCode(code) {
        if (!code.trim()) {
            this._appendConsole('No code to run.', 'warning');
            return;
        }

        this._appendConsole('▶ Running...', 'info');
        const runBtn = this.el.querySelector('#btn-run');
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.textContent = '⏳ Running...';
        }

        const codingTime = Date.now() - (this._codingStartTime || Date.now());
        const result = await this.pythonRunner.run(code);

        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = '<span>▶</span> Run';
        }

        if (result.success) {
            this.audio.playSFX('success');
            if (result.output) {
                this._appendConsole(result.output, 'output');
            } else {
                this._appendConsole('✓ Code executed successfully (no output).', 'success');
            }
            this._appendConsole(`⏱ ${result.executionTime.toFixed(1)}ms`, 'muted');

            // Challenge validation logic (hardcoded for Prototype Phase 3)
            const code = this.codeEditor.getCode();
            if (code.includes('range(1, 11)') || code.includes('range(10)') && result.output.includes('Power level: 10')) {
                const term = this.renderer.entities.interactables.find(e => e.challengeId === 'challenge_1');
                if (term && !term.isRepaired) {
                    term.isRepaired = true;
                    this.renderer.camera.shake(5, 300); // Shake on success
                    this._appendConsole('[SYSTEM] Power loop restored. Terminal online.', 'success');
                    this.gameState.addXP(100, 'Terminal Repaired');
                    this.gameState.addMegajoules(50);
                }
            } else {
                // Regular execution rewards
                this.gameState.addXP(10, 'Code executed');
                this.gameState.addMegajoules(5);
            }

            // Check first code badge
            if (!this.gameState.hasBadge('first_code')) {
                this.gameState.earnBadge('first_code');
            }

            // Telemetry
            this.gameState.recordSubmission({
                challengeId: null,
                success: true,
                errorType: null,
                timeMs: codingTime,
            });
        } else {
            this.audio.playSFX('error');
            this._appendConsole(result.error, 'error');
            if (result.errorLine) {
                this._appendConsole(`  ↳ Error on line ${result.errorLine}`, 'error-hint');
            }

            // Telemetry
            this.gameState.recordSubmission({
                challengeId: null,
                success: false,
                errorType: result.errorType,
                timeMs: codingTime,
            });
        }

        this._codingStartTime = Date.now();
        this.eventBus.emit(Events.CODE_SUBMITTED, result);
    }

    _appendConsole(text, type = 'output') {
        const output = this.el.querySelector('#console-output');
        if (!output) return;

        const line = document.createElement('div');
        line.className = `console-line console-${type}`;
        line.textContent = text;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    _updateHUD() {
        const p = this.gameState.data;
        const levelNum = this.el.querySelector('#hud-level-num');
        const xpFill = this.el.querySelector('#hud-xp-fill');
        const mjValue = this.el.querySelector('#hud-mj-value');

        if (levelNum) levelNum.textContent = p.player.level;
        if (xpFill) xpFill.style.width = `${this.gameState.getLevelProgress() * 100}%`;
        if (mjValue) mjValue.textContent = p.megajoules;
    }

    _initResizeHandle() {
        const handle = this.el.querySelector('#resize-handle');
        const layout = this.el.querySelector('#game-layout');
        const gamePanel = this.el.querySelector('#game-world-panel');
        if (!handle || !layout || !gamePanel) return;

        let isResizing = false;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const layoutRect = layout.getBoundingClientRect();
            const percent = ((e.clientX - layoutRect.left) / layoutRect.width) * 100;
            const clamped = Math.min(70, Math.max(25, percent));
            gamePanel.style.width = `${clamped}%`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
}
