/**
 * NarrativeEngine — Orchestrates quests, dialogue, and Bot Buddy's AI mentoring.
 * Listens to game events and provides heuristic feedback on Python code.
 */
/**
 * NarrativeEngine — Orchestrates quest progression, dialogue, and code evaluation.
 * 
 * This engine acts as the "Heuristic AI Mentor". It intercepts code execution events,
 * validates against the curriculum schema (AST regex / output), and triggers
 * immediate visual feedback (e.g., terminal sparking) and dialogue hints.
 */
import { Events } from '../utils/EventBus.js';
import { DialogueBox } from '../ui/DialogueBox.js';

export class NarrativeEngine {
    constructor(eventBus, gameState, audio, container, botEntity, curriculum, mapData = null) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.audio = audio;
        this.bot = botEntity;
        this.curriculum = curriculum;
        this.mapData = mapData;
        
        this.dialogueBox = new DialogueBox(container, audio, eventBus);
        this.questObjectiveEl = container.querySelector('#quest-objective');
        
        this.activeTerminal = null;
        this.activeChallenge = null;
        
        this._bindEvents();
    }

    setObjective(text) {
        if (this.questObjectiveEl) {
            this.questObjectiveEl.textContent = text;
        }
    }

    setMapData(mapData) {
        this.mapData = mapData;
    }

    _bindEvents() {
        // Initial intro sequence
        setTimeout(() => this._startIntro(), 1000);

        this.eventBus.on('INTERACT', ({ entity }) => {
            if (entity.type === 'terminal' && !entity.isRepaired) {
                const challenge = this.curriculum.getChallenge(entity.challengeId);
                if (challenge) {
                    this.activeTerminal = entity;
                    this.activeChallenge = challenge;
                    this.bot.setEmotion('thinking');
                    this.setObjective(`Complete: ${challenge.title}`);
                    
                    this.dialogueBox.showSequence(challenge.dialogueIntro).then(() => {
                        this.bot.setEmotion('happy');
                    });
                }
            }
        });

        // Heuristic AI Mentor logic
        this.eventBus.on(Events.CODE_SUBMITTED, ({ result, code }) => {
            if (!this.activeChallenge || !this.activeTerminal) return;

            if (result.success) {
                this._validateChallenge(result, code);
            } else {
                // If python execution completely failed
                this.activeTerminal.isSparking = true;
                this._handleCodeError(result);
            }
        });
    }

    /**
     * Validates a successful Pyodide execution against the active JSON challenge schema.
     * Evaluates stealth triggers (logic flaws), AST regex constraints, and expected output.
     * Triggers visual feedback (`isSparking` / `isRepaired`) and Bot Buddy dialogue.
     * 
     * @param {Object} result - The code execution result from PythonRunner
     * @param {string} code - The source code submitted
     */
    _validateChallenge(result, code) {
        const val = this.activeChallenge.validation;
        
        // NUCLEAR FIX: Sanitize code to remove non-breaking spaces or weird characters
        // that often cause Regex validation to fail in browser environments.
        const sanitizedCode = code.replace(/[\u00A0\u1680​\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ');

        // 1. Check stealth triggers (Logic flaws that run but are logically wrong)
        if (val.stealthTriggers) {
            for (const [key, regexStr] of Object.entries(val.stealthTriggers)) {
                const regex = new RegExp(regexStr, 'mi');
                if (regex.test(sanitizedCode)) {
                    // Logic flaw detected!
                    this.activeTerminal.isSparking = true;
                    this.bot.setEmotion('thinking');
                    
                    // Increment specific concept
                    const concept = this.activeChallenge.type;
                    this.gameState.data.stealthAssessment.concepts[concept] = (this.gameState.data.stealthAssessment.concepts[concept] || 0) + 1;
                    this.gameState.save();

                    const hint = this.activeChallenge.hints[key] || "Hmm, that logic doesn't look quite right.";
                    this.dialogueBox.showSequence([{ name: 'Bot Buddy', text: hint, portrait: '🤖' }])
                        .then(() => this.bot.setEmotion('happy'));
                    return; // Stop validation
                }
            }
        }

        // 2. Check main AST Regex (DEPRECATED - now fallback)
        let astPassed = true;
        if (val.astRegex) {
            const regex = new RegExp(val.astRegex, 'mi');
            astPassed = regex.test(sanitizedCode);
        }

        // PILLAR 2: State-Based Validation
        // This is much more robust than regex string matching
        let statePassed = true;
        if (val.state) {
            statePassed = Object.entries(val.state).every(([varName, expectedValue]) => {
                const actualValue = result.globals?.[varName];
                
                // Flexible comparison (supports strings like ">= 100", "== 50")
                if (typeof expectedValue === 'string') {
                    if (expectedValue.startsWith('>=')) {
                        return actualValue >= parseFloat(expectedValue.slice(2));
                    } else if (expectedValue.startsWith('<=')) {
                        return actualValue <= parseFloat(expectedValue.slice(2));
                    } else if (expectedValue.startsWith('>')) {
                        return actualValue > parseFloat(expectedValue.slice(1));
                    } else if (expectedValue.startsWith('<')) {
                        return actualValue < parseFloat(expectedValue.slice(1));
                    } else if (expectedValue.startsWith('==')) {
                        return actualValue == expectedValue.slice(2).trim();
                    }
                }
                
                return actualValue == expectedValue;
            });
        }

        // 3. Check expected output
        let outPassed = true;
        if (val.expectedOutput) {
            const expected = val.expectedOutput.toLowerCase();
            const actual = (result.output || "").toLowerCase();
            outPassed = actual.includes(expected);
        }

        console.log(`[NarrativeEngine] Validation Result - AST: ${astPassed}, State: ${statePassed}, Output: ${outPassed}`);
        
        // Final Verification (State is now the primary source of truth)
        if (astPassed && statePassed && outPassed) {
            // SUCCESS!
            this.activeTerminal.isRepaired = true;
            this.activeTerminal.isSparking = false;
            
            // Screen shake
            this.eventBus.emit(Events.SCREEN_SHAKE, { intensity: 5, duration: 300 });

            this.bot.setEmotion('happy');
            this.setObjective('Standby for new orders');
            this.dialogueBox.showSequence([
                { name: 'Bot Buddy', text: "You did it! The terminal is rebooting!", color: 'var(--success)', portrait: '🤖' },
                { name: 'System', text: `${this.activeChallenge.title} complete. Systems restored.`, color: 'var(--purple)', portrait: 'SYSTEM' }
            ]);
            
            this.gameState.addXP(100, `${this.activeChallenge.title} Completed`);
            this.gameState.addMegajoules(50);
            
            // Emit success event with ID for state persistence
            this.eventBus.emit(Events.CODE_SUCCESS, { challengeId: this.activeChallenge.id });

            this.activeChallenge = null;
            this.activeTerminal = null;

        } else {
            // Ran but didn't pass requirements
            this.activeTerminal.isSparking = true;
            this.bot.setEmotion('thinking');
            const fallbackHint = this.activeChallenge.hints?.default || "Code ran successfully, but the terminal is still offline. Double-check the requirements!";
            this.dialogueBox.showSequence([
                { name: 'Bot Buddy', text: fallbackHint, portrait: '🤖' }
            ]).then(() => this.bot.setEmotion('happy'));
        }
    }

    _startIntro() {
        const customBot = this.mapData?.botBuddy;
        this.bot.setEmotion(customBot?.emotion || 'happy');
        if (customBot?.greeting) {
            this.setObjective(this.mapData?.entities?.some(ent => ent.type === 'terminal')
                ? 'Investigate the terminal'
                : 'Explore the custom level');
            this.dialogueBox.showSequence([
                { name: 'Bot Buddy', text: customBot.greeting, portrait: 'BOT' }
            ]);
            return;
        }

        this.setObjective('Investigate the red flashing terminal');
        this.dialogueBox.showSequence([
            { name: 'Bot Buddy', text: "Hello, Engineer! I'm your Bot Buddy. Welcome to Supply Depot Alpha.", portrait: '🤖' },
            { name: 'Bot Buddy', text: "The facility's automated systems have gone offline.", portrait: '🤖' },
            { name: 'Bot Buddy', text: "Use WASD or Arrows to move. Walk over to that flashing red terminal and press [E] to inspect it.", portrait: '🤖' }
        ]);
    }

    /**
     * Heuristic Analysis Engine for formative feedback.
     */
    _handleCodeError(result) {
        this.bot.setEmotion('error');
        const errStr = result.error || '';
        
        let feedback = "Hmm, something went wrong. Check your syntax.";

        // Syntax Error Heuristics
        if (errStr.includes('SyntaxError')) {
            if (errStr.includes('invalid syntax')) {
                feedback = "You have a SyntaxError! Did you forget a colon ':' at the end of your 'for' loop or 'if' statement?";
            } else if (errStr.includes('unexpected indent') || errStr.includes('IndentationError')) {
                feedback = "Indentation is crucial in Python. Make sure the code inside your loop is indented by exactly 4 spaces.";
            } else if (errStr.includes('EOL while scanning string literal')) {
                feedback = "You might be missing a closing quote on a string.";
            }
        } 
        // Name Error Heuristics
        else if (errStr.includes('NameError')) {
            const match = errStr.match(/name '(\w+)' is not defined/);
            if (match) {
                feedback = `You're trying to use '${match[1]}', but it hasn't been defined yet. Did you spell it right?`;
            } else {
                feedback = "You have a NameError. Check your variable names!";
            }
        }
        // Logic Error Heuristics (Targeted fallback)
        else {
            feedback = "That threw an error. Double check the line number in the console!";
        }

        this.dialogueBox.showSequence([
            { name: 'Bot Buddy', text: feedback, color: 'var(--error)', portrait: '🤖' }
        ]).then(() => {
            this.bot.setEmotion('happy');
        });
    }
}
