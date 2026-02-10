import { GAME_MATRIX } from './constants.js';
import { ai } from './ai.js';
import { ui } from './ui.js';
import { turnManager } from './turnManager.js';

export const game = {
    players: [],
    missionHistory: [], // [true, false, true...]
    currentMissionIndex: 0,
    voteTrack: 0, // 5 rejected votes = spies win round
    leaderIndex: 0,
    difficulty: 'normal',
    phase: 'setup',
    proposedTeam: [],

    init: function() {
        const totalP = parseInt(document.getElementById('setup-players').value);
        const humanP = parseInt(document.getElementById('setup-humans').value);
        this.difficulty = document.getElementById('setup-difficulty').value;

        // Reset State
        this.players = [];
        this.missionHistory = [];
        this.currentMissionIndex = 0;
        this.voteTrack = 0;
        this.leaderIndex = Math.floor(Math.random() * totalP);
        this.proposedTeam = [];

        // Create Roles
        let spyCount = GAME_MATRIX[totalP].spies;
        let roles = Array(totalP).fill('resistance');
        for(let i=0; i<spyCount; i++) roles[i] = 'spy';
        roles = this.shuffle(roles);

        // Create Players
        for(let i=0; i<totalP; i++) {
            this.players.push({
                id: i,
                role: roles[i],
                isHuman: i < humanP,
                name: i < humanP ? `Player ${i+1} (YOU)` : `Bot ${i+1}`,
                suspicion: 0
            });
        }

        ui.initGameScreen(totalP);
        this.startRound();
    },

    shuffle: function(array) {
        return array.sort(() => Math.random() - 0.5);
    },

    startRound: function() {
        this.phase = 'propose';
        this.proposedTeam = [];
        ui.renderBoard();

        let currentLeader = this.players[this.leaderIndex];
        ui.log(`--- Mission ${this.currentMissionIndex + 1} Start ---`);
        ui.log(`Leader is ${currentLeader.name}. Vote Track: ${this.voteTrack}/5`);

        // If Leader is Bot, make them propose immediately
        if(!currentLeader.isHuman) {
            setTimeout(() => ai.botProposeTeam(), 1200);
        } else {
            ui.updateActionArea('propose');
        }
    },

    submitTeam: function(teamIds) {
        this.proposedTeam = teamIds;
        ui.log(`Leader proposed: ${teamIds.map(id => game.players[id].name).join(', ')}`);
        this.phase = 'vote';
        ui.renderBoard();
        this.runVotingPhase();
    },

    runVotingPhase: function() {
        let votes = [];

        // AI Votes instantly
        this.players.forEach(p => {
            if(!p.isHuman) {
                votes.push({ id: p.id, approve: ai.botVote(p) });
            }
        });

        let humanVoters = this.players.filter(p => p.isHuman);

        if(humanVoters.length > 0) {
            // Start Turn Manager for Humans
            ui.updateActionArea('vote_pending');
            turnManager.start(humanVoters, 'vote', (humanVotes) => {
                let allVotes = votes.concat(humanVotes);
                game.resolveVotes(allVotes);
            }, []);
        } else {
            this.resolveVotes(votes);
        }
    },

    resolveVotes: function(votes) {
        let approves = votes.filter(v => v.approve).length;
        let rejects = votes.filter(v => !v.approve).length;

        let resultString = votes.map(v => {
            let pName = game.players[v.id].name;
            return `${pName}: ${v.approve ? '<span class="log-good">YES</span>' : '<span class="log-bad">NO</span>'}`;
        }).join('<br>');

        ui.log(`Votes:<br>${resultString}`);

        if(approves > rejects) {
            ui.log("Team APPROVED. Proceeding to Mission.");
            this.voteTrack = 0;
            this.phase = 'mission';
            this.runMissionPhase();
        } else {
            ui.log("Team REJECTED. Leadership passes.");
            this.voteTrack++;
            this.leaderIndex = (this.leaderIndex + 1) % this.players.length;

            if(this.voteTrack >= 5) {
                ui.log("5 Rejected Votes. SPIES WIN THE GAME!");
                ui.showEndScreen(false); // Spies win immediately
            } else {
                this.startRound();
            }
        }
    },

    runMissionPhase: function() {
        ui.renderBoard();
        // Convert IDs to Player objects
        let humansOnTeam = this.proposedTeam
            .map(id => this.players[id])
            .filter(p => p.isHuman);

        if(humansOnTeam.length > 0) {
            ui.updateActionArea('mission_pending');
            turnManager.start(humansOnTeam, 'mission', (humanActions) => {
                game.resolveMission(humanActions);
            }, []);
        } else {
            setTimeout(() => this.resolveMission([]), 2000);
        }
    },

    resolveMission: function(humanActions) {
        let fails = 0;

        // AI Actions
        this.proposedTeam.forEach(id => {
            let p = this.players[id];
            if(!p.isHuman) {
                if(ai.botMissionAction(p)) fails++;
            }
        });

        // Add Human Actions
        if(humanActions) {
            humanActions.forEach(act => {
                if(act.fail) fails++;
            });
        }

        // Check required fails for this mission
        let totalPlayers = this.players.length;
        let required = GAME_MATRIX[totalPlayers].failsRequired[this.currentMissionIndex];
        let success = fails < required;

        ui.log(`Mission Outcome: ${fails} FAILS.`);
        if(success) ui.log(`<span class="log-good">RESISTANCE SUCCESS!</span>`);
        else ui.log(`<span class="log-bad">MISSION FAILED!</span>`);

        // AI learns
        ai.recordMission(this.proposedTeam, success);

        this.missionHistory.push(success);
        this.currentMissionIndex++;
        this.leaderIndex = (this.leaderIndex + 1) % this.players.length;

        this.checkGameEnd();
    },

    checkGameEnd: function() {
        let wins = this.missionHistory.filter(x => x).length;
        let losses = this.missionHistory.filter(x => !x).length;

        ui.renderBoard();

        if(wins >= 3) {
            ui.showEndScreen(true);
        } else if (losses >= 3) {
            ui.showEndScreen(false);
        } else {
            setTimeout(() => this.startRound(), 2500);
        }
    }
};
