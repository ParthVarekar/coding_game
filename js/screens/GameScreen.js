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
import { NarrativeEngine } from '../engine/NarrativeEngine.js';
import { CurriculumLoader } from '../utils/CurriculumLoader.js';

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
        this.curriculum = new CurriculumLoader();
        this.renderer = null;
        this.narrativeEngine = null;
        this._codingStartTime = null;
        this.contentSource = 'official';
        this.isTestMode = false;
        this.startLevelId = null;
        this.isActive = false;
    }

    async show(data = {}) {
        this.contentSource = data.contentSource || 'official';
        this.isTestMode = Boolean(data.isTestMode);
        this.startLevelId = data.startLevelId || null;
        this.isActive = true;
        if (data.resetProgress) {
            this.gameState.data.completedChallenges = [];
        }

        this.el = document.createElement('div');
        this.el.className = 'screen active';
        this.el.id = 'screen-game';
        this.el.innerHTML = this._buildHTML();
        this.container.appendChild(this.el);

        this._bindEvents();
        await this._initSystems();
    }

    hide() {
        this.isActive = false;
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
                        <span>${this.isTestMode ? 'Exit Test' : '☰ Menu'}</span>
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
                    
                    <!-- Quest Tracker -->
                    <div class="quest-tracker" id="quest-tracker">
                        <div class="quest-title">CURRENT DIRECTIVE</div>
                        <div class="quest-objective" id="quest-objective">Awaiting orders...</div>
                    </div>

                    <!-- Overlay for interaction prompts -->
                    <div id="interaction-prompt" style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:var(--cyan); padding:8px 16px; border:1px solid var(--cyan); border-radius:4px; font-family:var(--font-mono); font-size:0.9rem; pointer-events:none; opacity:0; transition:opacity 0.2s; z-index:50;">
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
        if (!this._canContinueInit()) return;

        // Initialize Xterm.js Terminal
        const consoleEl = this.el.querySelector('#console-output');
        if (consoleEl) {
            consoleEl.innerHTML = ''; // Clear custom console
            
            // @ts-ignore - Loaded via CDN
            this.terminal = new window.Terminal({
                theme: {
                    background: '#06060c',
                    foreground: '#00e5ff',
                    cursor: '#00e5ff',
                    black: '#000000',
                    red: '#ff5555',
                    green: '#50fa7b',
                    yellow: '#f1fa8c',
                    blue: '#8be9fd',
                    magenta: '#ff79c6',
                    cyan: '#8be9fd',
                    white: '#bfbfbf',
                },
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                cursorBlink: true,
                convertEol: true,
                rows: 10,
                scrollback: 1000,
            });

            // @ts-ignore - Loaded via CDN
            const fitAddon = new window.FitAddon.FitAddon();
            this.terminal.loadAddon(fitAddon);
            this.terminal.open(consoleEl);
            
            // Adjust fit
            setTimeout(() => fitAddon.fit(), 100);
            window.addEventListener('resize', () => fitAddon.fit());

            // Handle Terminal Input (Interactive Mode)
            let inputLine = "";
            this.terminal.onData(data => {
                const char = data;
                
                if (char === '\r') { // Enter key
                    this.terminal.write('\r\n');
                    if (this.pythonRunner.hasSharedMemory) {
                        this.pythonRunner.sendInput(inputLine);
                    } else {
                        console.warn('Input ignored: Shared memory not active.');
                    }
                    inputLine = "";
                } else if (char === '\u007f') { // Backspace
                    if (inputLine.length > 0) {
                        inputLine = inputLine.slice(0, -1);
                        this.terminal.write('\b \b');
                    }
                } else {
                    inputLine += char;
                    this.terminal.write(char);
                }
            });
            
            this.terminal.writeln('\x1b[1;36m[NEXUS-AI CONSOLE v1.0 READY]\x1b[0m');
        }

        // Init Curriculum
        this.curriculum = new CurriculumLoader(this.contentSource);
        await this.curriculum.init();
        if (!this._canContinueInit()) return;

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
        if (!this._canContinueInit() || !document.getElementById('game-world-container')) return;

        // Init Game Renderer
        this.renderer = new Renderer('game-world-container', this.eventBus);
        
        // Load map data
        this.mapsData = await this._loadMapsData();
        const currentMap = this.mapsData[0]; // For now, load first map
        
        await this.renderer.init(currentMap, this.gameState);
        this.renderer.start();

        // Listen for map transitions
        this.eventBus.on(Events.MAP_TRANSITION, ({ targetMapId }) => {
            this._switchMap(targetMapId);
        });

        // Init Narrative Engine
        this.narrativeEngine = new NarrativeEngine(
            this.eventBus,
            this.gameState,
            this.audio,
            this.el.querySelector('#game-world-panel'),
            this.renderer.entities.bot,
            this.curriculum,
            currentMap
        );
    }

    _canContinueInit() {
        return this.isActive && this.el && this.el.isConnected;
    }

    _bindEvents() {
        // Run button
        const runBtn = this.el.querySelector('#btn-run');
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                console.log('[GameScreen] Run button clicked');
                this.audio.playSFX('click');
                const code = this.codeEditor.getCode();
                this._runCode(code);
            });
        } else {
            console.error('[GameScreen] Run button not found in DOM');
        }

        // Clear console
        this.el.querySelector('#btn-clear-console')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            const output = this.el.querySelector('#console-output');
            if (output) output.innerHTML = '';
        });

        // Menu button
        this.el.querySelector('#btn-menu')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this.eventBus.emit(Events.SCREEN_CHANGE, { screen: this.isTestMode ? 'levelEditor' : 'mainMenu' });
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
            
            const challenge = this.curriculum.getChallenge(entity.challengeId);
            if (challenge) {
                this.codeEditor.setCode(challenge.defaultCode);
            } else {
                this.codeEditor.setCode(`# Error: Challenge ${entity.challengeId} not found.`);
            }
            
            this.codeEditor.focus();
            this._appendConsole(`[SYSTEM] Accessing broken terminal ${entity.challengeId}...`, 'info');
        } else if (entity.type === 'terminal' && entity.isRepaired) {
            this._appendConsole(`[SYSTEM] Terminal is fully operational.`, 'success');
        }
    }

    async _runCode(code) {
        if (!code.trim()) {
            this.toast.show('No code to execute', 'warning');
            this._appendConsole('No code to run.', 'warning');
            return;
        }

        this.toast.show('Executing Python...', 'info');
        this._appendConsole('▶ Running...', 'info');
        const runBtn = this.el.querySelector('#btn-run');
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.textContent = '⏳ Running...';
        }

        const codingTime = Date.now() - (this._codingStartTime || Date.now());
        let result;
        
        try {
            result = await this.pythonRunner.run(
                code,
                (out) => this._appendConsole(out, 'output'),
                (err) => this._appendConsole(err, 'error')
            );
        } catch (err) {
            console.error('[GameScreen] Execution error:', err);
            result = {
                success: false,
                output: '',
                error: 'An unexpected runner error occurred: ' + err.message,
                errorType: 'runtime',
                errorLine: null,
                executionTime: 0
            };
        }

        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = '<span>▶</span> Run';
        }

        if (result.success) {
            this.audio.playSFX('success');
            // Real-time console has already handled output.
            this._appendConsole(`⏱ ${result.executionTime.toFixed(1)}ms`, 'muted');

            // Challenge validation is now handled fully by NarrativeEngine,
            // but we still handle global rewards here
            this.gameState.addXP(10, 'Code executed');
            this.gameState.addMegajoules(5);

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

            // Telemetry
            this.gameState.recordSubmission({
                challengeId: null,
                success: false,
                errorType: result.errorType,
                timeMs: codingTime,
            });
        }

        this._codingStartTime = Date.now();
        // Let narrative engine process the result
        this.eventBus.emit(Events.CODE_SUBMITTED, { result, code });
    }

    _appendConsole(text, type = 'output') {
        if (!this.terminal) return;
        
        const colors = {
            'info': '\x1b[1;34m[INFO]\x1b[0m ',
            'output': '',
            'error': '\x1b[1;31m[ERROR]\x1b[0m ',
            'warning': '\x1b[1;33m[WARN]\x1b[0m ',
            'error-hint': '  \x1b[3;31m↳\x1b[0m '
        };

        const prefix = colors[type] || '';
        // Standardize output for Xterm.js
        const lines = String(text).split('\n');
        lines.forEach(line => {
            this.terminal.writeln(prefix + line);
        });
    }

    async _loadMapsData() {
        if (this.contentSource === 'custom') {
            const campaign = this._loadCustomCampaign();
            if (campaign.levels?.length) {
                const maps = campaign.levels
                    .map((level) => this._mapDataFromCampaignLevel(level))
                    .filter(Boolean);
                const startLevelId = this.startLevelId || campaign.entryLevelId || maps[0]?.id;
                const entry = maps.find((map) => map.id === startLevelId);
                return entry ? [entry, ...maps.filter((map) => map.id !== entry.id)] : maps;
            }

            const serialized = localStorage.getItem('nexus_ai_user_maps')
                || localStorage.getItem('user_maps.json');
            if (!serialized) throw new Error('No custom maps saved in localStorage');
            const maps = JSON.parse(serialized).maps || [];
            const legacyCampaign = JSON.parse(localStorage.getItem('nexus_ai_user_campaign')
                || localStorage.getItem('user_campaign.json')
                || '{}');
            const startMapId = this.startLevelId || legacyCampaign.entryMapId;
            if (!startMapId) return maps;
            const entry = maps.find((map) => map.id === startMapId);
            return entry ? [entry, ...maps.filter((map) => map.id !== startMapId)] : maps;
        }

        const mapsResponse = await fetch('data/maps.json');
        return (await mapsResponse.json()).maps;
    }

    _loadCustomCampaign() {
        try {
            const serialized = localStorage.getItem('nexus_ai_user_campaign')
                || localStorage.getItem('user_campaign.json');
            return serialized ? JSON.parse(serialized) : { levels: [] };
        } catch (error) {
            console.warn('[GameScreen] Failed to read custom campaign:', error);
            return { levels: [] };
        }
    }

    _mapDataFromCampaignLevel(level) {
        if (!level?.mapData) return null;
        const botBuddy = level.curriculumData?.botBuddy || level.mapData.botBuddy;
        return {
            ...level.mapData,
            id: level.levelId || level.mapData.id,
            name: level.levelName || level.mapData.name || level.levelId,
            botBuddy,
        };
    }

    async _switchMap(mapId) {
        const mapData = this.mapsData.find(m => m.id === mapId);
        if (!mapData) {
            this._appendConsole(`[ERROR] Map ${mapId} not found!`, 'error');
            return;
        }

        this._appendConsole(`[SYSTEM] Transitioning to: ${mapData.name}`, 'info');
        
        // Re-init renderer systems with new data
        await this.renderer.init(mapData, this.gameState);
        
        // Update NarrativeEngine dependencies (Bot Buddy instance has changed)
        if (this.narrativeEngine) {
            this.narrativeEngine.bot = this.renderer.entities.bot;
            this.narrativeEngine.setMapData(mapData);
        }

        this.eventBus.emit(Events.MAP_CHANGED, { mapId });
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
