/**
 * PythonRunner — Pyodide-based Python execution sandbox.
 * Loads CPython compiled to WebAssembly and executes user code
 * with stdout/stderr capture, timeout protection, and error parsing.
 */
import { Events } from '../utils/EventBus.js';

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js';
const MAX_EXECUTION_TIME_MS = 10000; // 10 second timeout

export class PythonRunner {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.pyodide = null;
        this._loading = false;
        this._ready = false;
    }

    /**
     * Load Pyodide runtime. Shows progress via callback.
     * @param {Function} [onProgress] - progress callback (message)
     */
    async init(onProgress) {
        if (this._ready) return;
        if (this._loading) return;
        this._loading = true;

        try {
            onProgress?.('Loading Python runtime...');

            // Load Pyodide script
            if (!window.loadPyodide) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = PYODIDE_CDN;
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            onProgress?.('Initializing Python interpreter...');
            this.pyodide = await window.loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
            });

            onProgress?.('Python runtime ready.');
            this._ready = true;
            this._loading = false;
        } catch (err) {
            console.error('[PythonRunner] Failed to load Pyodide:', err);
            this._loading = false;
            throw err;
        }
    }

    get isReady() {
        return this._ready;
    }

    /**
     * Execute Python code and capture output.
     * @param {string} code
     * @returns {{ success: boolean, output: string, error: string|null, errorType: string|null, errorLine: number|null, executionTime: number }}
     */
    async run(code) {
        if (!this._ready) {
            return {
                success: false,
                output: '',
                error: 'Python runtime not loaded yet. Please wait...',
                errorType: 'runtime',
                errorLine: null,
                executionTime: 0,
            };
        }

        if (!code || code.trim() === '') {
            return {
                success: false,
                output: '',
                error: 'SyntaxError: unexpected EOF while parsing (Code is empty)',
                errorType: 'syntax',
                errorLine: 1,
                executionTime: 0,
            };
        }

        const startTime = performance.now();

        // Set up stdout/stderr capture
        this.pyodide.runPython(`
import sys
from io import StringIO
_nexus_stdout = StringIO()
_nexus_stderr = StringIO()
sys.stdout = _nexus_stdout
sys.stderr = _nexus_stderr
        `);

        try {
            // Execute with timeout
            await this._executeWithTimeout(code, MAX_EXECUTION_TIME_MS);

            const stdout = this.pyodide.runPython('_nexus_stdout.getvalue()');
            const stderr = this.pyodide.runPython('_nexus_stderr.getvalue()');
            const executionTime = performance.now() - startTime;

            // Restore stdout/stderr
            this.pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
            `);

            if (stderr) {
                return {
                    success: false,
                    output: stdout || '',
                    error: stderr,
                    errorType: 'runtime',
                    errorLine: this._parseErrorLine(stderr),
                    executionTime,
                };
            }

            return {
                success: true,
                output: stdout || '',
                error: null,
                errorType: null,
                errorLine: null,
                executionTime,
            };
        } catch (err) {
            const executionTime = performance.now() - startTime;
            const errorStr = err.message || String(err);

            // Restore stdout/stderr on error
            try {
                this.pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
                `);
            } catch (_) { /* ignore */ }

            // Classify error
            const errorType = this._classifyError(errorStr);
            const errorLine = this._parseErrorLine(errorStr);

            return {
                success: false,
                output: '',
                error: this._cleanError(errorStr),
                errorType,
                errorLine,
                executionTime,
            };
        }
    }

    /**
     * Execute code with a timeout to catch infinite loops.
     */
    async _executeWithTimeout(code, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('⏱ Execution timed out (possible infinite loop). Check your loops and conditions.'));
            }, timeoutMs);

            try {
                // Pyodide's runPythonAsync handles async Python code
                this.pyodide.runPythonAsync(code).then(() => {
                    clearTimeout(timer);
                    resolve();
                }).catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
            } catch (err) {
                clearTimeout(timer);
                reject(err);
            }
        });
    }

    /**
     * Classify error type for telemetry.
     */
    _classifyError(errorStr) {
        if (errorStr.includes('SyntaxError')) return 'syntax';
        if (errorStr.includes('IndentationError')) return 'syntax';
        if (errorStr.includes('NameError')) return 'runtime';
        if (errorStr.includes('TypeError')) return 'runtime';
        if (errorStr.includes('ValueError')) return 'runtime';
        if (errorStr.includes('IndexError')) return 'runtime';
        if (errorStr.includes('KeyError')) return 'runtime';
        if (errorStr.includes('AttributeError')) return 'runtime';
        if (errorStr.includes('ZeroDivisionError')) return 'runtime';
        if (errorStr.includes('timed out')) return 'timeout';
        return 'runtime';
    }

    /**
     * Parse error line number from Python traceback.
     */
    _parseErrorLine(errorStr) {
        // Match "line X" pattern in traceback
        const match = errorStr.match(/line (\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Clean up Pyodide's verbose error messages.
     */
    _cleanError(errorStr) {
        // Remove Pyodide internal frames, keep only user-relevant info
        const lines = errorStr.split('\n');
        const cleaned = lines.filter(line =>
            !line.includes('pyodide') &&
            !line.includes('wasm') &&
            !line.includes('_pyodide')
        );
        return cleaned.length > 0 ? cleaned.join('\n').trim() : errorStr;
    }

    /**
     * Check if specific Python code produces the expected output.
     * Used for challenge validation.
     * @param {string} code
     * @param {Function} validator - receives output, returns { pass, message }
     */
    async validate(code, validator) {
        const result = await this.run(code);
        if (!result.success) {
            return {
                pass: false,
                message: result.error,
                result,
            };
        }
        const validation = validator(result.output, code);
        return {
            ...validation,
            result,
        };
    }
}
