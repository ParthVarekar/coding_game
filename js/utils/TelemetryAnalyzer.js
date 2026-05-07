/**
 * TelemetryAnalyzer — Processes raw GameState stealth assessment data into
 * actionable, pedagogical insights for the Teacher Dashboard.
 * 
 * This module follows data design best practices by providing "Interpretive Support"
 * rather than just raw telemetry numbers, helping educators make immediate decisions.
 */
export class TelemetryAnalyzer {
    /**
     * @param {Object} gameState - Reference to the global GameState manager.
     */
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Generates a comprehensive insight report based on current stealth assessment data.
     * Evaluates error distributions (Syntax vs Logic) and time-on-task to calculate
     * the student's Perseverance Status and provide actionable Next Steps.
     * 
     * @returns {Object} An analyzed data object containing:
     *   - overview: Basic engagement metrics (submissions, time, success rate)
     *   - distribution: Percentages of error types
     *   - perseverance: Calculated emotional/engagement state (e.g., 'Productive Struggle')
     *   - interpretive: Narrative insights and recommended pedagogical next steps
     */
    analyze() {
        const d = this.gameState.data.stealthAssessment;
        
        const totalSubmissions = d.submissions.total;
        const successRate = totalSubmissions > 0 ? (d.submissions.successful / totalSubmissions) * 100 : 0;
        
        // Aggregate Error Types
        let totalErrors = 0;
        let syntaxErrors = 0;
        let runtimeErrors = 0;
        
        for (const [type, count] of Object.entries(d.errors)) {
            totalErrors += count;
            if (type.includes('SyntaxError') || type.includes('IndentationError')) {
                syntaxErrors += count;
            } else {
                runtimeErrors += count;
            }
        }
        
        // Logic flaws (tracked separately in concepts)
        const logicErrors = d.concepts.loops || 0;
        totalErrors += logicErrors; // Treat caught logic flaws as errors for the dashboard
        
        // Calculate percentages for the distribution bar chart
        const errorDist = {
            syntax: totalErrors > 0 ? (syntaxErrors / totalErrors) * 100 : 0,
            runtime: totalErrors > 0 ? (runtimeErrors / totalErrors) * 100 : 0,
            logic: totalErrors > 0 ? (logicErrors / totalErrors) * 100 : 0
        };

        // Perseverance / Engagement
        const avgTimeMs = totalSubmissions > 0 ? d.timeSpentMs / totalSubmissions : 0;
        const avgTimeSec = Math.round(avgTimeMs / 1000);
        
        let perseveranceStatus = "Neutral";
        let perseveranceColor = "var(--cyan)";
        
        // Productive struggle: high errors, high time, still trying
        // Genuine frustration: high errors, very low time between attempts (button mashing)
        if (totalErrors > 5 && avgTimeSec > 30) {
            perseveranceStatus = "Productive Struggle";
            perseveranceColor = "var(--success)";
        } else if (totalErrors > 5 && avgTimeSec < 10) {
            perseveranceStatus = "Frustrated / Guessing";
            perseveranceColor = "var(--error)";
        } else if (totalSubmissions > 0 && totalErrors <= 2) {
            perseveranceStatus = "Smooth Progress";
            perseveranceColor = "var(--cyan)";
        }

        // Actionable Insights (Interpretive Support)
        let insight = "Awaiting sufficient data to generate insights.";
        let nextStep = "Continue monitoring student progress.";

        if (totalSubmissions > 3) {
            if (logicErrors > syntaxErrors && logicErrors > runtimeErrors) {
                insight = "Student grasps Python syntax but is struggling with algorithmic loop logic (e.g., off-by-one errors).";
                nextStep = "Provide a whiteboard flowchart exercise to visualize loop iterations before returning to the keyboard.";
            } else if (syntaxErrors > runtimeErrors && syntaxErrors > logicErrors) {
                if (avgTimeSec < 15) {
                    insight = "Student is experiencing high syntax friction and attempting rapid, guess-and-check solutions.";
                    nextStep = "Intervene. Ask the student to slow down and explain what a colon ':' or indentation does in Python.";
                } else {
                    insight = "Student is working carefully but struggling to remember exact Python syntax rules.";
                    nextStep = "Provide a quick-reference syntax cheat sheet for loops and conditionals.";
                }
            } else if (totalErrors === 0 || successRate > 80) {
                insight = "Student is excelling and completing challenges with minimal friction.";
                nextStep = "Introduce advanced modifiers to the current puzzle or unlock the next phase early.";
            } else {
                insight = "Student is encountering a mix of runtime exceptions.";
                nextStep = "Review variable scope and data types (NameError, TypeError) together.";
            }
        }

        return {
            overview: {
                totalSubmissions,
                successRate: Math.round(successRate),
                totalTimeSec: Math.round(d.timeSpentMs / 1000),
                avgTimeSec
            },
            distribution: errorDist,
            perseverance: {
                status: perseveranceStatus,
                color: perseveranceColor
            },
            interpretive: {
                insight,
                nextStep
            }
        };
    }
}
