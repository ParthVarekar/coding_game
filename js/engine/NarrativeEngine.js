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
    constructor(eventBus, gameState, audio, container, botEntity, curriculum) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.audio = audio;
        this.bot = botEntity;
        this.curriculum = curriculum;
        
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
        this.eventBus.on(Events.CODE_SUBMITTED, (result) => {
            if (!this.activeChallenge || !this.activeTerminal) return;

            if (result.success) {
                this._validateChallenge(result);
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
     */
    _validateChallenge(result) {
        const val = this.activeChallenge.validation;
        const code = document.querySelector('.cm-content')?.textContent || '';
        
        // 1. Check stealth triggers (Logic flaws that run but are logically wrong)
        if (val.stealthTriggers) {
            for (const [key, regexStr] of Object.entries(val.stealthTriggers)) {
                const regex = new RegExp(regexStr);
                if (regex.test(code)) {
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

        // 2. Check main AST Regex
        let astPassed = true;
        if (val.astRegex) {
            const regex = new RegExp(val.astRegex);
            astPassed = regex.test(code);
        }

        // 3. Check expected output
        let outPassed = true;
        if (val.expectedOutput) {
            outPassed = result.output && result.output.includes(val.expectedOutput);
        }

        // Final Verification
        if (astPassed && outPassed) {
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
            
            this.activeChallenge = null;
            this.activeTerminal = null;

        } else {
            // Ran but didn't pass requirements
            this.activeTerminal.isSparking = true;
            this.bot.setEmotion('thinking');
            this.dialogueBox.showSequence([
                { name: 'Bot Buddy', text: "Code ran successfully, but the terminal is still offline. Double-check the requirements!", portrait: '🤖' }
            ]).then(() => this.bot.setEmotion('happy'));
        }
    }

    _startIntro() {
        this.setObjective('Investigate the red flashing terminal');
        this.bot.setEmotion('happy');
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
