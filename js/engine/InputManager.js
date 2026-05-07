/**
 * InputManager — Handles keyboard input for the game world.
 * Tracks key states and prevents default browser actions for game keys.
 * Disables input when an input element or the CodeMirror editor is focused.
 */
export class InputManager {
    constructor() {
        this.keys = new Set();
        this.justPressed = new Set();
        this._enabled = true;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onBlur = this._onBlur.bind(this);

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);
    }

    /**
     * Check if input should be captured based on current active element.
     */
    _shouldCaptureInput() {
        if (!this._enabled) return false;
        
        const active = document.activeElement;
        if (!active) return true;

        // Don't capture input if typing in an input, textarea, or CodeMirror editor
        const tagName = active.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') return false;
        if (active.classList.contains('cm-content')) return false;
        
        // Also check if focus is within an editor container
        let parent = active;
        while (parent && parent !== document.body) {
            if (parent.classList?.contains('cm-editor') || parent.classList?.contains('editor-panel')) {
                return false;
            }
            parent = parent.parentElement;
        }

        return true;
    }

    _onKeyDown(e) {
        if (!this._shouldCaptureInput()) return;

        const key = e.key.toLowerCase();
        
        // Prevent default scrolling for game keys
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
            e.preventDefault();
        }

        if (!this.keys.has(key)) {
            this.justPressed.add(key);
        }
        this.keys.add(key);
    }

    _onKeyUp(e) {
        this.keys.delete(e.key.toLowerCase());
    }

    _onBlur() {
        // Clear input state when window loses focus
        this.keys.clear();
        this.justPressed.clear();
    }

    /**
     * Call this every frame to clear `justPressed` states.
     */
    update() {
        this.justPressed.clear();
    }

    /**
     * Enable or disable game input capture.
     */
    setEnabled(enabled) {
        this._enabled = enabled;
        if (!enabled) {
            this.keys.clear();
            this.justPressed.clear();
        }
    }

    isDown(key) {
        return this.keys.has(key.toLowerCase());
    }

    isJustPressed(key) {
        return this.justPressed.has(key.toLowerCase());
    }

    getAxis() {
        let dx = 0;
        let dy = 0;

        if (this.isDown('a') || this.isDown('arrowleft')) dx -= 1;
        if (this.isDown('d') || this.isDown('arrowright')) dx += 1;
        if (this.isDown('w') || this.isDown('arrowup')) dy -= 1;
        if (this.isDown('s') || this.isDown('arrowdown')) dy += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        return { x: dx, y: dy };
    }

    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('blur', this._onBlur);
    }
}
