/**
 * CurriculumLoader — Fetches and manages the JSON curriculum of Python challenges.
 * This class abstracts the loading and retrieval of educational content, decoupling
 * the narrative text and code validation rules from the core game engine.
 */
export class CurriculumLoader {
    constructor() {
        /** @type {Map<string, Object>} Stores all challenges mapped by their unique ID */
        this.challenges = new Map();
        /** @type {boolean} Indicates if the curriculum JSON has successfully loaded */
        this.isLoaded = false;
    }

    /**
     * Asynchronously fetches the curriculum.json file and populates the challenges map.
     * Should be called during the GameScreen initialization phase.
     * @returns {Promise<void>}
     */
    async init() {
        try {
            const response = await fetch('./data/curriculum.json');
            if (!response.ok) throw new Error('Failed to load curriculum.json');
            const data = await response.json();
            
            for (const challenge of data.challenges) {
                this.challenges.set(challenge.id, challenge);
            }
            this.isLoaded = true;
            console.log(`[CurriculumLoader] Loaded ${this.challenges.size} challenges.`);
        } catch (e) {
            console.error('[CurriculumLoader] Error loading curriculum:', e);
        }
    }

    /**
     * Retrieves a specific challenge object by its ID.
     * @param {string} id - The unique identifier of the challenge (e.g., 'challenge_1')
     * @returns {Object|null} The challenge configuration object, or null if not found.
     */
    getChallenge(id) {
        if (!this.isLoaded) return null;
        return this.challenges.get(id) || null;
    }
}
