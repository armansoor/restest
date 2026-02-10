import { ui } from './ui.js';
import { game } from './game.js';
import { GAME_MATRIX } from './constants.js';
import { Random } from './utils/random.js';

export const ai = {
    suspects: {}, // Higher number = more suspicious

    recordMission: function(teamIds, success) {
        const difficulty = game.difficulty;
        let suspicionIncrease = 10;
        let trustIncrease = 2;

        if (difficulty === 'hard') {
            suspicionIncrease = 20; // Hard bots get very suspicious
            trustIncrease = 1; // Hard bots are slow to trust
        }

        if(!success) {
            teamIds.forEach(id => {
                if(!this.suspects[id]) this.suspects[id] = 0;
                this.suspects[id] += suspicionIncrease;
            });
        } else {
            // Slight trust increase if mission succeeds
            teamIds.forEach(id => {
                if(this.suspects[id] > 0) this.suspects[id] -= trustIncrease;
            });
        }
    },

    botProposeTeam: function() {
        let me = game.players[game.leaderIndex];
        let teamSize = GAME_MATRIX[game.players.length].missions[game.currentMissionIndex];
        let team = [me.id];

        const difficulty = game.difficulty;

        if (difficulty === 'easy') {
            // EASY: Pure Random
            let others = game.players.filter(p => p.id !== me.id);
            Random.shuffle(others);
            for(let i=0; i < teamSize - 1; i++) {
                team.push(others[i].id);
            }
        } else if (me.role === 'spy') {
            // SPY STRATEGY (Medium/Hard)
            let otherSpies = game.players.filter(p => p.role === 'spy' && p.id !== me.id);
            let innocents = game.players.filter(p => p.role !== 'spy' && p.id !== me.id);

            while(team.length < teamSize) {
                // If Hard mode, try to slip 1 spy in with innocents
                if(difficulty === 'hard' && otherSpies.length > 0 && team.filter(id => game.players[id].role === 'spy').length < 2) {
                    team.push(otherSpies.pop().id);
                } else if (innocents.length > 0) {
                    let r = Math.floor(Math.random() * innocents.length);
                    team.push(innocents[r].id);
                    innocents.splice(r, 1);
                } else {
                     // Fallback
                     let remaining = game.players.filter(p => !team.includes(p.id));
                     team.push(remaining[0].id);
                }
            }
        } else {
            // RESISTANCE STRATEGY (Medium/Hard)
            // Pick players with lowest suspicion score
            let candidates = game.players.filter(p => p.id !== me.id);

            if (difficulty === 'hard') {
                candidates.sort((a,b) => (this.suspects[a.id]||0) - (this.suspects[b.id]||0));
            } else {
                // Medium: some randomness in trust
                Random.shuffle(candidates); // Slight shuffle before sort not really effective, but basic
                // Let's just pick randomly from the top half of trusted players?
                // Or just use standard logic for Medium as it was "Normal".
                candidates.sort((a,b) => (this.suspects[a.id]||0) - (this.suspects[b.id]||0));
            }

            for(let i=0; i < teamSize -1; i++) {
                team.push(candidates[i].id);
            }
        }
        game.submitTeam(team);
    },

    botVote: function(bot) {
        const difficulty = game.difficulty;

        if (difficulty === 'easy') {
            // Random vote
            return Math.random() > 0.5;
        }

        if(bot.role === 'spy') {
            // Approve if spy is on team
            let spiesOnTeam = game.proposedTeam.filter(id => game.players[id].role === 'spy').length;

            if (difficulty === 'hard') {
                // Bluff: sometimes approve clean teams to look good
                if(spiesOnTeam === 0 && Math.random() > 0.6) return true;
            }

            return spiesOnTeam > 0;
        }

        // RESISTANCE LOGIC
        let suspicionScore = 0;
        game.proposedTeam.forEach(id => {
            suspicionScore += (this.suspects[id] || 0);
        });

        // Always approve Mission 1 (Standard Meta)
        if(game.currentMissionIndex === 0 && difficulty !== 'easy') return true;

        // Counter-Block
        let threshold = difficulty === 'hard' ? 5 : 8; // Hard is stricter
        if(suspicionScore > threshold) return false;

        return true;
    },

    botMissionAction: function(bot) {
        if(bot.role === 'resistance') return false;

        // SPY LOGIC
        const difficulty = game.difficulty;

        if (difficulty === 'easy') {
            // Randomly fail or support
            return Math.random() > 0.5;
        }

        if(difficulty === 'hard') {
            // If we are at 2 losses, KILL IT
            let losses = game.missionHistory.filter(x => !x).length;
            if(losses === 2) return true;

            // Check if another spy is on the team
            let otherSpiesOnTeam = game.proposedTeam
                .filter(id => id !== bot.id)
                .map(id => game.players[id])
                .filter(p => p.role === 'spy').length;

            // If another spy is on team, 50% chance to let them handle it to avoid double-fail
            if (otherSpiesOnTeam > 0 && Math.random() > 0.5) return false;

            // If it's early, maybe bluff?
            if(game.currentMissionIndex < 2 && Math.random() > 0.4) return false;
        }

        // Medium/Normal: Just fail usually
        return true;
    }
};
