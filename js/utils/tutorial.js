import { game } from '../game.js';

export const Tutorial = {
    hasRun: false,

    start: function() {
        // Simple check to ensure we only run once per session unless reset
        if (this.hasRun) return;

        // Check if Intro.js is loaded
        if (typeof introJs === 'undefined') return;

        setTimeout(() => {
            // Only show tutorial if there is a 'tutorial' query param or user explicitly asked?
            // Or better, check localStorage but allow user to reset.
            if(localStorage.getItem('tutorial_done')) return;

            const intro = introJs();
            intro.setOptions({
                steps: [
                    {
                        intro: "Welcome to The Resistance! Let's get you briefed on your mission."
                    },
                    {
                        element: '#mission-track',
                        intro: "This is the Mission Track. Resistance needs 3 Successes (Blue) to win. Spies need 3 Failures (Red)."
                    },
                    {
                        element: '#player-grid',
                        intro: "These are the Operatives. One of them is the LEADER (Yellow Border)."
                    },
                    {
                        element: '#action-area',
                        intro: "The Leader will propose a team here. Everyone votes on that team."
                    }
                ],
                showStepNumbers: false,
                exitOnOverlayClick: true
            });

            intro.start();

            intro.oncomplete(() => {
                this.hasRun = true;
                localStorage.setItem('tutorial_done', 'true');
            });

            intro.onexit(() => {
                this.hasRun = true;
                localStorage.setItem('tutorial_done', 'true');
            });
        }, 1000); // Wait for UI to render
    }
};
