/**
 * GameState — Central state management for all player data.
 * Handles XP, leveling, badges, quests, inventory, megajoules,
 * and serialization to/from localStorage.
 */
import { Events } from '../utils/EventBus.js';

// XP required per level (exponential curve)
const XP_TABLE = Array.from({ length: 100 }, (_, i) => Math.floor(100 * Math.pow(1.25, i)));

// All achievable badges in Phase 1
const BADGE_DEFINITIONS = {
    first_code: {
        id: 'first_code',
        name: 'Hello, World!',
        description: 'Execute your first line of Python code.',
        icon: '⚡',
        phase: 1
    },
    variable_master: {
        id: 'variable_master',
        name: 'Memory Allocator',
        description: 'Successfully define and use all 4 basic data types.',
        icon: '🧬',
        phase: 1
    },
    loop_warrior: {
        id: 'loop_warrior',
        name: 'Loop Warrior',
        description: 'Complete all loop-based challenges without any infinite loop errors.',
        icon: '🔄',
        phase: 1
    },
    data_architect: {
        id: 'data_architect',
        name: 'Data Architect',
        description: 'Master lists, tuples, dictionaries, and sets.',
        icon: '🏗️',
        phase: 1
    },
    function_engineer: {
        id: 'function_engineer',
        name: 'Function Engineer',
        description: 'Write and use 10 custom functions.',
        icon: '⚙️',
        phase: 1
    },
    bug_hunter: {
        id: 'bug_hunter',
        name: 'Bug Hunter',
        description: 'Successfully handle 5 different exception types with try/except.',
        icon: '🐛',
        phase: 1
    },
    maze_runner: {
        id: 'maze_runner',
        name: 'Maze Runner',
        description: 'Defeat the Automaton Maze boss battle.',
        icon: '🏆',
        phase: 1
    },
    speed_coder: {
        id: 'speed_coder',
        name: 'Speed Coder',
        description: 'Complete any challenge in under 60 seconds.',
        icon: '⏱️',
        phase: 1
    },
    perfectionist: {
        id: 'perfectionist',
        name: 'Zero Errors',
        description: 'Complete 5 challenges in a row with no syntax errors.',
        icon: '✨',
        phase: 1
    },
    explorer: {
        id: 'explorer',
        name: 'Explorer',
        description: 'Discover all hidden terminals in the Supply Depot.',
        icon: '🔍',
        phase: 1
    }
};

function createDefaultState() {
    return {
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),

        // Player profile
        player: {
            name: 'Engineer',
            xp: 0,
            level: 1,
            title: 'Novice Systems Engineer',
        },

        // Progression
        currentPhase: 1,
        currentLesson: 0,     // Index within phase
        currentChallenge: 0,  // Index within lesson

        // Megajoules — overall progress meter
        megajoules: 0,
        megajoulesRequired: 1000, // To unlock Phase 2

        // Quest tracking
        activeQuests: [],
        completedQuests: [],

        // Badges / Achievements
        earnedBadges: [],

        // Inventory / Power-ups
        inventory: [],

        // Stealth assessment telemetry
        stealthAssessment: {
            submissions: { total: 0, successful: 0 },
            errors: {},         // { "SyntaxError": count, etc. }
            concepts: { loops: 0, variables: 0, conditionals: 0, math: 0 },
            timeSpentMs: 0,
            challengeAttempts: {},  // { challengeId: attemptCount }
            challengeTimes: {},    // { challengeId: timeMs }
        },

        // Settings
        settings: {
            masterVolume: 0.7,
            sfxVolume: 0.8,
            musicVolume: 0.5,
            difficulty: 'normal', // easy, normal, hard
            theme: 'dark',
            fontSize: 14,
        },

        // Narrative flags
        storyFlags: {},

        // Bot Buddy state
        buddyMood: 'neutral', // neutral, happy, thinking, worried

        // Completed Challenge IDs
        completedChallenges: []
    };
}

export class GameState {
    /**
     * @param {import('../utils/EventBus.js').EventBus} eventBus
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.data = createDefaultState();
        this._saveKey = 'nexus_ai_save';

        // Listen for challenge success
        this.eventBus.on(Events.CODE_SUCCESS, (data) => {
            if (data && data.challengeId) {
                this.completeChallenge(data.challengeId);
            }
        });

        this.load();
    }

    /**
     * Mark a challenge as completed.
     * @param {string} id 
     */
    completeChallenge(id) {
        if (!this.data.completedChallenges.includes(id)) {
            this.data.completedChallenges.push(id);
            this.save(); // Note: method is named save(), not _save()
        }
    }

    /**
     * Check if a challenge is completed.
     * @param {string} id 
     * @returns {boolean}
     */
    isChallengeCompleted(id) {
        return this.data.completedChallenges.includes(id);
    }

    // ─── Persistence ──────────────────────────────────────────

    /**
     * Save current state to localStorage.
     */
    save() {
        try {
            this.data.updatedAt = Date.now();
            const serialized = JSON.stringify(this.data);
            localStorage.setItem(this._saveKey, serialized);
            this.eventBus.emit(Events.STATE_SAVED, { timestamp: this.data.updatedAt });
            return true;
        } catch (err) {
            console.error('[GameState] Save failed:', err);
            return false;
        }
    }

    /**
     * Load state from localStorage. Returns true if a save was found.
     */
    load() {
        try {
            const serialized = localStorage.getItem(this._saveKey);
            if (!serialized) return false;

            const loaded = JSON.parse(serialized);

            // Version migration hook
            if (loaded.version < this.data.version) {
                this._migrate(loaded);
            }

            this.data = { ...createDefaultState(), ...loaded };
            this.eventBus.emit(Events.STATE_LOADED, this.data);
            return true;
        } catch (err) {
            console.error('[GameState] Load failed:', err);
            return false;
        }
    }

    /**
     * Check if a save exists.
     */
    hasSave() {
        return localStorage.getItem(this._saveKey) !== null;
    }

    /**
     * Reset to defaults.
     */
    reset() {
        this.data = createDefaultState();
        localStorage.removeItem(this._saveKey);
        this.eventBus.emit(Events.STATE_RESET);
    }

    /**
     * Export save as downloadable JSON.
     */
    exportSave() {
        const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexus_ai_save_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import save from JSON file.
     * @param {File} file
     */
    async importSave(file) {
        const text = await file.text();
        const loaded = JSON.parse(text);
        this.data = { ...createDefaultState(), ...loaded };
        this.save();
        this.eventBus.emit(Events.STATE_LOADED, this.data);
    }

    // ─── XP & Leveling ───────────────────────────────────────

    /**
     * Award XP and check for level ups.
     * @param {number} amount
     * @param {string} reason
     */
    addXP(amount, reason = '') {
        const prevLevel = this.data.player.level;
        this.data.player.xp += amount;

        // Check for level up
        while (
            this.data.player.level < XP_TABLE.length &&
            this.data.player.xp >= this.getXPForNextLevel()
        ) {
            this.data.player.level++;
            this._updateTitle();
            this.eventBus.emit(Events.LEVEL_UP, {
                level: this.data.player.level,
                title: this.data.player.title,
            });
        }

        this.eventBus.emit(Events.XP_GAINED, {
            amount,
            reason,
            totalXP: this.data.player.xp,
            level: this.data.player.level,
        });

        this.save();
    }

    /**
     * Get XP required for next level.
     */
    getXPForNextLevel() {
        return XP_TABLE[this.data.player.level - 1] || Infinity;
    }

    /**
     * Get current level progress as 0-1.
     */
    getLevelProgress() {
        const currentLevelXP = this.data.player.level > 1
            ? XP_TABLE[this.data.player.level - 2]
            : 0;
        const nextLevelXP = this.getXPForNextLevel();
        const progress = (this.data.player.xp - currentLevelXP) / (nextLevelXP - currentLevelXP);
        return Math.min(1, Math.max(0, progress));
    }

    _updateTitle() {
        const level = this.data.player.level;
        if (level >= 20) this.data.player.title = 'Lead Systems Architect';
        else if (level >= 15) this.data.player.title = 'Senior Systems Engineer';
        else if (level >= 10) this.data.player.title = 'Systems Engineer';
        else if (level >= 5) this.data.player.title = 'Junior Systems Engineer';
        else this.data.player.title = 'Novice Systems Engineer';
    }

    // ─── Megajoules ──────────────────────────────────────────

    /**
     * Add megajoules (phase progression energy).
     * @param {number} amount
     */
    addMegajoules(amount) {
        this.data.megajoules += amount;
        this.eventBus.emit(Events.MEGAJOULES_CHANGED, {
            current: this.data.megajoules,
            required: this.data.megajoulesRequired,
            progress: this.getMegajoulesProgress(),
        });
        this.save();
    }

    getMegajoulesProgress() {
        return Math.min(1, this.data.megajoules / this.data.megajoulesRequired);
    }

    // ─── Badges ──────────────────────────────────────────────

    /**
     * Award a badge if not already earned.
     * @param {string} badgeId
     */
    earnBadge(badgeId) {
        if (this.data.earnedBadges.includes(badgeId)) return false;

        const def = BADGE_DEFINITIONS[badgeId];
        if (!def) {
            console.warn(`[GameState] Unknown badge: ${badgeId}`);
            return false;
        }

        this.data.earnedBadges.push(badgeId);
        this.eventBus.emit(Events.BADGE_EARNED, def);
        this.save();
        return true;
    }

    hasBadge(badgeId) {
        return this.data.earnedBadges.includes(badgeId);
    }

    getAllBadgeDefinitions() {
        return BADGE_DEFINITIONS;
    }

    // ─── Telemetry (Stealth Assessment) ─────────────────────

    /**
     * Record a code submission for stealth assessment.
     * @param {{ challengeId: string, success: boolean, errorType: string|null, timeMs: number }}
     */
    recordSubmission({ challengeId, success, errorType, timeMs }) {
        const t = this.data.stealthAssessment;
        t.submissions.total++;

        if (success) {
            t.submissions.successful++;
        } else if (errorType) {
            t.errors[errorType] = (t.errors[errorType] || 0) + 1;
        }

        t.timeSpentMs += timeMs;

        if (challengeId) {
            t.challengeAttempts[challengeId] = (t.challengeAttempts[challengeId] || 0) + 1;
            if (success && !t.challengeTimes[challengeId]) {
                t.challengeTimes[challengeId] = timeMs;
            }
        }

        this.save();
    }

    /**
     * Get a difficulty recommendation based on telemetry.
     * @returns {'easier'|'same'|'harder'}
     */
    getDifficultyRecommendation() {
        const t = this.data.stealthAssessment;
        if (t.submissions.total < 5) return 'same';

        const successRate = t.submissions.successful / t.submissions.total;
        if (successRate < 0.3) return 'easier';
        if (successRate > 0.8) return 'harder';
        return 'same';
    }

    // ─── Quests ──────────────────────────────────────────────

    startQuest(quest) {
        this.data.activeQuests.push(quest);
        this.eventBus.emit(Events.QUEST_STARTED, quest);
        this.save();
    }

    completeQuest(questId) {
        const idx = this.data.activeQuests.findIndex(q => q.id === questId);
        if (idx >= 0) {
            const quest = this.data.activeQuests.splice(idx, 1)[0];
            quest.completedAt = Date.now();
            this.data.completedQuests.push(quest);
            this.eventBus.emit(Events.QUEST_COMPLETED, quest);
            this.save();
        }
    }

    // ─── Settings ────────────────────────────────────────────

    updateSettings(partial) {
        Object.assign(this.data.settings, partial);
        this.eventBus.emit(Events.SETTINGS_CHANGED, this.data.settings);
        this.save();
    }

    // ─── Story Flags ─────────────────────────────────────────

    setStoryFlag(key, value = true) {
        this.data.storyFlags[key] = value;
        this.save();
    }

    getStoryFlag(key) {
        return this.data.storyFlags[key] || false;
    }

    // ─── Migration ───────────────────────────────────────────

    _migrate(oldData) {
        // Future version migration logic
        console.log(`[GameState] Migrating save from v${oldData.version} to v${this.data.version}`);
    }
}
