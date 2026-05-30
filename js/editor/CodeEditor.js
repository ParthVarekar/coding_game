/**
 * CodeEditor — CodeMirror 6 wrapper for the embedded IDE.
 * Provides Python syntax highlighting, custom sci-fi theme,
 * and integration with the code execution pipeline.
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
        this._fallbackTextarea = null;
    }

    /**
     * Load CodeMirror 6 modules from CDN and initialize the editor.
     * Hardened to avoid "Unrecognized extension" errors by forcing dependency sharing.
     */
    async init() {
        if (this._cmLoaded) return;

        try {
            // Force all modules to share the same instance of @codemirror/state
            // This is the most robust way to avoid the "multiple instances" error in CM6
            const baseUrl = 'https://esm.sh/';
            const deps = '?deps=@codemirror/state@6.5.2';
            
            const [state, view, python, theme, commands, cm] = await Promise.all([
                import(`${baseUrl}@codemirror/state@6.5.2`),
                import(`${baseUrl}@codemirror/view@6.36.5${deps}`),
                import(`${baseUrl}@codemirror/lang-python@6.1.6${deps}`),
                import(`${baseUrl}@codemirror/theme-one-dark@6.1.2${deps}`),
                import(`${baseUrl}@codemirror/commands@6.8.1${deps}`),
                import(`${baseUrl}codemirror@6.0.1${deps}`)
            ]);

            this._modules = {
                EditorView: view.EditorView || view.default?.EditorView,
                EditorState: state.EditorState || state.default?.EditorState,
                basicSetup: cm.basicSetup || cm.default?.basicSetup,
                python: python.python || python.default?.python,
                oneDark: theme.oneDark || theme.default?.oneDark,
                keymap: view.keymap || view.default?.keymap,
                indentWithTab: commands.indentWithTab || commands.default?.indentWithTab,
                defaultKeymap: commands.defaultKeymap || commands.default?.defaultKeymap || [],
            };
            this._cmLoaded = true;
            console.log('[CodeEditor] CodeMirror modules loaded successfully.');
        } catch (err) {
            console.warn('[CodeEditor] CM6 loading failed, falling back to styled textarea:', err.message);
            this._cmLoaded = true;
            this._modules = null;
        }
    }

    create(parentEl, initialCode = '# Write your Python code here\n', onRun) {
        if (this._modules === null) {
            this._createFallbackEditor(parentEl, initialCode, onRun);
            return;
        }

        try {
            const { EditorView, EditorState, basicSetup, python, oneDark, keymap, indentWithTab, defaultKeymap } = this._modules;

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
                    backgroundColor: '#0a0a14',
                    color: '#5c6370',
                    borderRight: '1px solid #181a1f',
                }
            }, { dark: true });

            const state = EditorState.create({
                doc: initialCode,
                extensions: [
                    basicSetup,
                    python(),
                    oneDark,
                    nexusTheme,
                    keymap.of([
                        indentWithTab,
                        ...defaultKeymap,
                        {
                            key: 'Ctrl-Enter',
                            run: (view) => {
                                if (onRun) onRun(view.state.doc.toString());
                                return true;
                            }
                        }
                    ])
                ]
            });

            this.editorView = new EditorView({ state, parent: parentEl });
        } catch (err) {
            console.error('[CodeEditor] CodeMirror creation failed:', err.message);
            this._createFallbackEditor(parentEl, initialCode, onRun);
        }
    }

    _createFallbackEditor(parentEl, initialCode, onRun) {
        // Inject fallback styles if not present
        if (!document.getElementById('fallback-editor-styles')) {
            const style = document.createElement('style');
            style.id = 'fallback-editor-styles';
            style.textContent = `
                .fallback-editor { display: flex; background: #0a0a14; color: #e8eaed; font-family: 'JetBrains Mono', monospace; height: 100%; width: 100%; border: 1px solid #181a1f; }
                .fallback-line-numbers { padding: 10px 5px; background: #0a0a14; color: #5c6370; text-align: right; min-width: 35px; border-right: 1px solid #181a1f; font-size: 13px; line-height: 1.5; user-select: none; }
                .fallback-textarea { flex: 1; background: transparent; border: none; color: inherit; font-family: inherit; font-size: 14px; padding: 10px; resize: none; outline: none; line-height: 1.5; white-space: pre; overflow: auto; font-variant-ligatures: none; font-feature-settings: "liga" 0; }
            `;
            document.head.appendChild(style);
        }

        const container = document.createElement('div');
        container.className = 'fallback-editor';

        const lineNumbers = document.createElement('div');
        lineNumbers.className = 'fallback-line-numbers';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'fallback-textarea';
        textarea.value = initialCode;
        textarea.spellcheck = false;

        const updateLines = () => {
            const lines = textarea.value.split('\n').length;
            lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
        };

        textarea.addEventListener('input', updateLines);
        textarea.addEventListener('scroll', () => {
            lineNumbers.scrollTop = textarea.scrollTop;
        });
        
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
            if (e.ctrlKey && e.key === 'Enter') {
                if (onRun) onRun(textarea.value);
            }
        });

        container.appendChild(lineNumbers);
        container.appendChild(textarea);
        parentEl.innerHTML = ''; // Clear parent
        parentEl.appendChild(container);
        updateLines();

        this._fallbackTextarea = textarea;
    }

    getCode() {
        if (this._fallbackTextarea) return this._fallbackTextarea.value;
        return this.editorView ? this.editorView.state.doc.toString() : '';
    }

    focus() {
        if (this._fallbackTextarea) {
            this._fallbackTextarea.focus();
        } else if (this.editorView) {
            this.editorView.focus();
        }
    }

    setCode(code) {
        if (this._fallbackTextarea) {
            this._fallbackTextarea.value = code;
            this._fallbackTextarea.dispatchEvent(new Event('input'));
            return;
        }
        if (this.editorView) {
            this.editorView.dispatch({
                changes: { from: 0, to: this.editorView.state.doc.length, insert: code }
            });
        }
    }

    destroy() {
        if (this.editorView) {
            this.editorView.destroy();
            this.editorView = null;
        }
        if (this._fallbackTextarea) {
            this._fallbackTextarea.remove();
            this._fallbackTextarea = null;
        }
    }
}
