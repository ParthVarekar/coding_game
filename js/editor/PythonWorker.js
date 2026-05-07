/**
 * PythonWorker.js — Dedicated Web Worker for Pyodide execution.
 * Updated to support synchronous input() and state-based validation.
 */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');

let pyodide = null;
let inputBuffer = null; // SharedArrayBuffer for input()

/**
 * Custom input() implementation for Pyodide in a worker.
 * Uses Atomics.wait to block until the main thread provides data.
 */
function customInput(prompt) {
    if (prompt) self.postMessage({ type: 'stdout', data: prompt });
    
    // Notify main thread we are waiting for input
    self.postMessage({ type: 'waiting_for_input' });

    // Wait for the main thread to write to the shared buffer
    // index 0 is used for status (0: waiting, 1: data ready)
    Atomics.wait(inputBuffer, 0, 0);

    // Read the length of the string (at index 1)
    const length = inputBuffer[1];
    const bytes = new Uint8Array(inputBuffer.buffer, 8, length);
    const decoder = new TextDecoder();
    const result = decoder.decode(bytes);

    // Reset buffer status
    Atomics.store(inputBuffer, 0, 0);

    return result;
}

async function initPyodide() {
    try {
        pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
        });
        
        // Load micropip and install Data Science packages
        self.postMessage({ type: 'stdout', data: '[SYSTEM] Provisioning Data Science environment...' });
        await pyodide.loadPackage('micropip');
        const micropip = pyodide.pyimport('micropip');
        await micropip.install(['pandas', 'numpy']);
        self.postMessage({ type: 'stdout', data: '[SYSTEM] Pandas & Numpy loaded.' });
        
        // Bind custom input to Python if shared memory is available
        if (inputBuffer) {
            self.custom_input = customInput;
            pyodide.runPython(`
import builtins
import js
builtins.input = js.custom_input
            `);
        } else {
            pyodide.runPython(`
import builtins
def fallback_input(prompt=""):
    print(prompt + " [Error: Terminal Input requires COOP/COEP headers to be enabled on the server]")
    return ""
builtins.input = fallback_input
            `);
        }

        pyodide.setStdout({
            batched: (str) => {
                self.postMessage({ type: 'stdout', data: str });
            }
        });
        
        pyodide.setStderr({
            batched: (str) => {
                self.postMessage({ type: 'stderr', data: str });
            }
        });

        self.postMessage({ type: 'ready' });
    } catch (err) {
        self.postMessage({ type: 'error', data: `Worker Initialization Failed: ${err.message}` });
    }
}

self.onmessage = async (e) => {
    const { type, code, id, buffer } = e.data;

    if (type === 'init') {
        if (buffer) {
            inputBuffer = new Int32Array(buffer); // Bind shared buffer
        }
        await initPyodide();
        return;
    }

    if (type === 'run') {
        if (!pyodide) {
            self.postMessage({ type: 'error', data: 'Pyodide not initialized', id });
            return;
        }

        const startTime = Date.now();
        try {
            await pyodide.runPythonAsync(code);
            const executionTime = Date.now() - startTime;
            
            // PILLAR 2: Extract globals for state-based validation
            // We use a Python-side filter to only get basic serializable types
            pyodide.runPython(`
__nexus_state__ = {k: v for k, v in globals().items() if isinstance(v, (int, float, str, bool, list, dict)) and not k.startswith('__')}
            `);
            const globals = pyodide.globals.get('__nexus_state__').toJs({ dict_converter: Object.fromEntries });
            
            self.postMessage({ 
                type: 'result', 
                success: true, 
                executionTime,
                globals, // Send logic state back to main thread
                id 
            });
        } catch (err) {
            const executionTime = Date.now() - startTime;
            self.postMessage({ 
                type: 'result', 
                success: false, 
                error: err.message,
                executionTime,
                id 
            });
        }
    }
};
