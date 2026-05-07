/**
 * EventBus — Lightweight publish/subscribe event system.
 * All Nexus-AI subsystems communicate through this bus
 * to maintain loose coupling between modules.
 */
export class EventBus {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this._listeners = new Map();
    }

    /**
     * Subscribe to an event.
     * @param {string} event
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

        // Return an unsubscribe function for easy cleanup
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event, but only fire once.
     * @param {string} event
     * @param {Function} callback
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event.
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                this._listeners.delete(event);
            }
        }
    }

    /**
     * Emit an event with optional data.
     * @param {string} event
     * @param {*} data
     */
    emit(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[EventBus] Error in listener for "${event}":`, err);
                }
            });
        }
    }

    /**
     * Remove all listeners for a specific event, or all events.
     * @param {string} [event]
     */
    clear(event) {
        if (event) {
            this._listeners.delete(event);
        } else {
            this._listeners.clear();
        }
    }
}

// Well-known event names used across the application
export const Events = {
    // Screen management
    SCREEN_CHANGE: 'screen:change',

    // Game state
    STATE_LOADED: 'state:loaded',
    STATE_SAVED: 'state:saved',
    STATE_RESET: 'state:reset',

    // Player progression
    XP_GAINED: 'player:xp_gained',
    LEVEL_UP: 'player:level_up',
    BADGE_EARNED: 'player:badge_earned',
    MEGAJOULES_CHANGED: 'player:megajoules_changed',

    // Quest system
    QUEST_STARTED: 'quest:started',
    QUEST_OBJECTIVE_COMPLETE: 'quest:objective_complete',
    QUEST_COMPLETED: 'quest:completed',

    // Code execution
    CODE_SUBMITTED: 'code:submitted',
    CODE_SUCCESS: 'code:success',
    CODE_ERROR: 'code:error',
    CODE_OUTPUT: 'code:output',

    // Narrative
    DIALOGUE_START: 'dialogue:start',
    DIALOGUE_ADVANCE: 'dialogue:advance',
    DIALOGUE_END: 'dialogue:end',

    // Bot Buddy
    BUDDY_HINT: 'buddy:hint',
    BUDDY_REACT: 'buddy:react',

    // Audio
    AUDIO_PLAY_SFX: 'audio:play_sfx',
    AUDIO_SET_VOLUME: 'audio:set_volume',

    // Settings
    SETTINGS_CHANGED: 'settings:changed',
};
