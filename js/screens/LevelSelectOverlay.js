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
            const res = await fetch('data/maps.json');
            const data = await res.json();
            this.maps = data.maps;
            this._renderMapList();
        } catch (e) {
            console.error('[LevelSelect] Failed to load maps.json', e);
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
            width: 400px;
            background: rgba(10, 10, 20, 0.95);
            border: 1px solid #00e5ff;
            border-radius: 8px;
            padding: 20px;
            color: #fff;
            font-family: 'JetBrains Mono', monospace;
            z-index: 10000;
            display: none;
            flex-direction: column;
            gap: 15px;
            backdrop-filter: blur(5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.8);
        `;

        this.element.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px;">
                <h2 style="margin: 0; font-size: 16px; color: #00e5ff;">Dev: Level Select</h2>
                <button id="level-select-close" style="background: none; border: none; color: #ff5555; cursor: pointer; font-family: monospace;">[X]</button>
            </div>
            <div id="level-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
                <div style="color: #666; font-size: 12px;">Loading maps...</div>
            </div>
            <div style="font-size: 10px; color: #666; text-align: center; margin-top: 10px;">
                Shortcut: Ctrl+Shift+F
            </div>
        `;

        this.container.appendChild(this.element);

        this.element.querySelector('#level-select-close').addEventListener('click', () => this.hide());
    }

    _renderMapList() {
        const listContainer = this.element.querySelector('#level-list');
        listContainer.innerHTML = '';

        this.maps.forEach(map => {
            const btn = document.createElement('button');
            btn.textContent = map.name;
            btn.style.cssText = `
                background: #1a1a2e;
                border: 1px solid #333;
                color: #ddd;
                padding: 10px;
                text-align: left;
                cursor: pointer;
                font-family: inherit;
                border-radius: 4px;
                transition: all 0.2s ease;
            `;
            
            btn.onmouseover = () => {
                btn.style.borderColor = '#00e5ff';
                btn.style.background = '#2a2a4e';
            };
            btn.onmouseout = () => {
                btn.style.borderColor = '#333';
                btn.style.background = '#1a1a2e';
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
