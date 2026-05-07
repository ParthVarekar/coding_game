/**
 * DialogueBox — Manages typewriter-style narrative dialogue overlaying the game canvas.
 */
import { Events } from '../utils/EventBus.js';

export class DialogueBox {
    constructor(container, audioManager, eventBus) {
        this.container = container;
        this.audio = audioManager;
        this.eventBus = eventBus;
        
        this.el = null;
        this.textEl = null;
        this.nameEl = null;
        this.portraitEl = null;
        
        this.queue = [];
        this.isTyping = false;
        this.currentText = '';
        this.charIndex = 0;
        this.typeSpeed = 30; // ms per char
        this.typeTimer = null;
        this.resolveCurrent = null;

        this._createHTML();
        
        // Advance dialogue on click or Enter key
        this.container.addEventListener('click', () => this._advance());
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.el.classList.contains('active')) {
                // Prevent intercepting Enter if a text input or the editor is focused
                const isInputFocused = document.activeElement && (
                    document.activeElement.tagName === 'TEXTAREA' || 
                    document.activeElement.tagName === 'INPUT' ||
                    document.activeElement.closest('.cm-editor') ||
                    document.activeElement.getAttribute('contenteditable') === 'true'
                );
                
                if (isInputFocused) return;
                
                this._advance();
            }
        });
    }

    _createHTML() {
        this.el = document.createElement('div');
        this.el.className = 'dialogue-box';
        
        this.el.innerHTML = `
            <div class="dialogue-portrait" id="dialogue-portrait"></div>
            <div class="dialogue-content">
                <div class="dialogue-name" id="dialogue-name">Bot Buddy</div>
                <div class="dialogue-text" id="dialogue-text"></div>
                <div class="dialogue-indicator blink">▼</div>
            </div>
        `;
        
        this.textEl = this.el.querySelector('#dialogue-text');
        this.nameEl = this.el.querySelector('#dialogue-name');
        this.portraitEl = this.el.querySelector('#dialogue-portrait');
        
        this.container.appendChild(this.el);
    }

    /**
     * Show a sequence of dialogue messages.
     * Returns a promise that resolves when the sequence finishes.
     */
    async showSequence(messages) {
        this.queue = [...messages];
        this.el.classList.add('active');
        
        return new Promise((resolve) => {
            this._onSequenceComplete = resolve;
            this._showNext();
        });
    }

    _showNext() {
        if (this.queue.length === 0) {
            this.hide();
            if (this._onSequenceComplete) {
                this._onSequenceComplete();
                this._onSequenceComplete = null;
            }
            return;
        }

        const msg = this.queue.shift();
        this.nameEl.textContent = msg.name || 'System';
        this.nameEl.style.color = msg.color || 'var(--cyan)';
        
        // Set portrait (using simple emoji/text for MVP)
        this.portraitEl.textContent = msg.portrait || '🤖';
        
        this.currentText = msg.text;
        this.textEl.textContent = '';
        this.charIndex = 0;
        this.isTyping = true;
        
        this.el.querySelector('.dialogue-indicator').style.display = 'none';
        
        this._type();
    }

    _type() {
        if (this.charIndex < this.currentText.length) {
            const char = this.currentText.charAt(this.charIndex);
            this.textEl.textContent += char;
            this.charIndex++;
            
            // Occasional type sound
            if (this.charIndex % 3 === 0 && char !== ' ') {
                this.audio.playSFX('type');
            }
            
            // Pause longer on punctuation
            let delay = this.typeSpeed;
            if (['.', '!', '?'].includes(char)) delay += 150;
            else if ([',', ';'].includes(char)) delay += 75;

            this.typeTimer = setTimeout(() => this._type(), delay);
        } else {
            this.isTyping = false;
            this.el.querySelector('.dialogue-indicator').style.display = 'block';
        }
    }

    _advance() {
        if (!this.el.classList.contains('active')) return;

        if (this.isTyping) {
            // Skip typing animation
            clearTimeout(this.typeTimer);
            this.textEl.textContent = this.currentText;
            this.isTyping = false;
            this.el.querySelector('.dialogue-indicator').style.display = 'block';
        } else {
            // Next message
            this.audio.playSFX('click');
            this._showNext();
        }
    }

    hide() {
        this.el.classList.remove('active');
        this.queue = [];
        clearTimeout(this.typeTimer);
    }
}
