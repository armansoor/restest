import { ui } from './ui.js';
import { game } from './game.js';
import { GAME_MATRIX } from './constants.js';

export const ai = {
    suspects: {}, // Higher number = more suspicious

    recordMission: function(teamIds, success) {
        if(!success) {
            teamIds.forEach(id => {
                if(!this.suspects[id]) this.suspects[id] = 0;
                this.suspects[id] += 10; // Major suspicion increase
            });
        } else {
            // Slight trust increase if mission succeeds
            teamIds.forEach(id => {
                if(this.suspects[id] > 0) this.suspects[id] -= 2;
            });
        }
    },

    botProposeTeam: function() {
        let me = game.players[game.leaderIndex];
        let teamSize = GAME_MATRIX[game.players.length].missions[game.currentMissionIndex];
        let team = [me.id];

        if(me.role === 'spy') {
            // SPY STRATEGY
            let otherSpies = game.players.filter(p => p.role === 'spy' && p.id !== me.id);
            let innocents = game.players.filter(p => p.role !== 'spy' && p.id !== me.id);

            while(team.length < teamSize) {
                // If Hard mode, try to slip 1 spy in with innocents
                // If Normal, randomly pick
                if(game.difficulty === 'hard' && otherSpies.length > 0 && team.filter(id => game.players[id].role === 'spy').length < 2) {
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
            // RESISTANCE STRATEGY
            // Pick players with lowest suspicion score
            let candidates = game.players.filter(p => p.id !== me.id);
            candidates.sort((a,b) => (this.suspects[a.id]||0) - (this.suspects[b.id]||0));

            for(let i=0; i < teamSize -1; i++) {
                team.push(candidates[i].id);
            }
        }
        game.submitTeam(team);
    },

    botVote: function(bot) {
        if(bot.role === 'spy') {
            // Approve if spy is on team
            let spiesOnTeam = game.proposedTeam.filter(id => game.players[id].role === 'spy').length;
            // Bluff: sometimes approve clean teams to look good
            if(spiesOnTeam === 0 && game.difficulty === 'hard' && Math.random() > 0.6) return true;
            return spiesOnTeam > 0;
        }

        // RESISTANCE LOGIC
        let suspicionScore = 0;
        game.proposedTeam.forEach(id => {
            suspicionScore += (this.suspects[id] || 0);
        });

        // Always approve Mission 1
        if(game.currentMissionIndex === 0) return true;

        // Hard Counter-Block
        if(suspicionScore > 5) return false;
        return true;
    },

    botMissionAction: function(bot) {
        if(bot.role === 'resistance') return false;

        // SPY LOGIC
        if(game.difficulty === 'hard') {
            // If we are at 2 losses, KILL IT
            let losses = game.missionHistory.filter(x => !x).length;
            if(losses === 2) return true;

            // If it's early, maybe bluff?
            if(game.currentMissionIndex < 2 && Math.random() > 0.4) return false;
        }
        return true;
    }
};
