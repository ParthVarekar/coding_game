/**
 * CodeEditor — CodeMirror 6 wrapper for the embedded IDE.
 * Provides Python syntax highlighting, custom sci-fi theme,
 * and integration with the code execution pipeline.
 * 
 * Uses a single esm.sh bundle URL to avoid duplicate @codemirror/state instances.
 */
import { Events } from '../utils/EventBus.js';

export class CodeEditor {
    constructor(container, eventBus, gameState) {
        this.container = container;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.editorView = null;
        this._cmLoaded = false;
        this._modules = {};
    }

    /**
     * Load CodeMirror 6 modules from CDN and initialize the editor.
     * We use a single esm.sh bundle to prevent duplicate state instances.
     */
    async init() {
        if (this._cmLoaded) return;

        try {
            // Use a single bundled import to prevent multiple @codemirror/state instances
            const cmBundle = await import('https://esm.sh/*codemirror@6.0.1');
            const cmState = await import('https://esm.sh/*@codemirror/state@6.5.2');
            const cmPython = await import('https://esm.sh/*@codemirror/lang-python@6.1.6');
            const cmOneDark = await import('https://esm.sh/*@codemirror/theme-one-dark@6.1.2');
            const cmView = await import('https://esm.sh/*@codemirror/view@6.36.5');
            const cmCommands = await import('https://esm.sh/*@codemirror/commands@6.8.1');

            this._modules = {
                EditorView: cmView.EditorView || cmBundle.EditorView,
                EditorState: cmState.EditorState || cmBundle.EditorState,
                basicSetup: cmBundle.basicSetup,
                python: cmPython.python,
                oneDark: cmOneDark.oneDark,
                keymap: cmView.keymap,
                indentWithTab: cmCommands.indentWithTab,
            };
            this._cmLoaded = true;
        } catch (err) {
            console.warn('[CodeEditor] Bundled import failed, trying alternative approach:', err.message);
            // Fallback: load via script tags to guarantee single instances
            await this._loadViaScriptFallback();
        }
    }

    /**
     * Fallback: Create a minimal editor using a textarea if CDN fails.
     */
    async _loadViaScriptFallback() {
        // If CDN imports fail, we'll create a simple but functional textarea-based editor
        console.log('[CodeEditor] Using textarea fallback editor.');
        this._cmLoaded = true;
        this._modules = null; // Signal to use fallback
    }

    /**
     * Create the editor instance.
     * @param {HTMLElement} parentEl
     * @param {string} initialCode
     * @param {Function} onRun
     */
    create(parentEl, initialCode = '# Write your Python code here\n', onRun) {
        if (this._modules === null) {
            // Fallback: textarea editor
            this._createFallbackEditor(parentEl, initialCode, onRun);
            return;
        }

        try {
            const { EditorView, EditorState, basicSetup, python, oneDark, keymap, indentWithTab } = this._modules;

            // Custom Nexus theme overrides
            const nexusTheme = EditorView.theme({
                '&': {
                    backgroundColor: '#0a0a14',
                    color: '#e8eaed',
                    fontSize: `${this.gameState.data.settings.fontSize}px`,
                    height: '100%',
                },
                '.cm-content': {
                    fontFamily: "'JetBrains Mono', monospace",
                    caretColor: '#00e5ff',
                },
                '.cm-cursor': {
                    borderLeftColor: '#00e5ff',
                    borderLeftWidth: '2px',
                },
                '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
                    backgroundColor: 'rgba(0, 229, 255, 0.15) !important',
                },
                '.cm-activeLine': {
                    backgroundColor: 'rgba(0, 229, 255, 0.04)',
                },
                '.cm-gutters': {
                    backgroundColor: '#06060c',
                    color: '#4b5563',
                    border: 'none',
                    borderRight: '1px solid rgba(0, 229, 255, 0.1)',
                },
                '.cm-activeLineGutter': {
                    backgroundColor: 'rgba(0, 229, 255, 0.08)',
                    color: '#00e5ff',
                },
            });

            // Run keybinding
            const runKeymap = keymap.of([
                { key: 'Ctrl-Enter', run: () => { if (onRun) onRun(this.getCode()); return true; } },
                { key: 'Shift-Enter', run: () => { if (onRun) onRun(this.getCode()); return true; } },
            ]);

            const extensions = [basicSetup, python(), nexusTheme, EditorView.lineWrapping];
            
            // Only add oneDark if it loaded properly
            if (oneDark) extensions.splice(2, 0, oneDark);
            
            // Add keymaps
            if (indentWithTab) extensions.push(keymap.of([indentWithTab]));
            extensions.push(runKeymap);

            const state = EditorState.create({
                doc: initialCode,
                extensions,
            });

            this.editorView = new EditorView({ state, parent: parentEl });
        } catch (err) {
            console.warn('[CodeEditor] CodeMirror creation failed, using fallback:', err.message);
            this._createFallbackEditor(parentEl, initialCode, onRun);
        }
    }

    /**
     * Fallback textarea editor with Python-like styling.
     */
    _createFallbackEditor(parentEl, initialCode, onRun) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'height:100%;display:flex;flex-direction:column;';

        const lineNumbers = document.createElement('div');
        lineNumbers.className = 'fallback-line-numbers';
        lineNumbers.style.cssText = `
            position:absolute;left:0;top:0;bottom:0;width:45px;
            background:#06060c;color:#4b5563;font-family:'JetBrains Mono',monospace;
            font-size:${this.gameState.data.settings.fontSize}px;
            line-height:1.6;padding:8px 8px 8px 0;text-align:right;
            border-right:1px solid rgba(0,229,255,0.1);overflow:hidden;
            user-select:none;
        `;

        const textarea = document.createElement('textarea');
        textarea.value = initialCode;
        textarea.spellcheck = false;
        textarea.style.cssText = `
            flex:1;width:100%;resize:none;border:none;outline:none;
            background:#0a0a14;color:#e8eaed;
            font-family:'JetBrains Mono',monospace;
            font-size:${this.gameState.data.settings.fontSize}px;
            line-height:1.6;padding:8px 8px 8px 55px;
            tab-size:4;white-space:pre;overflow:auto;
        `;

        // Handle Ctrl+Enter
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.shiftKey) && e.key === 'Enter') {
                e.preventDefault();
                if (onRun) onRun(textarea.value);
            }
            // Tab support
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(textarea.selectionEnd);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
        });

        // Update line numbers
        const updateLines = () => {
            const lines = textarea.value.split('\n').length;
            lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
        };
        textarea.addEventListener('input', updateLines);
        textarea.addEventListener('scroll', () => { lineNumbers.scrollTop = textarea.scrollTop; });

        wrapper.style.position = 'relative';
        wrapper.appendChild(lineNumbers);
        wrapper.appendChild(textarea);
        parentEl.appendChild(wrapper);
        updateLines();

        this._fallbackTextarea = textarea;
    }

    getCode() {
        if (this._fallbackTextarea) return this._fallbackTextarea.value;
        return this.editorView ? this.editorView.state.doc.toString() : '';
    }

    setCode(code) {
        if (this._fallbackTextarea) {
            this._fallbackTextarea.value = code;
            return;
        }
        if (!this.editorView) return;
        this.editorView.dispatch({
            changes: { from: 0, to: this.editorView.state.doc.length, insert: code },
        });
    }

    focus() {
        if (this._fallbackTextarea) { this._fallbackTextarea.focus(); return; }
        if (this.editorView) this.editorView.focus();
    }

    destroy() {
        if (this.editorView) { this.editorView.destroy(); this.editorView = null; }
        this._fallbackTextarea = null;
    }
}
