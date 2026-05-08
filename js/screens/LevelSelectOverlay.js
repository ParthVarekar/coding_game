import { Events } from '../utils/EventBus.js';

/**
 * LevelSelectOverlay — Developer tool to quick-jump between levels.
 * Bound to Ctrl+Shift+F
 */
export class LevelSelectOverlay {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.isOpen = false;
        this.maps = [];
        
        this._initDOM();
        this._bindKeys();
        this._loadMaps();
    }

    async _loadMaps() {
        try {
            const [mapsRes, currRes] = await Promise.all([
                fetch('data/maps.json'),
                fetch('data/curriculum.json')
            ]);
            const mapsData = await mapsRes.json();
            const currData = await currRes.json();
            
            this.maps = mapsData.maps;
            this.challenges = currData.challenges;
            this._renderList();
        } catch (e) {
            console.error('[LevelSelect] Failed to load data', e);
        }
    }

    _initDOM() {
        this.element = document.createElement('div');
        this.element.id = 'level-select-overlay';
        this.element.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 450px;
            background: rgba(10, 10, 20, 0.98);
            border: 1px solid #00e5ff;
            border-radius: 12px;
            padding: 20px;
            color: #fff;
            font-family: 'JetBrains Mono', monospace;
            z-index: 10000;
            display: none;
            flex-direction: column;
            gap: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.9);
            border-top: 4px solid #00e5ff;
        `;

        this.element.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 15px;">
                <h2 style="margin: 0; font-size: 18px; color: #00e5ff; text-transform: uppercase; letter-spacing: 1px;">Nexus-AI Dev Skipper</h2>
                <button id="level-select-close" style="background: none; border: none; color: #ff5555; cursor: pointer; font-size: 20px;">×</button>
            </div>
            <div id="level-list" style="display: flex; flex-direction: column; gap: 5px; max-height: 450px; overflow-y: auto; padding-right: 5px;">
                <div style="color: #666; font-size: 12px;">Loading nodes...</div>
            </div>
            <div style="font-size: 10px; color: #666; text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #222;">
                Shortcut: Ctrl+Shift+F
            </div>
        `;

        this.container.appendChild(this.element);
        this.element.querySelector('#level-select-close').addEventListener('click', () => this.hide());
    }

    _renderList() {
        const listContainer = this.element.querySelector('#level-list');
        listContainer.innerHTML = '';

        this.challenges.forEach((challenge, index) => {
            // Find which map this challenge belongs to
            const map = this.maps.find(m => m.entities.some(e => e.challengeId === challenge.id));
            if (!map) return;

            const nodeType = index < 6 ? 'Phase 1' : 'Phase 2';
            const nodeColor = index < 6 ? '#00e5ff' : '#bd00ff';

            const btn = document.createElement('button');
            btn.innerHTML = `
                <span style="color: ${nodeColor}; font-size: 10px; margin-right: 8px;">[${nodeType}]</span>
                <span>${challenge.title}</span>
            `;
            btn.style.cssText = `
                background: rgba(26, 26, 46, 0.5);
                border: 1px solid #333;
                color: #ddd;
                padding: 12px;
                text-align: left;
                cursor: pointer;
                font-family: inherit;
                font-size: 13px;
                border-radius: 6px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
            `;
            
            btn.onmouseover = () => {
                btn.style.borderColor = nodeColor;
                btn.style.background = 'rgba(42, 42, 78, 0.8)';
                btn.style.transform = 'translateX(5px)';
            };
            btn.onmouseout = () => {
                btn.style.borderColor = '#333';
                btn.style.background = 'rgba(26, 26, 46, 0.5)';
                btn.style.transform = 'translateX(0)';
            };

            btn.addEventListener('click', () => {
                this.eventBus.emit(Events.MAP_TRANSITION, { targetMapId: map.id });
                this.hide();
            });

            listContainer.appendChild(btn);
        });
    }

    _bindKeys() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyF') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        this.isOpen = true;
        this.element.style.display = 'flex';
        // Reload maps in case they changed on disk
        this._loadMaps();
    }

    hide() {
        this.isOpen = false;
        this.element.style.display = 'none';
    }
}
