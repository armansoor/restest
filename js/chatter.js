import { eventBus } from './eventBus.js';
import { game } from './game.js';
import { Random } from './utils/random.js';

export const chatter = {
    init: function() {
        eventBus.on('stateUpdate', (state) => {
            this.handleState(state);
        });

        eventBus.on('voteResults', (results) => {
            this.handleVoteResults(results);
        });

        eventBus.on('logFail', () => {
            this.handleMissionEnd(false);
        });

        eventBus.on('logSuccess', () => {
            this.handleMissionEnd(true);
        });
    },

    handleState: function(state) {
        // Occasionally chat during proposal phase
        if (state.phase === 'propose' && Math.random() > 0.8) {
            let leader = game.players[state.leaderIndex];
            if (!leader.isHuman) {
                // If bot is leader, maybe say something?
            } else {
                // If human is leader, bots comment
                this.emitBotChat("waiting_proposal");
            }
        }
    },

    handleVoteResults: function(results) {
        // Comment on the vote outcome
        let rejects = results.filter(r => !r.approve).length;
        if (rejects > 0) {
            this.emitBotChat("vote_rejected");
        } else {
            this.emitBotChat("vote_approved");
        }
    },

    handleMissionEnd: function(success) {
        if (success) {
            this.emitBotChat("mission_success");
        } else {
            this.emitBotChat("mission_fail");
        }
    },

    emitBotChat: function(type) {
        // Pick a random bot
        let bots = game.players.filter(p => !p.isHuman);
        if(bots.length === 0) return;

        let bot = Random.pick(bots);
        let msg = this.getLine(type, bot.role);

        if (msg) {
            eventBus.emit('chatMessage', { sender: bot.name, msg: msg, isBot: true });
        }
    },

    getLine: function(type, role) {
        const lines = {
            "waiting_proposal": [
                "Pick a clean team, leader.",
                "Don't pick me if you're a spy.",
                "I'm ready to go.",
                "Trust the process."
            ],
            "vote_rejected": [
                "Too risky.",
                "I didn't trust that team.",
                "We can do better.",
                "Why reject? That was a good team."
            ],
            "vote_approved": [
                "Let's do this.",
                "Good luck team.",
                "Hope this works.",
                "We need this win."
            ],
            "mission_success": [
                "Yes!",
                "Resistance is winning.",
                "Clean team confirmed.",
                "Good job."
            ],
            "mission_fail": [
                "There is a spy among us.",
                "We were betrayed.",
                "I knew it.",
                "Who sabotaged?"
            ]
        };

        let pool = lines[type];
        if (!pool) return null;

        // Potential for role-specific lines later
        return Random.pick(pool);
    }
};
