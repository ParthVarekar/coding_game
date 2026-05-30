/**
 * CurriculumLoader — Fetches and manages the JSON curriculum of Python challenges.
 * This class abstracts the loading and retrieval of educational content, decoupling
 * the narrative text and code validation rules from the core game engine.
 */
export class CurriculumLoader {
    constructor(contentSource = 'official') {
        /** @type {Map<string, Object>} Stores all challenges mapped by their unique ID */
        this.challenges = new Map();
        /** @type {boolean} Indicates if the curriculum JSON has successfully loaded */
        this.isLoaded = false;
        this.contentSource = contentSource;
    }

    /**
     * Asynchronously fetches the curriculum.json file and populates the challenges map.
     * Should be called during the GameScreen initialization phase.
     * @returns {Promise<void>}
     */
    async init() {
        try {
            const data = this.contentSource === 'custom'
                ? this._loadCustomCurriculum()
                : await this._fetchOfficialCurriculum();
            
            this.challenges.clear();
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

    async _fetchOfficialCurriculum() {
        const response = await fetch('./data/curriculum.json');
        if (!response.ok) throw new Error('Failed to load curriculum.json');
        return response.json();
    }

    _loadCustomCurriculum() {
        const campaignSerialized = localStorage.getItem('nexus_ai_user_campaign')
            || localStorage.getItem('user_campaign.json');
        if (campaignSerialized) {
            try {
                const campaign = JSON.parse(campaignSerialized);
                if (Array.isArray(campaign.levels) && campaign.levels.length) {
                    const byId = new Map();
                    campaign.levels.forEach((level) => {
                        (level.curriculumData?.challenges || []).forEach((challenge) => {
                            if (challenge?.id) byId.set(challenge.id, challenge);
                        });
                    });
                    return { challenges: Array.from(byId.values()) };
                }
            } catch (error) {
                console.warn('[CurriculumLoader] Failed to parse custom campaign:', error);
            }
        }

        const serialized = localStorage.getItem('nexus_ai_user_curriculum')
            || localStorage.getItem('user_curriculum.json');
        if (!serialized) throw new Error('No custom curriculum saved in localStorage');
        return JSON.parse(serialized);
    }
}
