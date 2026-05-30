/**
 * LevelEditorScreen - Nexus-AI custom level creation.
 */
import { Events } from '../utils/EventBus.js';
import { LevelEditorCanvas } from '../editor/LevelEditorCanvas.js';

const USER_MAPS_KEY = 'nexus_ai_user_maps';
const USER_CURRICULUM_KEY = 'nexus_ai_user_curriculum';
const USER_CAMPAIGN_KEY = 'nexus_ai_user_campaign';
const TILE_SIZE = 64;

const DEFAULT_BRUSHES = {
    'tile-void': { kind: 'tile', tileId: 0, label: 'Void' },
    'tile-floor': { kind: 'tile', tileId: 1, label: 'Floor' },
    'tile-wall': { kind: 'tile', tileId: 2, label: 'Wall' },
    'tile-hazard': { kind: 'tile', tileId: 3, label: 'Hazard' },
    'entity-player': { kind: 'entity', entityType: 'playerStart', label: 'Player Spawn' },
    'entity-terminal': { kind: 'entity', entityType: 'terminal', label: 'Terminal' },
    'entity-portal': { kind: 'entity', entityType: 'portal', label: 'Portal' },
    'entity-return-portal': { kind: 'entity', entityType: 'returnPortal', label: 'Return Portal' },
    'entity-bot': { kind: 'entity', entityType: 'bot', label: 'Bot Buddy' },
};

export class LevelEditorScreen {
    constructor(container, eventBus, audioManager) {
        this.container = container;
        this.eventBus = eventBus;
        this.audio = audioManager;
        this.el = null;
        this.editor = null;
        this.status = null;
        this.brushes = { ...DEFAULT_BRUSHES };
        this.activeBrushKey = 'tile-floor';
        this.activeTerminal = null;
        this.activePortal = null;
        this.activeBot = null;
        this.currentLevelId = 'custom_level_1';
        this.currentLevelName = 'Custom Level 1';
        this.loadedLevelId = this.currentLevelId;
        this.graphPositions = {};
        this.graphDrag = null;
        this.graphWire = null;
        this._boundGraphPointerMove = (event) => this._handleGraphPointerMove(event);
        this._boundGraphPointerUp = (event) => this._handleGraphPointerUp(event);
    }

    async show() {
        this.el = document.createElement('div');
        this.el.className = 'screen active level-editor-screen';
        this.el.id = 'screen-level-editor';
        this.el.innerHTML = this._buildHTML();
        this.container.appendChild(this.el);

        this._bindEvents();
        await this._initEditor();
    }

    hide() {
        this.editor?.destroy();
        this.editor = null;
        window.removeEventListener('pointermove', this._boundGraphPointerMove);
        window.removeEventListener('pointerup', this._boundGraphPointerUp);

        if (this.el) {
            this.el.classList.remove('active');
            setTimeout(() => this.el?.remove(), 250);
        }
    }

    _buildHTML() {
        return `
            <div class="level-editor-shell">
                <header class="level-editor-topbar">
                    <div class="level-editor-brand">
                        <span class="level-editor-kicker">NEXUS-AI</span>
                        <h2>Level Editor</h2>
                    </div>
                    <div class="level-editor-actions" role="toolbar" aria-label="Level editor actions">
                        <button class="editor-button" id="editor-new-blank" type="button">Blank 20x10</button>
                        <button class="editor-button" id="editor-fit" type="button">Fit</button>
                        <button class="editor-button" id="editor-save-level" type="button">Save Level</button>
                        <button class="editor-button" id="editor-test-level" type="button">Test Campaign</button>
                        <button class="editor-button editor-button--ghost" id="editor-back" type="button">Back</button>
                    </div>
                </header>

                <div class="level-editor-workbench">
                    <aside class="level-editor-sidebar" aria-label="Editor palette">
                        <div class="editor-tool-group" role="toolbar" aria-label="Editor tools">
                            <button class="editor-tool is-active" data-tool="paint" type="button" title="Paint">Paint</button>
                            <button class="editor-tool" data-tool="select" type="button" title="Select">Select</button>
                            <button class="editor-tool" data-tool="erase" type="button" title="Erase">Erase</button>
                            <button class="editor-tool" data-tool="pan" type="button" title="Pan">Pan</button>
                        </div>

                        <section class="palette-section">
                            <h3>Geometry</h3>
                            <button class="palette-item" data-brush="tile-void" type="button">
                                <span class="tile-swatch tile-swatch--void"></span>
                                <span>Void</span>
                            </button>
                            <button class="palette-item is-active" data-brush="tile-floor" type="button">
                                <span class="tile-swatch tile-swatch--floor"></span>
                                <span>Floor</span>
                            </button>
                            <button class="palette-item" data-brush="tile-wall" type="button">
                                <span class="tile-swatch tile-swatch--wall"></span>
                                <span>Wall</span>
                            </button>
                            <button class="palette-item" data-brush="tile-hazard" type="button">
                                <span class="tile-swatch tile-swatch--hazard"></span>
                                <span>Hazard</span>
                            </button>
                        </section>

                        <section class="palette-section">
                            <h3>Grid Size</h3>
                            <div class="editor-field-grid">
                                <label class="editor-field">
                                    <span>Width</span>
                                    <input id="editor-grid-width" type="number" min="4" max="120" value="20">
                                </label>
                                <label class="editor-field">
                                    <span>Height</span>
                                    <input id="editor-grid-height" type="number" min="4" max="120" value="10">
                                </label>
                            </div>
                            <button class="editor-button" id="editor-resize-grid" type="button">Resize Grid</button>
                        </section>

                        <section class="palette-section">
                            <h3>Entities</h3>
                            <button class="palette-item" data-brush="entity-player" type="button">
                                <span class="entity-swatch entity-swatch--player"></span>
                                <span>Player Spawn</span>
                            </button>
                            <button class="palette-item" data-brush="entity-terminal" type="button">
                                <span class="entity-swatch entity-swatch--terminal"></span>
                                <span>Terminal</span>
                            </button>
                            <button class="palette-item" data-brush="entity-portal" type="button">
                                <span class="entity-swatch entity-swatch--portal"></span>
                                <span>Portal</span>
                            </button>
                            <button class="palette-item" data-brush="entity-return-portal" type="button">
                                <span class="entity-swatch entity-swatch--return-portal"></span>
                                <span>Return Portal</span>
                            </button>
                            <button class="palette-item" data-brush="entity-bot" type="button">
                                <span class="entity-swatch entity-swatch--bot"></span>
                                <span>Bot Buddy</span>
                            </button>
                        </section>

                        <section class="palette-section">
                            <h3>Custom Assets</h3>
                            <button class="editor-button editor-upload-button" id="editor-upload-asset" type="button">Upload Custom Asset</button>
                            <input id="editor-asset-input" type="file" accept=".png,.svg,image/png,image/svg+xml" hidden>
                            <div class="custom-asset-list" id="custom-asset-list">
                                <span class="custom-asset-empty">No custom assets yet.</span>
                            </div>
                        </section>

                        <section class="palette-section campaign-pane" id="campaign-flow-pane">
                            <h3>Campaign Flow</h3>
                            <div class="campaign-actions">
                                <button class="editor-button" id="campaign-new-level" type="button">New Level</button>
                                <button class="editor-button" id="campaign-node-graph" type="button">Campaign Node Graph</button>
                            </div>
                            <label class="editor-field">
                                <span>Current Level ID</span>
                                <input id="campaign-level-id" type="text" value="${this.currentLevelId}">
                            </label>
                            <label class="editor-field">
                                <span>Level Name</span>
                                <input id="campaign-level-name" type="text" value="${this.currentLevelName}">
                            </label>
                            <div class="campaign-level-list" id="campaign-level-list">
                                <span class="custom-asset-empty">No saved custom levels yet.</span>
                            </div>
                            <h4 class="campaign-subheading">Connections</h4>
                            <div class="campaign-link-list" id="campaign-link-list"></div>
                        </section>
                    </aside>

                    <main class="level-editor-canvas-panel">
                        <canvas id="level-editor-canvas" tabindex="0" aria-label="Level editor canvas"></canvas>
                        <div class="level-editor-status" id="level-editor-status">
                            Tool: Paint | Brush: Floor | Zoom: 100% | Cell: -
                        </div>
                    </main>
                </div>
            </div>

            <div class="editor-modal-backdrop" id="new-level-modal" hidden>
                <form class="editor-modal editor-modal--compact" id="new-level-form">
                    <div class="editor-modal-header">
                        <div>
                            <span class="level-editor-kicker">Campaign</span>
                            <h3>New Level</h3>
                        </div>
                        <button class="editor-icon-button" id="new-level-close" type="button" aria-label="Close">x</button>
                    </div>

                    <label class="editor-field">
                        <span>Level Name</span>
                        <input id="new-level-name" type="text" required placeholder="The Data Vault">
                    </label>

                    <div class="editor-modal-actions">
                        <button class="editor-button editor-button--ghost" id="new-level-cancel" type="button">Cancel</button>
                        <button class="editor-button" type="submit">Create Level</button>
                    </div>
                </form>
            </div>

            <div class="editor-modal-backdrop campaign-graph-backdrop" id="campaign-graph-modal" hidden>
                <div class="campaign-graph-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-graph-title">
                    <div class="editor-modal-header">
                        <div>
                            <span class="level-editor-kicker">Campaign Flow</span>
                            <h3 id="campaign-graph-title">Campaign Node Graph</h3>
                        </div>
                        <button class="editor-icon-button" id="campaign-graph-close" type="button" aria-label="Close">x</button>
                    </div>

                    <div class="campaign-graph-toolbar">
                        <span id="campaign-graph-status">Drag from a portal output to a level input.</span>
                        <button class="editor-button editor-button--mini" id="campaign-graph-auto-layout" type="button">Auto Layout</button>
                    </div>

                    <div class="campaign-graph-stage" id="campaign-graph-stage">
                        <svg class="campaign-graph-svg" id="campaign-graph-svg" aria-hidden="true"></svg>
                        <div class="campaign-graph-nodes" id="campaign-graph-nodes"></div>
                    </div>
                </div>
            </div>

            <div class="editor-modal-backdrop" id="terminal-config-modal" hidden>
                <form class="editor-modal" id="terminal-config-form">
                    <div class="editor-modal-header">
                        <div>
                            <span class="level-editor-kicker">Terminal</span>
                            <h3>Configure Challenge</h3>
                        </div>
                        <button class="editor-icon-button" id="terminal-config-close" type="button" aria-label="Close">x</button>
                    </div>

                    <label class="editor-field">
                        <span>Challenge ID</span>
                        <input id="terminal-challenge-id" name="challengeId" type="text" required placeholder="custom_reactor_balance">
                    </label>

                    <label class="editor-field">
                        <span>Dialogue Intro</span>
                        <textarea id="terminal-dialogue-intro" name="dialogueIntro" rows="3" placeholder="Bot Buddy's setup for this terminal"></textarea>
                    </label>

                    <label class="editor-field">
                        <span>Dialogue Hint</span>
                        <textarea id="terminal-dialogue-hint" name="dialogueHint" rows="3" placeholder="A Socratic hint after a failed attempt"></textarea>
                    </label>

                    <label class="editor-field">
                        <span>Validation Type</span>
                        <select id="terminal-validation-type" name="validationType">
                            <option value="variableValue">Variable Value</option>
                            <option value="dataFrameShape">DataFrame Shape</option>
                            <option value="booleanState">Boolean State</option>
                        </select>
                    </label>

                    <div class="validation-fields" id="terminal-validation-fields"></div>

                    <div class="validation-preview" id="terminal-validation-preview"></div>

                    <div class="editor-modal-actions">
                        <button class="editor-button editor-button--ghost" id="terminal-config-cancel" type="button">Cancel</button>
                        <button class="editor-button" type="submit">Save Terminal</button>
                    </div>
                </form>
            </div>

            <div class="editor-modal-backdrop" id="portal-config-modal" hidden>
                <form class="editor-modal" id="portal-config-form">
                    <div class="editor-modal-header">
                        <div>
                            <span class="level-editor-kicker">Portal</span>
                            <h3>Configure Lock</h3>
                        </div>
                        <button class="editor-icon-button" id="portal-config-close" type="button" aria-label="Close">x</button>
                    </div>

                    <label class="editor-field">
                        <span>Target Level ID</span>
                        <select id="portal-target-map-id" required></select>
                    </label>

                    <div class="editor-field">
                        <span>Required Terminals</span>
                        <div class="terminal-checklist" id="portal-required-terminals"></div>
                    </div>

                    <div class="editor-modal-actions">
                        <button class="editor-button editor-button--ghost" id="portal-config-cancel" type="button">Cancel</button>
                        <button class="editor-button" type="submit">Save Portal</button>
                    </div>
                </form>
            </div>

            <div class="editor-modal-backdrop" id="bot-config-modal" hidden>
                <form class="editor-modal" id="bot-config-form">
                    <div class="editor-modal-header">
                        <div>
                            <span class="level-editor-kicker">Bot Buddy</span>
                            <h3>Configure Companion</h3>
                        </div>
                        <button class="editor-icon-button" id="bot-config-close" type="button" aria-label="Close">x</button>
                    </div>

                    <label class="editor-field">
                        <span>Level Greeting</span>
                        <textarea id="bot-level-greeting" rows="3" placeholder="Opening line when the player spawns"></textarea>
                    </label>

                    <label class="editor-field">
                        <span>Initial Emotional State</span>
                        <select id="bot-initial-emotion">
                            <option value="happy">Cyan / Happy</option>
                            <option value="thinking">Purple / Thinking</option>
                            <option value="error">Red / Error</option>
                        </select>
                    </label>

                    <label class="editor-field">
                        <span>Behavior</span>
                        <select id="bot-behavior">
                            <option value="follow">Follow Player</option>
                            <option value="anchor">Anchor to Spawn</option>
                        </select>
                    </label>

                    <div class="editor-modal-actions">
                        <button class="editor-button editor-button--ghost" id="bot-config-cancel" type="button">Cancel</button>
                        <button class="editor-button" type="submit">Save Bot Buddy</button>
                    </div>
                </form>
            </div>
        `;
    }

    async _initEditor() {
        const canvas = this.el.querySelector('#level-editor-canvas');
        this.status = this.el.querySelector('#level-editor-status');

        this.editor = new LevelEditorCanvas(canvas, {
            onStatus: (status) => this._renderStatus(status),
            onTerminalConfigure: (terminal) => this._openTerminalModal(terminal),
            onPortalConfigure: (portal) => this._openPortalModal(portal),
            onBotConfigure: (bot) => this._openBotModal(bot),
        });
        this.editor.mount();

        try {
            const campaign = this._readCampaign();
            const savedLevel = campaign.levels.find((level) => level.levelId === campaign.entryLevelId)
                || campaign.levels[0];

            if (savedLevel) {
                this.currentLevelId = savedLevel.levelId;
                this.currentLevelName = savedLevel.levelName || savedLevel.levelId;
                this.loadedLevelId = savedLevel.levelId;
                this.editor.loadMap(savedLevel.mapData);
            } else {
                const response = await fetch('data/maps.json');
                if (!response.ok) throw new Error('maps.json failed to load');
                const data = await response.json();
                this.editor.loadMap(data.maps?.[0]);
            }
        } catch (error) {
            console.warn('[LevelEditor] Falling back to a blank map:', error);
            this.editor.createBlank(20, 10);
        }

        this._syncCustomAssetPaletteFromEditor();
        this._syncCampaignFields();
        this._syncGridSizeFields();
        this._renderCampaignPane();
    }

    _bindEvents() {
        this.el.querySelector('#editor-back')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this.eventBus.emit(Events.SCREEN_CHANGE, { screen: 'mainMenu' });
        });

        this.el.querySelector('#editor-fit')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this.editor?.fitToView();
        });

        this.el.querySelector('#editor-new-blank')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this.editor?.createBlank(20, 10);
            this._syncCustomAssetPaletteFromEditor();
            this._syncGridSizeFields();
            this._renderCampaignPane();
        });

        this.el.querySelector('#editor-resize-grid')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this._resizeEditorGridFromInputs();
        });

        this.el.querySelector('#editor-save-level')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this._saveCurrentProject();
        });

        this.el.querySelector('#editor-test-level')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this._saveCurrentProject();
            this.eventBus.emit(Events.SCREEN_CHANGE, {
                screen: 'game',
                data: {
                    contentSource: 'custom',
                    isTestMode: true,
                    resetProgress: true,
                    startLevelId: this.currentLevelId,
                }
            });
        });

        this.el.querySelector('#campaign-level-id')?.addEventListener('input', (event) => {
            this.currentLevelId = this._slugify(event.target.value || 'custom_level_1');
        });

        this.el.querySelector('#campaign-level-name')?.addEventListener('input', (event) => {
            this.currentLevelName = event.target.value || this.currentLevelId;
        });

        this.el.querySelector('#campaign-new-level')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this._newCampaignLevel();
        });

        this.el.querySelector('#campaign-node-graph')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this._openCampaignGraph();
        });

        this.el.querySelector('#campaign-level-list')?.addEventListener('click', (event) => {
            const loadButton = event.target.closest('[data-load-level]');
            if (loadButton) {
                event.stopPropagation();
                this.audio.playSFX('click');
                this._loadCampaignLevel(loadButton.dataset.loadLevel);
                return;
            }

            const deleteButton = event.target.closest('[data-delete-level]');
            if (deleteButton) {
                event.stopPropagation();
                this.audio.playSFX('click');
                this._deleteCampaignLevel(deleteButton.dataset.deleteLevel);
            }
        });

        this.el.querySelector('#new-level-close')?.addEventListener('click', () => this._closeNewLevelModal());
        this.el.querySelector('#new-level-cancel')?.addEventListener('click', () => this._closeNewLevelModal());
        this.el.querySelector('#new-level-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const levelName = this.el.querySelector('#new-level-name')?.value.trim();
            this._createCampaignLevel(levelName);
        });

        this.el.querySelector('#campaign-graph-close')?.addEventListener('click', () => this._closeCampaignGraph());
        this.el.querySelector('#campaign-graph-auto-layout')?.addEventListener('click', () => {
            this.audio.playSFX('click');
            this._autoLayoutCampaignGraph(true);
        });
        this.el.querySelector('#campaign-graph-stage')?.addEventListener('pointerdown', (event) => this._handleGraphPointerDown(event));
        const graphSvg = this.el.querySelector('#campaign-graph-svg');
        graphSvg?.addEventListener('dblclick', (event) => this._handleGraphWireDoubleClick(event));
        graphSvg?.addEventListener('pointerover', (event) => this._setGraphWireHover(event, true));
        graphSvg?.addEventListener('pointerout', (event) => this._setGraphWireHover(event, false));
        window.addEventListener('pointermove', this._boundGraphPointerMove);
        window.addEventListener('pointerup', this._boundGraphPointerUp);

        this.el.querySelector('.level-editor-sidebar')?.addEventListener('click', (event) => {
            const toolButton = event.target.closest('[data-tool]');
            if (toolButton) {
                this.audio.playSFX('click');
                this._setActiveTool(toolButton.dataset.tool);
                return;
            }

            const brushButton = event.target.closest('[data-brush]');
            if (brushButton) {
                const brush = this.brushes[brushButton.dataset.brush];
                if (!brush) return;

                this.audio.playSFX('click');
                this._setActiveBrush(brushButton.dataset.brush, brush);
            }
        });

        this.el.querySelector('#editor-upload-asset')?.addEventListener('click', () => {
            this.el.querySelector('#editor-asset-input')?.click();
        });

        this.el.querySelector('#editor-asset-input')?.addEventListener('change', (event) => {
            this._handleAssetUpload(event);
        });

        this.el.querySelector('#terminal-config-close')?.addEventListener('click', () => this._closeTerminalModal());
        this.el.querySelector('#terminal-config-cancel')?.addEventListener('click', () => this._closeTerminalModal());
        this.el.querySelector('#terminal-validation-type')?.addEventListener('change', () => {
            this._renderValidationFields({ type: this.el.querySelector('#terminal-validation-type').value });
            this._updateValidationPreview();
        });
        this.el.querySelector('#terminal-validation-fields')?.addEventListener('input', () => this._updateValidationPreview());
        this.el.querySelector('#terminal-validation-fields')?.addEventListener('change', () => this._updateValidationPreview());
        this.el.querySelector('#terminal-config-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this._saveTerminalConfig();
        });

        this.el.querySelector('#portal-config-close')?.addEventListener('click', () => this._closePortalModal());
        this.el.querySelector('#portal-config-cancel')?.addEventListener('click', () => this._closePortalModal());
        this.el.querySelector('#portal-config-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this._savePortalConfig();
        });

        this.el.querySelector('#bot-config-close')?.addEventListener('click', () => this._closeBotModal());
        this.el.querySelector('#bot-config-cancel')?.addEventListener('click', () => this._closeBotModal());
        this.el.querySelector('#bot-config-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this._saveBotConfig();
        });
    }

    _setActiveTool(tool) {
        this.el.querySelectorAll('[data-tool]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.tool === tool);
            button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
        });

        this.editor?.setTool(tool);
    }

    _setActiveBrush(key, brush) {
        this.el.querySelectorAll('[data-brush]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.brush === key);
            button.setAttribute('aria-pressed', String(button.dataset.brush === key));
        });

        this.activeBrushKey = key;
        this._setActiveTool('paint');
        this.editor?.setBrush(brush);
    }

    _renderStatus(status) {
        if (!this.status) return;

        const tool = this._capitalize(status.tool);
        const brush = status.brush?.label || '-';
        const zoom = `${Math.round((status.zoom || 1) * 100)}%`;
        const cell = status.hoverCell ? `${status.hoverCell.x}, ${status.hoverCell.y}` : '-';
        const selected = status.selectedEntity
            ? ` | Selected: ${this._describeEntity(status.selectedEntity)}`
            : '';
        this.status.textContent = `Tool: ${tool} | Brush: ${brush} | Zoom: ${zoom} | Cell: ${cell}${selected}`;
    }

    async _handleAssetUpload(event) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = '';

        if (!file) return;

        const isSupported = file.type === 'image/png'
            || file.type === 'image/svg+xml'
            || /\.png$/i.test(file.name)
            || /\.svg$/i.test(file.name);

        if (!isSupported) {
            alert('Please upload a .png or .svg asset.');
            return;
        }

        const src = await this._readFileAsDataUrl(file);
        const brush = this.editor.addCustomAsset({
            name: file.name.replace(/\.(png|svg)$/i, ''),
            src,
            mimeType: file.type || (file.name.endsWith('.svg') ? 'image/svg+xml' : 'image/png'),
        });

        const asset = this.editor.customAssets.find((item) => item.tileId === brush.tileId);
        const key = `custom-${brush.tileId}`;
        this.brushes[key] = brush;
        this._appendCustomAssetPaletteItem(key, brush, asset);
        this._setActiveBrush(key, brush);
    }

    _appendCustomAssetPaletteItem(key, brush, asset) {
        const list = this.el.querySelector('#custom-asset-list');
        if (!list || !asset) return;

        list.querySelector('.custom-asset-empty')?.remove();
        const button = document.createElement('button');
        button.className = 'palette-item palette-item--custom';
        button.type = 'button';
        button.dataset.brush = key;
        button.innerHTML = `
            <span class="custom-asset-thumb" style="background-image:url('${asset.src}')"></span>
            <span>${this._escapeHtml(brush.label)}</span>
        `;
        list.appendChild(button);
    }

    _syncCustomAssetPaletteFromEditor() {
        Object.keys(this.brushes)
            .filter((key) => key.startsWith('custom-'))
            .forEach((key) => delete this.brushes[key]);

        const list = this.el.querySelector('#custom-asset-list');
        if (!list) return;

        list.innerHTML = '<span class="custom-asset-empty">No custom assets yet.</span>';

        (this.editor?.customAssets || []).forEach((asset) => {
            const key = `custom-${asset.tileId}`;
            const brush = {
                kind: 'tile',
                tileId: asset.tileId,
                label: asset.name || `Custom ${asset.tileId}`,
                customAssetId: asset.id,
            };
            this.brushes[key] = brush;
            this._appendCustomAssetPaletteItem(key, brush, asset);
        });

        if (!this.brushes[this.activeBrushKey]) {
            this._setActiveBrush('tile-floor', this.brushes['tile-floor']);
        }
    }

    _readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    _openTerminalModal(terminal) {
        this.activeTerminal = terminal;
        const modal = this.el.querySelector('#terminal-config-modal');
        const config = terminal.terminalConfig || this._makeDefaultTerminalConfig(terminal.challengeId);

        this.el.querySelector('#terminal-challenge-id').value = config.challengeId || terminal.challengeId || '';
        this.el.querySelector('#terminal-dialogue-intro').value = config.dialogueIntro || '';
        this.el.querySelector('#terminal-dialogue-hint').value = config.dialogueHint || '';
        this.el.querySelector('#terminal-validation-type').value = config.validation?.type || 'variableValue';

        this._renderValidationFields(config.validation || { type: 'variableValue' });
        this._updateValidationPreview();
        modal.hidden = false;
    }

    _closeTerminalModal() {
        this.el.querySelector('#terminal-config-modal').hidden = true;
        this.activeTerminal = null;
    }

    _renderValidationFields(validation) {
        const container = this.el.querySelector('#terminal-validation-fields');
        const type = validation.type || 'variableValue';

        if (type === 'dataFrameShape') {
            container.innerHTML = `
                <label class="editor-field">
                    <span>DataFrame Name</span>
                    <input id="validation-dataframe-name" type="text" value="${this._escapeAttr(validation.dataFrameName || 'df')}">
                </label>
                <div class="editor-field-grid">
                    <label class="editor-field">
                        <span>Expected Rows</span>
                        <input id="validation-expected-rows" type="number" min="0" value="${this._escapeAttr(validation.expectedRows ?? 50)}">
                    </label>
                    <label class="editor-field">
                        <span>Expected Columns</span>
                        <input id="validation-expected-columns" type="number" min="0" value="${this._escapeAttr(validation.expectedColumns ?? 4)}">
                    </label>
                </div>
            `;
            return;
        }

        if (type === 'booleanState') {
            const expected = validation.expectedState === false ? 'false' : 'true';
            container.innerHTML = `
                <label class="editor-field">
                    <span>Flag Name</span>
                    <input id="validation-flag-name" type="text" value="${this._escapeAttr(validation.flagName || 'is_ready')}">
                </label>
                <label class="editor-field">
                    <span>Expected State</span>
                    <select id="validation-expected-state">
                        <option value="true" ${expected === 'true' ? 'selected' : ''}>True</option>
                        <option value="false" ${expected === 'false' ? 'selected' : ''}>False</option>
                    </select>
                </label>
            `;
            return;
        }

        container.innerHTML = `
            <label class="editor-field">
                <span>Variable Name</span>
                <input id="validation-variable-name" type="text" value="${this._escapeAttr(validation.variableName || 'x')}">
            </label>
            <label class="editor-field">
                <span>Expected Value</span>
                <input id="validation-expected-value" type="text" value="${this._escapeAttr(validation.expectedValue ?? '10')}">
            </label>
        `;
    }

    _updateValidationPreview() {
        const preview = this.el.querySelector('#terminal-validation-preview');
        if (!preview) return;

        const validation = this._buildValidationFromModal();
        preview.textContent = validation.expression;
    }

    _saveTerminalConfig() {
        if (!this.activeTerminal) return;

        const challengeId = this.el.querySelector('#terminal-challenge-id').value.trim();
        if (!challengeId) {
            alert('Challenge ID is required.');
            return;
        }

        const config = {
            challengeId,
            dialogueIntro: this.el.querySelector('#terminal-dialogue-intro').value.trim(),
            dialogueHint: this.el.querySelector('#terminal-dialogue-hint').value.trim(),
            validation: this._buildValidationFromModal(),
        };

        this.editor.updateTerminalConfig(this.activeTerminal.id, config);
        this.audio.playSFX('success');
        this._closeTerminalModal();
        this._renderCampaignPane();
    }

    _openPortalModal(portal) {
        this.activePortal = portal;
        const modal = this.el.querySelector('#portal-config-modal');
        const isReturnPortal = (portal.portalKind || portal.portalConfig?.portalKind) === 'return';
        const config = portal.portalConfig || {
            targetMapId: portal.targetMapId || portal.targetLevelId || 'custom_next',
            portalKind: portal.portalKind || 'forward',
            requiredTerminals: portal.requiredTerminals || [],
        };

        const kicker = modal?.querySelector('.level-editor-kicker');
        const title = modal?.querySelector('h3');
        const saveButton = modal?.querySelector('button[type="submit"]');
        if (kicker) kicker.textContent = isReturnPortal ? 'Return Portal' : 'Portal';
        if (title) title.textContent = isReturnPortal ? 'Configure Return Link' : 'Configure Lock';
        if (saveButton) saveButton.textContent = isReturnPortal ? 'Save Return Portal' : 'Save Portal';
        this._renderPortalTargetOptions(config.targetMapId || config.targetLevelId || portal.targetMapId || portal.targetLevelId || '');
        this._renderPortalTerminalChecklist(config.requiredTerminals || []);
        modal.hidden = false;
    }

    _closePortalModal() {
        this.el.querySelector('#portal-config-modal').hidden = true;
        this.activePortal = null;
    }

    _renderPortalTargetOptions(selectedId = '') {
        const select = this.el.querySelector('#portal-target-map-id');
        if (!select) return;

        const campaign = this._readCampaign();
        const options = campaign.levels.map((level) => ({
            id: level.levelId,
            name: level.levelName || level.levelId,
        }));

        if (!options.some((option) => option.id === this.currentLevelId)) {
            options.push({
                id: this.currentLevelId,
                name: this.currentLevelName || this.currentLevelId,
            });
        }

        const selected = options.some((option) => option.id === selectedId)
            ? selectedId
            : options.find((option) => option.id !== this.currentLevelId)?.id
                || options[0]?.id
                || this.currentLevelId;

        select.innerHTML = options.map((option) => `
            <option value="${this._escapeAttr(option.id)}" ${option.id === selected ? 'selected' : ''}>
                ${this._escapeHtml(option.name)} (${this._escapeHtml(option.id)})
            </option>
        `).join('');
        select.value = selected;
    }

    _renderPortalTerminalChecklist(selectedIds = []) {
        const container = this.el.querySelector('#portal-required-terminals');
        const terminalIds = this.editor?.getTerminalChallengeIds?.() || [];

        if (!terminalIds.length) {
            container.innerHTML = '<span class="custom-asset-empty">No terminals placed yet.</span>';
            return;
        }

        container.innerHTML = terminalIds.map((challengeId) => `
            <label class="terminal-check">
                <input type="checkbox" value="${this._escapeAttr(challengeId)}" ${selectedIds.includes(challengeId) ? 'checked' : ''}>
                <span>${this._escapeHtml(challengeId)}</span>
            </label>
        `).join('');
    }

    _savePortalConfig() {
        if (!this.activePortal) return;

        const targetMapId = this._slugify(this.el.querySelector('#portal-target-map-id').value || this.currentLevelId);
        const requiredTerminals = Array.from(this.el.querySelectorAll('#portal-required-terminals input:checked'))
            .map((input) => input.value);

        this.editor.updatePortalConfig(this.activePortal.id, {
            targetMapId,
            targetLevelId: targetMapId,
            requiredTerminals,
            portalKind: this.activePortal.portalKind || this.activePortal.portalConfig?.portalKind || 'forward',
            color: this.activePortal.color || (this.activePortal.portalKind === 'return' ? '#a855f7' : '#00e5ff'),
        });
        this.audio.playSFX('success');
        this._closePortalModal();
        this._renderCampaignPane();
    }

    _openBotModal(bot) {
        this.activeBot = bot;
        const modal = this.el.querySelector('#bot-config-modal');
        const config = bot.botConfig || {
            greeting: 'Hello, Engineer. Custom level systems are online.',
            emotion: 'happy',
            behavior: 'follow',
        };

        this.el.querySelector('#bot-level-greeting').value = config.greeting || '';
        this.el.querySelector('#bot-initial-emotion').value = config.emotion || 'happy';
        this.el.querySelector('#bot-behavior').value = config.behavior || 'follow';
        modal.hidden = false;
    }

    _closeBotModal() {
        this.el.querySelector('#bot-config-modal').hidden = true;
        this.activeBot = null;
    }

    _saveBotConfig() {
        if (!this.activeBot) return;

        this.editor.updateBotConfig(this.activeBot.id, {
            greeting: this.el.querySelector('#bot-level-greeting').value.trim(),
            emotion: this.el.querySelector('#bot-initial-emotion').value,
            behavior: this.el.querySelector('#bot-behavior').value,
        });
        this.audio.playSFX('success');
        this._closeBotModal();
    }

    _saveCurrentProject(options = {}) {
        this._syncLevelMetaFromInputs();

        const levelEntry = this._buildCurrentLevelEntry();
        const campaign = this._readCampaign();
        const replaceIds = new Set([levelEntry.levelId, this.loadedLevelId].filter(Boolean));
        const levels = [
            ...campaign.levels.filter((level) => !replaceIds.has(level.levelId)),
            levelEntry,
        ];
        const nextCampaign = {
            ...campaign,
            version: 2,
            entryLevelId: campaign.entryLevelId && levels.some((level) => level.levelId === campaign.entryLevelId)
                ? campaign.entryLevelId
                : levelEntry.levelId,
            updatedAt: Date.now(),
            levels,
        };

        const { maps, challenges } = this._writeCampaign(nextCampaign);
        this.loadedLevelId = levelEntry.levelId;

        if (!options.skipRender) {
            this._renderCampaignPane(nextCampaign);
        }
        return { maps, challenges, campaign: nextCampaign };
    }

    _buildCurrentLevelEntry() {
        const mapData = this._buildMapExport();
        return {
            levelId: mapData.id,
            levelName: mapData.name || mapData.id,
            mapData,
            curriculumData: {
                challenges: this._buildCurriculumExport(mapData),
                botBuddy: mapData.botBuddy,
            },
        };
    }

    _buildMapExport() {
        const snapshot = this.editor.getSnapshot();
        const botEntity = snapshot.entities.find((entity) => entity.type === 'bot');
        const exportedEntities = snapshot.entities.map((entity) => {
            const base = {
                type: entity.type,
                x: entity.x * TILE_SIZE,
                y: entity.y * TILE_SIZE,
            };

            if (entity.type === 'terminal') {
                return {
                    ...base,
                    challengeId: entity.challengeId,
                    terminalConfig: entity.terminalConfig,
                };
            }

            if (entity.type === 'portal') {
                const portalKind = entity.portalKind || entity.portalConfig?.portalKind || (entity.color === '#a855f7' ? 'return' : 'forward');
                const color = entity.color || (portalKind === 'return' ? '#a855f7' : '#00e5ff');
                const targetLevelId = entity.targetMapId || entity.targetLevelId || entity.portalConfig?.targetMapId || entity.portalConfig?.targetLevelId || '';
                const graphRoute = entity.graphRoute || entity.portalConfig?.graphRoute || null;
                return {
                    ...base,
                    portalKind,
                    targetMapId: targetLevelId,
                    targetLevelId,
                    graphRoute,
                    color,
                    requiredTerminals: entity.requiredTerminals || [],
                    portalConfig: {
                        ...(entity.portalConfig || {}),
                        targetMapId: targetLevelId,
                        targetLevelId,
                        graphRoute,
                        portalKind,
                        requiredTerminals: entity.requiredTerminals || [],
                    },
                };
            }

            if (entity.type === 'bot') {
                return {
                    ...base,
                    botConfig: entity.botConfig,
                };
            }

            return base;
        });

        return {
            id: this.currentLevelId,
            name: this.currentLevelName,
            width: snapshot.width,
            height: snapshot.height,
            playerStart: {
                x: snapshot.playerStart.x * TILE_SIZE,
                y: snapshot.playerStart.y * TILE_SIZE,
            },
            grid: snapshot.grid,
            entities: exportedEntities,
            customAssets: snapshot.customAssets,
            botBuddy: botEntity ? {
                x: botEntity.x * TILE_SIZE,
                y: botEntity.y * TILE_SIZE,
                ...(botEntity.botConfig || {}),
            } : {
                greeting: 'Hello, Engineer. Custom level systems are online.',
                emotion: 'happy',
                behavior: 'follow',
            },
        };
    }

    _buildCurriculumExport(mapData) {
        return mapData.entities
            .filter((entity) => entity.type === 'terminal')
            .map((entity) => {
                const config = entity.terminalConfig || this._makeDefaultTerminalConfig(entity.challengeId);
                return {
                    id: config.challengeId || entity.challengeId,
                    title: config.challengeId || entity.challengeId,
                    type: 'custom',
                    dialogueIntro: [
                        {
                            name: 'Bot Buddy',
                            text: config.dialogueIntro || 'This custom terminal needs a Python state repair.',
                            portrait: 'BOT',
                        }
                    ],
                    defaultCode: '# Write Python code that creates the expected state for this terminal.\n',
                    validation: {
                        ...this._validationToEngineSchema(config.validation),
                        expression: config.validation?.expression,
                        editorRule: config.validation,
                    },
                    hints: {
                        default: config.dialogueHint || 'Check the expected state and work backwards from the variables you need.',
                    },
                    visualFeedback: { success: 'terminal_green', failure: 'terminal_spark' },
                };
            });
    }

    _validationToEngineSchema(validation = {}) {
        if (validation.type === 'dataFrameShape') {
            return {
                state: {
                    [`${validation.dataFrameName || 'df'}_shape`]: `${Number(validation.expectedRows || 0)},${Number(validation.expectedColumns || 0)}`,
                }
            };
        }

        if (validation.type === 'booleanState') {
            return {
                state: {
                    [validation.flagName || 'is_ready']: Boolean(validation.expectedState),
                }
            };
        }

        return {
            state: {
                [validation.variableName || 'x']: this._parseExpectedValue(validation.expectedValue),
            }
        };
    }

    _newCampaignLevel() {
        const campaign = this._readCampaign();
        const defaultName = `Custom Level ${campaign.levels.length + 1}`;
        const input = this.el.querySelector('#new-level-name');
        if (input) input.value = defaultName;
        const modal = this.el.querySelector('#new-level-modal');
        if (modal) modal.hidden = false;
        setTimeout(() => {
            input?.focus();
            input?.select();
        }, 0);
    }

    _closeNewLevelModal() {
        const modal = this.el.querySelector('#new-level-modal');
        if (modal) modal.hidden = true;
    }

    _createCampaignLevel(levelNameInput) {
        const campaignBeforeCreate = this._readCampaign();
        const defaultName = `Custom Level ${campaignBeforeCreate.levels.length + 1}`;
        const levelName = String(levelNameInput || '').trim() || defaultName;

        this._saveCurrentProject({ skipRender: true });

        const campaign = this._readCampaign();
        const levelId = this._generateUniqueLevelId(levelName, campaign);
        this.currentLevelId = levelId;
        this.currentLevelName = levelName;
        this.loadedLevelId = levelId;
        this.editor?.createBlank(20, 10, { clearAssets: true });
        this._syncCustomAssetPaletteFromEditor();
        this._syncCampaignFields();
        this._syncGridSizeFields();
        this._setActiveBrush('tile-floor', this.brushes['tile-floor']);
        this._renderCampaignPane(campaign);
        this._closeNewLevelModal();
    }

    _loadCampaignLevel(levelId, options = {}) {
        const { saveCurrent = true } = options;
        const targetLevelId = this._slugify(levelId);

        if (saveCurrent && targetLevelId !== this.currentLevelId) {
            this._saveCurrentProject({ skipRender: true });
        }

        const campaign = this._readCampaign();
        const level = campaign.levels.find((item) => item.levelId === targetLevelId);
        if (!level) {
            alert(`Level ${targetLevelId} was not found in this campaign.`);
            return;
        }

        this.currentLevelId = level.levelId;
        this.currentLevelName = level.levelName || level.levelId;
        this.loadedLevelId = level.levelId;
        this.editor?.loadMap(level.mapData);
        this._syncCustomAssetPaletteFromEditor();
        this._syncCampaignFields();
        this._syncGridSizeFields();
        this._renderCampaignPane(campaign);
    }

    _deleteCampaignLevel(levelId) {
        const targetLevelId = this._slugify(levelId);
        const campaign = this._readCampaign();
        const remainingLevels = campaign.levels.filter((level) => level.levelId !== targetLevelId);
        if (remainingLevels.length === campaign.levels.length) return;

        const nextCampaign = {
            ...campaign,
            entryLevelId: campaign.entryLevelId === targetLevelId
                ? (remainingLevels[0]?.levelId || this.currentLevelId)
                : campaign.entryLevelId,
            updatedAt: Date.now(),
            levels: remainingLevels,
        };
        this._writeCampaign(nextCampaign);

        if (targetLevelId === this.currentLevelId) {
            const nextLevel = remainingLevels[0];
            if (nextLevel) {
                this._loadCampaignLevel(nextLevel.levelId, { saveCurrent: false });
            } else {
                this.currentLevelId = this._generateUniqueLevelId('Custom Level 1', nextCampaign);
                this.currentLevelName = 'Custom Level 1';
                this.loadedLevelId = this.currentLevelId;
                this.editor?.createBlank(20, 10, { clearAssets: true });
                this._syncCustomAssetPaletteFromEditor();
                this._syncCampaignFields();
                this._syncGridSizeFields();
                const emptyCampaign = {
                    ...nextCampaign,
                    entryLevelId: this.currentLevelId,
                    levels: [],
                };
                this._writeCampaign(emptyCampaign);
                this._renderCampaignPane(emptyCampaign);
            }
            return;
        }

        this._renderCampaignPane(nextCampaign);
    }

    _openCampaignGraph() {
        const saved = this._saveCurrentProject({ skipRender: true });
        const campaign = this._readCampaign();
        this.graphPositions = { ...(campaign.graphPositions || {}) };
        const modal = this.el.querySelector('#campaign-graph-modal');
        if (modal) modal.hidden = false;
        this._renderCampaignGraph(campaign.levels.length ? campaign : saved.campaign);
    }

    _closeCampaignGraph() {
        const modal = this.el.querySelector('#campaign-graph-modal');
        if (modal) modal.hidden = true;
        this.graphDrag = null;
        this.graphWire = null;
        this._renderCampaignPane();
    }

    _renderCampaignGraph(campaign = this._readCampaign()) {
        const nodesContainer = this.el.querySelector('#campaign-graph-nodes');
        const status = this.el.querySelector('#campaign-graph-status');
        if (!nodesContainer) return;

        const levels = campaign.levels || [];
        this.graphPositions = {
            ...(campaign.graphPositions || {}),
            ...this.graphPositions,
        };
        this._ensureGraphPositions(levels);

        if (!levels.length) {
            nodesContainer.innerHTML = '<div class="campaign-graph-empty">Save at least one level to begin wiring campaign flow.</div>';
            this._renderCampaignGraphLines(campaign);
            if (status) status.textContent = 'No saved levels available.';
            return;
        }

        nodesContainer.innerHTML = levels.map((level) => this._buildGraphNodeHTML(level, levels)).join('');
        if (status) status.textContent = 'Drag from a portal output to a level input. Double-click a wire to remove it.';
        this._renderCampaignGraphLines(campaign);
        requestAnimationFrame(() => this._renderCampaignGraphLines(campaign));
    }

    _buildGraphNodeHTML(level, levels) {
        const position = this.graphPositions[level.levelId] || { x: 80, y: 80 };
        const portals = this._getLevelPortals(level);
        const terminalCount = (level.mapData?.entities || []).filter((entity) => entity.type === 'terminal').length;

        return `
            <article class="campaign-graph-node ${level.levelId === this.currentLevelId ? 'is-current' : ''}"
                data-graph-node="${this._escapeAttr(level.levelId)}"
                style="transform:translate(${Math.round(position.x)}px, ${Math.round(position.y)}px)">
                <header class="campaign-graph-node-header" data-graph-drag-handle>
                    <span>${this._escapeHtml(level.levelName || level.levelId)}</span>
                    <code>${this._escapeHtml(level.levelId)}</code>
                </header>
                <button class="campaign-graph-input" data-graph-input="${this._escapeAttr(level.levelId)}" data-default-target-side="left" type="button" title="Level input">
                    <span class="campaign-graph-port campaign-graph-port--input campaign-graph-port--left"
                        data-graph-input-port
                        data-level-id="${this._escapeAttr(level.levelId)}"
                        data-port-side="left"
                        aria-hidden="true"></span>
                    <span class="campaign-graph-port campaign-graph-port--input campaign-graph-port--right"
                        data-graph-input-port
                        data-level-id="${this._escapeAttr(level.levelId)}"
                        data-port-side="right"
                        aria-hidden="true"></span>
                    <span>Input</span>
                </button>
                <div class="campaign-graph-node-meta">
                    ${terminalCount} terminals | ${portals.length} portals
                </div>
                <div class="campaign-graph-ports">
                    ${portals.length ? portals.map((portal, index) => this._buildGraphOutputHTML(level, portal, index, levels)).join('') : '<span class="campaign-graph-no-ports">No portal outputs</span>'}
                </div>
            </article>
        `;
    }

    _buildGraphOutputHTML(level, portal, index, levels) {
        const label = portal.portalKind === 'return' ? 'Return Portal' : 'Portal';
        const targetName = this._getLevelDisplayName(portal.targetLevelId, levels);

        return `
            <button class="campaign-graph-output"
                data-graph-output
                data-level-id="${this._escapeAttr(level.levelId)}"
                data-portal-index="${portal.entityIndex}"
                data-target-level-id="${this._escapeAttr(portal.targetLevelId)}"
                data-portal-kind="${this._escapeAttr(portal.portalKind)}"
                data-source-side="${this._escapeAttr(portal.sourceSide)}"
                data-target-side="${this._escapeAttr(portal.targetSide)}"
                type="button"
                title="Drag to connect">
                <span class="campaign-graph-port campaign-graph-port--output campaign-graph-port--left"
                    data-graph-output-port
                    data-level-id="${this._escapeAttr(level.levelId)}"
                    data-portal-index="${portal.entityIndex}"
                    data-port-side="left"
                    aria-hidden="true"></span>
                <span class="campaign-graph-port campaign-graph-port--output campaign-graph-port--right"
                    data-graph-output-port
                    data-level-id="${this._escapeAttr(level.levelId)}"
                    data-portal-index="${portal.entityIndex}"
                    data-port-side="right"
                    aria-hidden="true"></span>
                <span>${this._escapeHtml(label)} ${index + 1}</span>
                <code>${this._escapeHtml(targetName)}</code>
            </button>
        `;
    }

    _getLevelPortals(level, levels = []) {
        return (level.mapData?.entities || [])
            .map((entity, entityIndex) => ({ entity, entityIndex }))
            .filter(({ entity }) => entity.type === 'portal')
            .map(({ entity, entityIndex }) => {
                const portalKind = entity.portalKind || entity.portalConfig?.portalKind || (entity.color === '#a855f7' ? 'return' : 'forward');
                const targetLevelId = entity.targetMapId || entity.targetLevelId || entity.portalConfig?.targetMapId || entity.portalConfig?.targetLevelId || '';
                const graphRoute = entity.graphRoute || entity.portalConfig?.graphRoute || {};
                const inferredRoute = this._inferGraphRoute(level.levelId, targetLevelId, portalKind, levels);
                return {
                    entityIndex,
                    portalKind,
                    targetLevelId,
                    sourceSide: graphRoute.sourceSide || inferredRoute.sourceSide,
                    targetSide: graphRoute.targetSide || inferredRoute.targetSide,
                    requiredTerminals: entity.requiredTerminals || entity.portalConfig?.requiredTerminals || [],
                };
            });
    }

    _inferGraphRoute(fromLevelId, targetLevelId, portalKind = 'forward', levels = []) {
        const from = this.graphPositions[fromLevelId];
        const target = this.graphPositions[targetLevelId];
        if (from && target) {
            const targetIsLeft = target.x < from.x;
            return targetIsLeft
                ? { sourceSide: 'left', targetSide: 'right' }
                : { sourceSide: 'right', targetSide: 'left' };
        }

        if (portalKind === 'return') return { sourceSide: 'left', targetSide: 'right' };
        return { sourceSide: 'right', targetSide: 'left' };
    }

    _ensureGraphPositions(levels) {
        levels.forEach((level, index) => {
            if (this.graphPositions[level.levelId]) return;
            this.graphPositions[level.levelId] = {
                x: 80 + (index % 3) * 300,
                y: 80 + Math.floor(index / 3) * 230,
            };
        });
    }

    _autoLayoutCampaignGraph(persist = false) {
        const campaign = this._readCampaign();
        this.graphPositions = {};
        this._ensureGraphPositions(campaign.levels || []);
        if (persist) this._persistGraphPositions();
        this._renderCampaignGraph({
            ...campaign,
            graphPositions: this.graphPositions,
        });
    }

    _handleGraphPointerDown(event) {
        const modal = this.el.querySelector('#campaign-graph-modal');
        if (!modal || modal.hidden) return;

        const outputPort = event.target.closest('[data-graph-output-port]');
        const output = outputPort?.closest('[data-graph-output]') || event.target.closest('[data-graph-output]');
        if (output) {
            event.preventDefault();
            const stagePoint = this._graphEventPoint(event);
            this.graphWire = {
                fromLevelId: output.dataset.levelId,
                entityIndex: Number(output.dataset.portalIndex),
                sourceSide: outputPort?.dataset.portSide || output.dataset.sourceSide || 'right',
                portalKind: output.dataset.portalKind || 'forward',
                pointer: stagePoint,
            };
            output.classList.add('is-wiring');
            this._renderCampaignGraphLines();
            return;
        }

        const handle = event.target.closest('[data-graph-drag-handle]');
        if (!handle) return;

        const node = handle.closest('[data-graph-node]');
        if (!node) return;

        const levelId = node.dataset.graphNode;
        const position = this.graphPositions[levelId] || { x: 0, y: 0 };
        this.graphDrag = {
            levelId,
            originX: position.x,
            originY: position.y,
            startX: event.clientX,
            startY: event.clientY,
        };
        node.classList.add('is-dragging');
        event.preventDefault();
    }

    _handleGraphPointerMove(event) {
        const modal = this.el?.querySelector('#campaign-graph-modal');
        if (!modal || modal.hidden) return;

        if (this.graphDrag) {
            const next = {
                x: Math.max(20, this.graphDrag.originX + event.clientX - this.graphDrag.startX),
                y: Math.max(20, this.graphDrag.originY + event.clientY - this.graphDrag.startY),
            };
            this.graphPositions[this.graphDrag.levelId] = next;
            const node = this.el.querySelector(`[data-graph-node="${CSS.escape(this.graphDrag.levelId)}"]`);
            if (node) node.style.transform = `translate(${Math.round(next.x)}px, ${Math.round(next.y)}px)`;
            this._renderCampaignGraphLines();
            return;
        }

        if (this.graphWire) {
            this.graphWire.pointer = this._graphEventPoint(event);
            this._renderCampaignGraphLines();
        }
    }

    _handleGraphPointerUp(event) {
        const modal = this.el?.querySelector('#campaign-graph-modal');
        if (!modal || modal.hidden) return;

        if (this.graphDrag) {
            const node = this.el.querySelector(`[data-graph-node="${CSS.escape(this.graphDrag.levelId)}"]`);
            node?.classList.remove('is-dragging');
            this._persistGraphPositions();
            this.graphDrag = null;
        }

        if (this.graphWire) {
            const target = document.elementFromPoint(event.clientX, event.clientY);
            const inputPort = target?.closest?.('[data-graph-input-port]');
            const input = inputPort?.closest?.('[data-graph-input]') || target?.closest?.('[data-graph-input]');
            const fromOutput = this.el.querySelector(`[data-graph-output][data-level-id="${CSS.escape(this.graphWire.fromLevelId)}"][data-portal-index="${this.graphWire.entityIndex}"]`);
            fromOutput?.classList.remove('is-wiring');

            if (input) {
                this._connectGraphWire(
                    this.graphWire.fromLevelId,
                    this.graphWire.entityIndex,
                    input.dataset.graphInput,
                    this.graphWire.sourceSide,
                    inputPort?.dataset.portSide || input.dataset.defaultTargetSide || 'left'
                );
            }

            this.graphWire = null;
            this._renderCampaignGraphLines();
        }
    }

    _handleGraphWireDoubleClick(event) {
        const hitbox = event.target.closest?.('[data-graph-wire-hitbox]');
        if (!hitbox) return;

        event.preventDefault();
        event.stopPropagation();
        this._disconnectGraphWire(hitbox.dataset.fromLevelId, Number(hitbox.dataset.portalIndex));
    }

    _setGraphWireHover(event, isHovered) {
        const hitbox = event.target.closest?.('[data-graph-wire-hitbox]');
        if (!hitbox) return;

        hitbox.closest('.campaign-graph-edge')?.classList.toggle('is-hovered', isHovered);
    }

    _connectGraphWire(fromLevelId, entityIndex, targetLevelId, sourceSide = 'right', targetSide = 'left') {
        if (!fromLevelId || !targetLevelId || Number.isNaN(entityIndex)) return;

        const campaign = this._readCampaign();
        campaign.graphPositions = { ...this.graphPositions };
        const level = campaign.levels.find((item) => item.levelId === fromLevelId);
        const portal = level?.mapData?.entities?.[entityIndex];
        if (!portal || portal.type !== 'portal') return;

        portal.targetMapId = targetLevelId;
        portal.targetLevelId = targetLevelId;
        portal.graphRoute = { sourceSide, targetSide };
        portal.portalConfig = {
            ...(portal.portalConfig || {}),
            targetMapId: targetLevelId,
            targetLevelId,
            graphRoute: { sourceSide, targetSide },
            portalKind: portal.portalKind || portal.portalConfig?.portalKind || (portal.color === '#a855f7' ? 'return' : 'forward'),
            requiredTerminals: portal.requiredTerminals || portal.portalConfig?.requiredTerminals || [],
        };

        const written = this._writeCampaign(campaign);
        this.audio.playSFX('success');
        this._renderCampaignGraph(written.campaign);
        this._renderCampaignPane(written.campaign);

        if (fromLevelId === this.currentLevelId) {
            this.editor?.loadMap(portal ? level.mapData : null);
            this._syncCustomAssetPaletteFromEditor();
            this._syncGridSizeFields();
        }
    }

    _disconnectGraphWire(fromLevelId, entityIndex) {
        if (!fromLevelId || Number.isNaN(entityIndex)) return;

        const campaign = this._readCampaign();
        campaign.graphPositions = { ...this.graphPositions };
        const level = campaign.levels.find((item) => item.levelId === fromLevelId);
        const portal = level?.mapData?.entities?.[entityIndex];
        if (!portal || portal.type !== 'portal') return;

        delete portal.targetMapId;
        delete portal.targetLevelId;
        delete portal.graphRoute;
        if (portal.portalConfig) {
            delete portal.portalConfig.targetMapId;
            delete portal.portalConfig.targetLevelId;
            delete portal.portalConfig.graphRoute;
        }

        const written = this._writeCampaign(campaign);
        this.audio.playSFX('click');
        this._renderCampaignGraph(written.campaign);
        this._renderCampaignPane(written.campaign);
        const status = this.el.querySelector('#campaign-graph-status');
        if (status) status.textContent = 'Connection removed. Drag from a portal output to reconnect it.';

        if (fromLevelId === this.currentLevelId) {
            this.editor?.loadMap(level.mapData);
            this._syncCustomAssetPaletteFromEditor();
            this._syncGridSizeFields();
        }
    }

    _persistGraphPositions() {
        const campaign = this._readCampaign();
        campaign.graphPositions = { ...this.graphPositions };
        this._writeCampaign(campaign);
    }

    _renderCampaignGraphLines(campaign = this._readCampaign()) {
        const stage = this.el.querySelector('#campaign-graph-stage');
        const svg = this.el.querySelector('#campaign-graph-svg');
        if (!stage || !svg) return;

        const rect = stage.getBoundingClientRect();
        const width = Math.max(stage.scrollWidth, rect.width);
        const height = Math.max(stage.scrollHeight, rect.height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        svg.innerHTML = '';

        (campaign.levels || []).forEach((level) => {
            this._getLevelPortals(level, campaign.levels || []).forEach((portal) => {
                if (!portal.targetLevelId) return;
                const output = this.el.querySelector(`[data-graph-output-port][data-level-id="${CSS.escape(level.levelId)}"][data-portal-index="${portal.entityIndex}"][data-port-side="${portal.sourceSide}"]`);
                const input = this.el.querySelector(`[data-graph-input-port][data-level-id="${CSS.escape(portal.targetLevelId)}"][data-port-side="${portal.targetSide}"]`);
                if (!output || !input) return;
                this._appendGraphPath(svg, this._graphPortPoint(output), this._graphPortPoint(input), {
                    kind: portal.portalKind,
                    fromLevelId: level.levelId,
                    entityIndex: portal.entityIndex,
                    targetLevelId: portal.targetLevelId,
                    sourceSide: portal.sourceSide,
                    targetSide: portal.targetSide,
                });
            });
        });

        if (this.graphWire) {
            const output = this.el.querySelector(`[data-graph-output-port][data-level-id="${CSS.escape(this.graphWire.fromLevelId)}"][data-portal-index="${this.graphWire.entityIndex}"][data-port-side="${this.graphWire.sourceSide || 'right'}"]`);
            if (output) this._appendGraphPath(svg, this._graphPortPoint(output), this.graphWire.pointer, {
                kind: 'draft',
                interactive: false,
                sourceSide: this.graphWire.sourceSide || 'right',
                targetSide: this.graphWire.sourceSide === 'left' ? 'right' : 'left',
            });
        }
    }

    _appendGraphPath(svg, from, to, options = {}) {
        const config = typeof options === 'string' ? { kind: options } : options;
        const kind = config.kind || 'forward';
        const interactive = config.interactive !== false && kind !== 'draft';
        const pathData = this._buildGraphPathData(from, to, config.sourceSide || 'right', config.targetSide || 'left');
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `campaign-graph-edge campaign-graph-edge--${kind}${interactive ? ' campaign-graph-edge--interactive' : ''}`);

        if (interactive) {
            const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitbox.setAttribute('d', pathData);
            hitbox.setAttribute('class', 'campaign-graph-wire-hitbox');
            hitbox.setAttribute('data-graph-wire-hitbox', '');
            hitbox.setAttribute('data-from-level-id', config.fromLevelId || '');
            hitbox.setAttribute('data-portal-index', String(config.entityIndex ?? ''));
            hitbox.setAttribute('data-target-level-id', config.targetLevelId || '');
            hitbox.setAttribute('data-source-side', config.sourceSide || '');
            hitbox.setAttribute('data-target-side', config.targetSide || '');
            group.appendChild(hitbox);
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('class', `campaign-graph-wire campaign-graph-wire--${kind}`);
        group.appendChild(path);

        svg.appendChild(group);
    }

    _buildGraphPathData(from, to, sourceSide = 'right', targetSide = 'left') {
        const deltaX = to.x - from.x;
        const portsFaceEachOther = (sourceSide === 'right' && targetSide === 'left' && deltaX > 0)
            || (sourceSide === 'left' && targetSide === 'right' && deltaX < 0);
        const offset = portsFaceEachOther
            ? Math.max(Math.abs(deltaX) * 0.5, 50)
            : deltaX > 0
            ? Math.max(Math.abs(deltaX) * 0.5, 50)
            : Math.max(Math.abs(deltaX), 150);
        const sourceDirection = sourceSide === 'left' ? -1 : 1;
        const targetDirection = targetSide === 'right' ? 1 : -1;
        return `M ${from.x} ${from.y} C ${from.x + sourceDirection * offset} ${from.y}, ${to.x + targetDirection * offset} ${to.y}, ${to.x} ${to.y}`;
    }

    _graphPortPoint(element) {
        const svg = this.el.querySelector('#campaign-graph-svg');
        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map(Number) || [0, 0, svgRect.width, svgRect.height];
        const rect = element.getBoundingClientRect();
        const scaleX = viewBox[2] / svgRect.width;
        const scaleY = viewBox[3] / svgRect.height;

        return {
            x: viewBox[0] + (rect.left + rect.width / 2 - svgRect.left) * scaleX,
            y: viewBox[1] + (rect.top + rect.height / 2 - svgRect.top) * scaleY,
        };
    }

    _graphEventPoint(event) {
        const svg = this.el.querySelector('#campaign-graph-svg');
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map(Number) || [0, 0, rect.width, rect.height];
        const scaleX = viewBox[2] / rect.width;
        const scaleY = viewBox[3] / rect.height;
        return {
            x: viewBox[0] + (event.clientX - rect.left) * scaleX,
            y: viewBox[1] + (event.clientY - rect.top) * scaleY,
        };
    }

    _renderCampaignPane(campaign = this._readCampaign()) {
        const levelList = this.el.querySelector('#campaign-level-list');
        const linkList = this.el.querySelector('#campaign-link-list');
        if (!levelList || !linkList) return;

        const levels = campaign.levels || [];
        if (!levels.length) {
            levelList.innerHTML = '<span class="custom-asset-empty">No saved custom levels yet.</span>';
        } else {
            levelList.innerHTML = levels.map((level) => {
                const isLoaded = level.levelId === this.currentLevelId;
                const isEntry = level.levelId === campaign.entryLevelId;
                return `
                <div class="campaign-row ${isLoaded ? 'is-loaded' : ''} ${isEntry ? 'is-entry' : ''}">
                    <div class="campaign-row-main">
                        <span>${this._escapeHtml(level.levelName || level.levelId)}</span>
                        <code>${this._escapeHtml(level.levelId)}${isEntry ? ' | entry' : ''}</code>
                    </div>
                    <div class="campaign-row-actions">
                        <button class="editor-button editor-button--mini" data-load-level="${this._escapeAttr(level.levelId)}" type="button" ${isLoaded ? 'disabled' : ''}>
                            ${isLoaded ? 'Loaded' : 'Load'}
                        </button>
                        <button class="editor-button editor-button--mini editor-button--danger" data-delete-level="${this._escapeAttr(level.levelId)}" type="button">
                            Delete
                        </button>
                    </div>
                </div>
            `;
            }).join('');
        }

        const links = this._buildCampaignLinksFromLevels(levels)
            .filter((link) => link.fromLevelId === this.currentLevelId);
        const currentLinks = (this.editor?.getSnapshot().entities || [])
            .filter((entity) => entity.type === 'portal')
            .map((portal, index) => ({
                fromLevelId: this.currentLevelId,
                portalIndex: index,
                targetLevelId: portal.targetMapId || portal.targetLevelId || portal.portalConfig?.targetMapId || portal.portalConfig?.targetLevelId || 'unset',
                requiredTerminals: portal.requiredTerminals || [],
                portalKind: portal.portalKind || portal.portalConfig?.portalKind || (portal.color === '#a855f7' ? 'return' : 'forward'),
            }));
        const allLinks = currentLinks.length ? currentLinks : links;

        linkList.innerHTML = allLinks.length
            ? allLinks.map((link) => `
                <div class="campaign-link">
                    <span>${this._escapeHtml(this._getLevelDisplayName(link.fromLevelId, levels))} -> ${this._escapeHtml(this._getLevelDisplayName(link.targetLevelId, levels))}</span>
                    <code>${this._escapeHtml(this._capitalize(link.portalKind || 'portal'))} Portal</code>
                </div>
            `).join('')
            : '<span class="custom-asset-empty">No portals configured on this level.</span>';
    }

    _syncCampaignFields() {
        const levelIdInput = this.el.querySelector('#campaign-level-id');
        const levelNameInput = this.el.querySelector('#campaign-level-name');
        if (levelIdInput) levelIdInput.value = this.currentLevelId;
        if (levelNameInput) levelNameInput.value = this.currentLevelName;
    }

    _syncGridSizeFields() {
        const snapshot = this.editor?.getSnapshot?.();
        if (!snapshot) return;

        const widthInput = this.el.querySelector('#editor-grid-width');
        const heightInput = this.el.querySelector('#editor-grid-height');
        if (widthInput) widthInput.value = snapshot.width;
        if (heightInput) heightInput.value = snapshot.height;
    }

    _resizeEditorGridFromInputs() {
        const width = Number(this.el.querySelector('#editor-grid-width')?.value || 20);
        const height = Number(this.el.querySelector('#editor-grid-height')?.value || 10);
        this.editor?.resizeGrid(width, height);
        this._syncGridSizeFields();
        this._renderCampaignPane();
    }

    _syncLevelMetaFromInputs() {
        this.currentLevelId = this._slugify(this.el.querySelector('#campaign-level-id')?.value || this.currentLevelId);
        this.currentLevelName = this.el.querySelector('#campaign-level-name')?.value.trim() || this.currentLevelId;
        this._syncCampaignFields();
    }

    _readUserMaps() {
        return this._readJson(USER_MAPS_KEY, { maps: [] });
    }

    _readUserCurriculum() {
        return this._readJson(USER_CURRICULUM_KEY, { challenges: [] });
    }

    _readCampaign() {
        const rawCampaign = this._readJson(USER_CAMPAIGN_KEY, null);
        const maps = this._readUserMaps().maps || [];
        const challenges = this._readUserCurriculum().challenges || [];
        return this._normalizeCampaign(rawCampaign, maps, challenges);
    }

    _writeCampaign(campaign) {
        const normalized = this._normalizeCampaign(campaign);
        normalized.updatedAt = Date.now();
        normalized.links = this._buildCampaignLinksFromLevels(normalized.levels);

        const maps = this._flattenCampaignMaps(normalized);
        const curriculum = this._flattenCampaignChallenges(normalized);
        const challenges = curriculum.challenges;

        localStorage.setItem(USER_CAMPAIGN_KEY, JSON.stringify(normalized));
        localStorage.setItem('user_campaign.json', JSON.stringify(normalized));
        localStorage.setItem(USER_MAPS_KEY, JSON.stringify({ maps }));
        localStorage.setItem('user_maps.json', JSON.stringify({ maps }));
        localStorage.setItem(USER_CURRICULUM_KEY, JSON.stringify(curriculum));
        localStorage.setItem('user_curriculum.json', JSON.stringify(curriculum));

        return { campaign: normalized, maps, challenges };
    }

    _normalizeCampaign(rawCampaign, flatMaps = [], flatChallenges = []) {
        const rawLevels = Array.isArray(rawCampaign?.levels) ? rawCampaign.levels : [];
        let levels = rawLevels.map((level) => {
            const levelId = this._slugify(level.levelId || level.id || level.mapData?.id);
            const mapData = level.mapData || flatMaps.find((map) => map.id === levelId);
            if (!mapData) return null;

            const levelName = level.levelName || level.name || mapData.name || levelId;
            const curriculumData = level.curriculumData || {
                challenges: this._challengesForMap(mapData, flatChallenges),
            };

            return {
                levelId,
                levelName,
                mapData: {
                    ...mapData,
                    id: levelId,
                    name: levelName,
                },
                curriculumData: {
                    challenges: Array.isArray(curriculumData.challenges)
                        ? curriculumData.challenges
                        : [],
                    botBuddy: curriculumData.botBuddy || mapData.botBuddy || null,
                },
            };
        }).filter(Boolean);

        if (!levels.length && flatMaps.length) {
            levels = flatMaps.map((map) => ({
                levelId: this._slugify(map.id),
                levelName: map.name || map.id,
                mapData: {
                    ...map,
                    id: this._slugify(map.id),
                    name: map.name || map.id,
                },
                curriculumData: {
                    challenges: this._challengesForMap(map, flatChallenges),
                    botBuddy: map.botBuddy || null,
                },
            }));
        }

        const requestedEntryLevelId = rawCampaign?.entryLevelId
            || rawCampaign?.entryMapId
            || levels[0]?.levelId
            || this.currentLevelId;
        const entryLevelId = levels.some((level) => level.levelId === requestedEntryLevelId)
            ? requestedEntryLevelId
            : (levels[0]?.levelId || this.currentLevelId);

        return {
            version: 2,
            entryLevelId,
            updatedAt: rawCampaign?.updatedAt || 0,
            graphPositions: rawCampaign?.graphPositions || {},
            levels,
            links: this._buildCampaignLinksFromLevels(levels),
        };
    }

    _flattenCampaignMaps(campaign) {
        return (campaign.levels || []).map((level) => ({
            ...level.mapData,
            id: level.levelId,
            name: level.levelName || level.levelId,
        }));
    }

    _flattenCampaignChallenges(campaign) {
        const byId = new Map();
        const levels = [];
        (campaign.levels || []).forEach((level) => {
            (level.curriculumData?.challenges || []).forEach((challenge) => {
                if (challenge?.id) byId.set(challenge.id, challenge);
            });
            levels.push({
                levelId: level.levelId,
                levelName: level.levelName,
                botBuddy: level.curriculumData?.botBuddy || level.mapData?.botBuddy || null,
            });
        });
        return {
            challenges: Array.from(byId.values()),
            levels,
        };
    }

    _challengesForMap(mapData, flatChallenges = []) {
        const terminalIds = new Set((mapData.entities || [])
            .filter((entity) => entity.type === 'terminal')
            .map((entity) => entity.terminalConfig?.challengeId || entity.challengeId)
            .filter(Boolean));
        const matched = flatChallenges.filter((challenge) => terminalIds.has(challenge.id));
        return matched.length ? matched : this._buildCurriculumExport(mapData);
    }

    _buildCampaignLinksFromLevels(levels = []) {
        return levels.flatMap((level) => {
            return (level.mapData?.entities || [])
                .filter((entity) => entity.type === 'portal')
                .map((portal, index) => ({
                    fromLevelId: level.levelId,
                    portalIndex: index,
                    targetLevelId: portal.targetMapId || portal.targetLevelId || portal.portalConfig?.targetMapId || portal.portalConfig?.targetLevelId || '',
                    portalKind: portal.portalKind || portal.portalConfig?.portalKind || (portal.color === '#a855f7' ? 'return' : 'forward'),
                    requiredTerminals: portal.requiredTerminals || portal.portalConfig?.requiredTerminals || [],
                }));
        });
    }

    _getLevelDisplayName(levelId, levels = this._readCampaign().levels || []) {
        if (!levelId || levelId === 'unset') return 'Unset';
        const level = levels.find((item) => item.levelId === levelId);
        return level?.levelName || levelId;
    }

    _generateUniqueLevelId(levelName, campaign = this._readCampaign()) {
        const existingIds = new Set((campaign.levels || []).map((level) => level.levelId));
        const baseSlug = this._slugify(levelName || 'custom_level').toLowerCase();
        const base = baseSlug.startsWith('custom_') ? baseSlug : `custom_${baseSlug}`;
        let candidate = base;
        let index = 2;

        while (existingIds.has(candidate)) {
            candidate = `${base}_${index}`;
            index += 1;
        }

        return candidate;
    }

    _readJson(key, fallback) {
        try {
            const alias = key === USER_MAPS_KEY
                ? 'user_maps.json'
                : key === USER_CURRICULUM_KEY
                    ? 'user_curriculum.json'
                    : key === USER_CAMPAIGN_KEY
                        ? 'user_campaign.json'
                        : null;
            const serialized = localStorage.getItem(key) || (alias ? localStorage.getItem(alias) : null);
            return serialized ? JSON.parse(serialized) : fallback;
        } catch (error) {
            console.warn(`[LevelEditor] Failed to read ${key}:`, error);
            return fallback;
        }
    }

    _buildValidationFromModal() {
        const type = this.el.querySelector('#terminal-validation-type')?.value || 'variableValue';

        if (type === 'dataFrameShape') {
            const dataFrameName = this._cleanPythonIdentifier(this.el.querySelector('#validation-dataframe-name')?.value, 'df');
            const expectedRows = Math.max(0, Number(this.el.querySelector('#validation-expected-rows')?.value || 0));
            const expectedColumns = Math.max(0, Number(this.el.querySelector('#validation-expected-columns')?.value || 0));
            return {
                type,
                dataFrameName,
                expectedRows,
                expectedColumns,
                expression: `pyodide.globals.get('${dataFrameName}').shape == (${expectedRows}, ${expectedColumns})`,
            };
        }

        if (type === 'booleanState') {
            const flagName = this._cleanPythonIdentifier(this.el.querySelector('#validation-flag-name')?.value, 'is_ready');
            const expectedState = this.el.querySelector('#validation-expected-state')?.value !== 'false';
            return {
                type,
                flagName,
                expectedState,
                expression: `pyodide.globals.get('${flagName}') == ${expectedState ? 'true' : 'false'}`,
            };
        }

        const variableName = this._cleanPythonIdentifier(this.el.querySelector('#validation-variable-name')?.value, 'x');
        const expectedValue = this.el.querySelector('#validation-expected-value')?.value.trim() || '';
        return {
            type: 'variableValue',
            variableName,
            expectedValue,
            expression: `pyodide.globals.get('${variableName}') == ${this._formatExpectedValue(expectedValue)}`,
        };
    }

    _makeDefaultTerminalConfig(challengeId) {
        return {
            challengeId,
            dialogueIntro: '',
            dialogueHint: '',
            validation: {
                type: 'variableValue',
                variableName: 'x',
                expectedValue: '10',
                expression: "pyodide.globals.get('x') == 10",
            },
        };
    }

    _formatExpectedValue(value) {
        if (/^-?\d+(\.\d+)?$/.test(value)) return value;
        if (/^(true|false)$/i.test(value)) return value.toLowerCase();
        if (value === 'None' || value === 'null') return 'null';
        return JSON.stringify(value);
    }

    _parseExpectedValue(value) {
        const text = String(value ?? '').trim();
        if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
        if (/^true$/i.test(text)) return true;
        if (/^false$/i.test(text)) return false;
        if (text === 'None' || text === 'null') return null;
        return text;
    }

    _cleanPythonIdentifier(value, fallback) {
        const cleaned = String(value || '').trim();
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(cleaned) ? cleaned : fallback;
    }

    _slugify(value) {
        return String(value || '')
            .trim()
            .replace(/[^A-Za-z0-9_ -]/g, '')
            .replace(/\s+/g, '_')
            .replace(/-+/g, '_')
            || 'custom_level_1';
    }

    _describeEntity(entity) {
        if (entity.type === 'terminal') return entity.challengeId;
        if (entity.type === 'portal') {
            const label = (entity.portalKind || entity.portalConfig?.portalKind) === 'return' ? 'Return Portal' : 'Portal';
            return `${label} -> ${entity.targetMapId || 'unset'}`;
        }
        if (entity.type === 'bot') return 'Bot Buddy';
        return entity.type;
    }

    _escapeAttr(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    }

    _escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    }

    _capitalize(value) {
        return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
    }
}
