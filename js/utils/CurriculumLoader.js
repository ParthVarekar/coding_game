/**
 * CurriculumLoader — Fetches and manages the JSON curriculum of Python challenges.
 */
export class CurriculumLoader {
    constructor() {
        this.challenges = new Map();
        this.isLoaded = false;
    }

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

    getChallenge(id) {
        if (!this.isLoaded) return null;
        return this.challenges.get(id) || null;
    }
}
