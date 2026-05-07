/**
 * NarrativeEngine — Orchestrates quests, dialogue, and Bot Buddy's AI mentoring.
 * Listens to game events and provides heuristic feedback on Python code.
 */
import { Events } from '../utils/EventBus.js';
import { DialogueBox } from '../ui/DialogueBox.js';

export class NarrativeEngine {
    constructor(eventBus, gameState, audio, container, botEntity) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.audio = audio;
        this.bot = botEntity;
        
        this.dialogueBox = new DialogueBox(container, audio, eventBus);
        this.questObjectiveEl = container.querySelector('#quest-objective');
        
        this.currentQuest = null;
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
            if (entity.challengeId === 'challenge_1' && !entity.isRepaired) {
                this.bot.setEmotion('thinking');
                this.setObjective('Fix the broken terminal');
                this.dialogueBox.showSequence([
                    { name: 'Bot Buddy', text: "Oh no, the main power loop is broken!", portrait: '🤖' },
                    { name: 'Bot Buddy', text: "It needs exactly 10 power units to boot. Can you write a loop that runs 10 times?", portrait: '🤖' }
                ]).then(() => {
                    this.bot.setEmotion('happy');
                });
            }
        });

        // Heuristic AI Mentor logic
        this.eventBus.on(Events.CODE_SUBMITTED, (result) => {
            if (result.success) {
                // Check if challenge is completed (hardcoded for prototype)
                if (result.output && result.output.includes('Power level: 10')) {
                    this.bot.setEmotion('happy');
                    this.setObjective('Standby for new orders');
                    this.dialogueBox.showSequence([
                        { name: 'Bot Buddy', text: "You did it! The terminal is rebooting!", color: 'var(--success)', portrait: '🤖' },
                        { name: 'System', text: "Sector 7 power restored. Primary objective complete.", color: 'var(--purple)', portrait: 'SYSTEM' }
                    ]);
                } else {
                    this.bot.setEmotion('thinking');
                    this.dialogueBox.showSequence([
                        { name: 'Bot Buddy', text: "Code ran successfully! But the terminal is still offline. Did you print 'Power level: 10'?", portrait: '🤖' }
                    ]).then(() => this.bot.setEmotion('happy'));
                }
            } else {
                this._handleCodeError(result);
            }
        });
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
        // Logic Error Heuristics (Targeted for the loop challenge)
        else {
            const code = document.querySelector('.cm-content')?.textContent || '';
            if (code.includes('range(5)')) {
                feedback = "Your loop structure is perfect, but look closely at the range! It's only running 5 times instead of 10.";
                
                // Track this specific logic error for stealth assessment
                this.gameState.data.stealthAssessment.concepts.loops += 1;
                this.gameState.save();
            } else {
                feedback = "That threw an error. Double check the line number in the console!";
            }
        }

        this.dialogueBox.showSequence([
            { name: 'Bot Buddy', text: feedback, color: 'var(--error)', portrait: '🤖' }
        ]).then(() => {
            this.bot.setEmotion('happy');
        });
    }
}
