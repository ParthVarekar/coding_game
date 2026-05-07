/**
 * ToastManager — Handles toast notifications for XP gains,
 * badge unlocks, errors, and general info messages.
 */
export class ToastManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    /**
     * Show a toast notification.
     * @param {string} message
     * @param {'success'|'error'|'info'|'badge'} type
     * @param {number} duration - ms before auto-dismiss
     */
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Show a badge unlock toast with icon.
     * @param {{ icon: string, name: string, description: string }} badge
     */
    showBadge(badge) {
        const toast = document.createElement('div');
        toast.className = 'toast toast--badge';
        toast.innerHTML = `
            <span style="font-size:1.6em;">${badge.icon}</span>
            <div>
                <div style="font-weight:600;color:var(--purple);">Badge Unlocked!</div>
                <div style="font-size:0.85rem;">${badge.name}</div>
            </div>
        `;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Show an XP gain toast.
     * @param {number} amount
     * @param {string} reason
     */
    showXP(amount, reason) {
        this.show(`+${amount} XP — ${reason}`, 'success', 2500);
    }
}
