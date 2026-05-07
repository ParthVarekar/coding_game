/**
 * PythonRunner — Web Worker Proxy for Pyodide.
 * Updated to handle SharedArrayBuffer for synchronous input().
 */
import { Events } from '../utils/EventBus.js';

const MAX_EXECUTION_TIME_MS = 10000;
const INPUT_BUFFER_SIZE = 1024; // 1KB for input

export class PythonRunner {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.worker = null;
        this._ready = false;
        this._loading = false;
        this._onStdout = null;
        this._onStderr = null;
        this._activePromise = null;
        this._timeoutId = null;
        
        this._stdoutBuffer = "";
        this._stderrBuffer = "";

        // SharedArrayBuffer for synchronous input() support
        // FALLBACK: If SharedArrayBuffer is not available (due to security headers),
        // we disable synchronous input but let the game boot.
        this.hasSharedMemory = typeof SharedArrayBuffer !== 'undefined';
        if (this.hasSharedMemory) {
            this.sharedBuffer = new SharedArrayBuffer(INPUT_BUFFER_SIZE);
            this.inputArray = new Int32Array(this.sharedBuffer);
        } else {
            console.warn('[PythonRunner] SharedArrayBuffer not available. input() will be disabled.');
            this.sharedBuffer = null;
            this.inputArray = null;
        }
    }

    async init(onProgress) {
        if (this._ready || this._loading) return;
        this._loading = true;

        onProgress?.('Launching Python Web Worker...');

        return new Promise((resolve, reject) => {
            try {
                this.worker = new Worker('js/editor/PythonWorker.js');

                this.worker.onmessage = (e) => {
                    const { type, data } = e.data;

                    switch (type) {
                        case 'ready':
                            this._ready = true;
                            this._loading = false;
                            onProgress?.('Python runtime ready (Off-thread).');
                            resolve();
                            break;
                        case 'stdout':
                            this._stdoutBuffer += data + "\n";
                            if (this._onStdout) this._onStdout(data);
                            break;
                        case 'stderr':
                            this._stderrBuffer += data + "\n";
                            if (this._onStderr) this._onStderr(data);
                            break;
                        case 'waiting_for_input':
                            // Handle input request (UI can prompt user)
                            this.eventBus.emit('PYTHON_WAITING_INPUT');
                            break;
                        case 'error':
                            reject(new Error(data));
                            break;
                        case 'result':
                            this._handleResult(e.data);
                            break;
                    }
                };

                this.worker.onerror = (err) => {
                    this._loading = false;
                    reject(new Error(`Worker Script Error: ${err.message}`));
                };

                this.worker.postMessage({ type: 'init', buffer: this.sharedBuffer });
            } catch (err) {
                this._loading = false;
                reject(err);
            }
        });
    }

    /**
     * Provide input data to the waiting worker.
     * @param {string} text 
     */
    sendInput(text) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        const dest = new Uint8Array(this.sharedBuffer, 8); // Start at index 8 (byte offset)
        
        dest.set(bytes);
        
        // Atomics indices: 0 = status, 1 = length
        Atomics.store(this.inputArray, 1, bytes.length);
        Atomics.store(this.inputArray, 0, 1); // Set status to 1 (data ready)
        Atomics.notify(this.inputArray, 0);   // Wake up worker
    }

    async run(code, onStdout, onStderr) {
        if (!this._ready) {
            return { success: false, error: 'Python not ready.' };
        }

        this._stdoutBuffer = "";
        this._stderrBuffer = "";
        this._onStdout = onStdout;
        this._onStderr = onStderr;

        return new Promise((resolve) => {
            const runId = Math.random().toString(36).substr(2, 9);
            this._activePromise = { resolve, runId };

            this._timeoutId = setTimeout(() => {
                this._handleTimeout(resolve);
            }, MAX_EXECUTION_TIME_MS);

            // AUTO-CONVERT: Replace Unicode math symbols with Python operators
            const sanitizedCode = code
                .replace(/[≥⩾]/g, '>=')
                .replace(/[≤⩽]/g, '<=')
                .replace(/[≠]/g, '!=');

            this.worker.postMessage({ type: 'run', code: sanitizedCode, id: runId });
        });
    }

    _handleResult(msg) {
        if (!this._activePromise || msg.id !== this._activePromise.runId) return;

        clearTimeout(this._timeoutId);
        const { success, error, executionTime, globals } = msg;
        const resolve = this._activePromise.resolve;
        this._activePromise = null;

        resolve({
            success,
            output: this._stdoutBuffer,
            error: error || (success ? null : 'Unknown execution error'),
            errorType: success ? null : (error?.includes('SyntaxError') ? 'syntax' : 'runtime'),
            executionTime,
            globals // PILLAR 2: Logic state
        });
    }

    _handleTimeout(resolve) {
        this.worker.terminate();
        this._ready = false;
        this._loading = false;
        this._activePromise = null;

        if (this._onStderr) this._onStderr('\x1b[1;31m[TIMEOUT] Execution exceeded 10s.\x1b[0m');

        resolve({
            success: false,
            output: this._stdoutBuffer,
            error: 'Execution Timed Out',
            errorType: 'timeout',
            executionTime: MAX_EXECUTION_TIME_MS
        });

        this.init();
    }
}
