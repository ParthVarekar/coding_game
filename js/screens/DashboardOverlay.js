/**
 * DashboardOverlay — Hidden teacher view for Stealth Assessment telemetry.
 * Triggered via Ctrl+Shift+X.
 */
import { TelemetryAnalyzer } from '../utils/TelemetryAnalyzer.js';

export class DashboardOverlay {
    constructor(container, gameState) {
        this.container = container;
        this.gameState = gameState;
        this.analyzer = new TelemetryAnalyzer(gameState);
        this.el = null;
        this.isVisible = false;

        this._bindKeys();
    }

    _bindKeys() {
        window.addEventListener('keydown', (e) => {
            // Ctrl + Shift + D (Using e.code for hardware key detection)
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
                e.preventDefault();
                console.log('[Dashboard] Toggle shortcut detected');
                this.toggle();
            }
        });
    }

    toggle() {
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            this._render();
        } else if (this.el) {
            this.el.classList.remove('active');
            setTimeout(() => {
                if (this.el) this.el.remove();
                this.el = null;
            }, 300);
        }
    }

    _render() {
        if (!this.el) {
            this.el = document.createElement('div');
            this.el.className = 'dashboard-overlay';
            this.container.appendChild(this.el);
        }

        const data = this.analyzer.analyze();

        this.el.innerHTML = `
            <div class="dashboard-panel">
                <div class="dash-header">
                    <h2>👁️ STEALTH ASSESSMENT DASHBOARD</h2>
                    <button class="btn" id="btn-close-dash" style="padding:var(--sp-2) var(--sp-3);">Close (Ctrl+Shift+X)</button>
                </div>

                <div class="dash-grid">
                    <!-- Section 1: The Setup -->
                    <div class="dash-card">
                        <h3>1. The Setup (Overview)</h3>
                        <div class="stat-row">
                            <span class="stat-label">Total Submissions</span>
                            <span class="stat-value">${data.overview.totalSubmissions}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Success Rate</span>
                            <span class="stat-value">${data.overview.successRate}%</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Avg Time/Task</span>
                            <span class="stat-value">${data.overview.avgTimeSec}s</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Total Time Coding</span>
                            <span class="stat-value">${data.overview.totalTimeSec}s</span>
                        </div>
                    </div>

                    <!-- Section 2: The Highlight -->
                    <div class="dash-card">
                        <h3>2. The Highlight (Friction)</h3>
                        
                        <div style="margin-bottom:var(--sp-4);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2);">
                                <span class="stat-label">Error Distribution</span>
                            </div>
                            <!-- Pure CSS Flexbox Chart -->
                            <div class="dist-chart">
                                <div class="dist-bar dist-syntax" style="width:${data.distribution.syntax}%" title="Syntax Errors: ${data.distribution.syntax.toFixed(1)}%"></div>
                                <div class="dist-bar dist-logic" style="width:${data.distribution.logic}%" title="Logic Flaws: ${data.distribution.logic.toFixed(1)}%"></div>
                                <div class="dist-bar dist-runtime" style="width:${data.distribution.runtime}%" title="Runtime Errors: ${data.distribution.runtime.toFixed(1)}%"></div>
                            </div>
                            <div class="dist-legend">
                                <span><span class="legend-dot" style="background:#ef4444;"></span> Syntax</span>
                                <span><span class="legend-dot" style="background:#a855f7;"></span> Logic</span>
                                <span><span class="legend-dot" style="background:#f59e0b;"></span> Runtime</span>
                            </div>
                        </div>

                        <div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2);">
                                <span class="stat-label">Perseverance State</span>
                            </div>
                            <div style="color:${data.perseverance.color}; font-family:var(--font-mono); font-size:1.1rem; text-shadow:0 0 10px ${data.perseverance.color};">
                                ${data.perseverance.status}
                            </div>
                        </div>
                    </div>

                    <!-- Section 3: The Next Step -->
                    <div class="dash-card dash-card-full">
                        <h3>3. The Next Step (Interpretive Support)</h3>
                        <div class="insight-box">
                            <p class="insight-text">${data.interpretive.insight}</p>
                            <p class="insight-action"><strong>Next Step:</strong> ${data.interpretive.nextStep}</p>
                        </div>
                    </div>
                </div>

                <div class="dash-footer">
                    <button class="btn" id="btn-mock-data">Inject Mock Data (Testing)</button>
                    <button class="btn btn-danger" id="btn-clear-data">Clear Telemetry</button>
                </div>
            </div>
        `;

        // Trigger animation
        requestAnimationFrame(() => {
            this.el.classList.add('active');
        });

        // Binds
        this.el.querySelector('#btn-close-dash').addEventListener('click', () => this.toggle());
        
        this.el.querySelector('#btn-mock-data').addEventListener('click', () => {
            // Inject fake struggle data
            this.gameState.data.stealthAssessment.submissions.total += 12;
            this.gameState.data.stealthAssessment.submissions.successful += 2;
            this.gameState.data.stealthAssessment.timeSpentMs += 120000; // 2 mins
            this.gameState.data.stealthAssessment.errors['SyntaxError'] = (this.gameState.data.stealthAssessment.errors['SyntaxError'] || 0) + 2;
            this.gameState.data.stealthAssessment.concepts.loops = (this.gameState.data.stealthAssessment.concepts.loops || 0) + 8; // Heavy logic flaws
            this.gameState.save();
            this._render(); // Refresh
        });

        this.el.querySelector('#btn-clear-data').addEventListener('click', () => {
            this.gameState.data.stealthAssessment = {
                submissions: { total: 0, successful: 0 },
                errors: {},
                concepts: { loops: 0, variables: 0 },
                timeSpentMs: 0
            };
            this.gameState.save();
            this._render();
        });
    }
}
