import { GAME_MATRIX } from './constants.js';
import { ai } from './ai.js';
import { eventBus } from './eventBus.js';

export const game = {
    players: [],
    missionHistory: [],
    currentMissionIndex: 0,
    voteTrack: 0,
    leaderIndex: 0,
    difficulty: 'normal',
    phase: 'setup',
    proposedTeam: [],
    isMultiplayer: false,

    init: function(settings) {
        const totalP = settings.totalPlayers;
        const humanP = settings.humanPlayers;
        this.difficulty = settings.difficulty;
        this.isMultiplayer = settings.isMultiplayer || false;

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
                name: i < humanP ? `Player ${i+1}` : `Bot ${i+1}`,
                suspicion: 0
            });
        }

        // Emit Init Event
        eventBus.emit('gameInit', { totalPlayers: totalP, players: this.players });
        this.startRound();
    },

    shuffle: function(array) {
        return array.sort(() => Math.random() - 0.5);
    },

    startRound: function() {
        this.phase = 'propose';
        this.proposedTeam = [];

        // Notify UI of state update
        this.emitStateUpdate();

        let currentLeader = this.players[this.leaderIndex];
        eventBus.emit('log', `--- Mission ${this.currentMissionIndex + 1} Start ---`);
        eventBus.emit('log', `Leader is ${currentLeader.name}. Vote Track: ${this.voteTrack}/5`);

        // If Leader is Bot, make them propose immediately
        if(!currentLeader.isHuman) {
            setTimeout(() => ai.botProposeTeam(), 1200);
        } else {
            // Wait for human input (handled by UI calling submitTeam)
            eventBus.emit('phaseChange', { phase: 'propose' });
        }
    },

    submitTeam: function(teamIds) {
        this.proposedTeam = teamIds;
        eventBus.emit('log', `Leader proposed: ${teamIds.map(id => game.players[id].name).join(', ')}`);
        this.phase = 'vote';
        this.emitStateUpdate();
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

        // Identify pending human voters
        let humanVoters = this.players.filter(p => p.isHuman);

        if(humanVoters.length > 0) {
            // Emit event to request human votes
            // If Single Player (1 human), UI handles it directly
            // If Multiplayer, Network handles it
            eventBus.emit('requestVotes', {
                voters: humanVoters,
                currentVotes: votes,
                callback: (humanVotes) => {
                     let allVotes = votes.concat(humanVotes);
                     this.resolveVotes(allVotes);
                }
            });
        } else {
            this.resolveVotes(votes);
        }
    },

    resolveVotes: function(votes) {
        let approves = votes.filter(v => v.approve).length;
        let rejects = votes.filter(v => !v.approve).length;

        // Construct vote string for UI
        let voteResults = votes.map(v => {
            return { name: this.players[v.id].name, approve: v.approve };
        });

        eventBus.emit('voteResults', voteResults);

        if(approves > rejects) {
            eventBus.emit('log', "Team APPROVED. Proceeding to Mission.");
            this.voteTrack = 0;
            this.phase = 'mission';
            this.runMissionPhase();
        } else {
            eventBus.emit('log', "Team REJECTED. Leadership passes.");
            this.voteTrack++;
            this.leaderIndex = (this.leaderIndex + 1) % this.players.length;

            if(this.voteTrack >= 5) {
                eventBus.emit('log', "5 Rejected Votes. SPIES WIN THE GAME!");
                eventBus.emit('gameOver', { resistanceWon: false });
            } else {
                this.startRound();
            }
        }
    },

    runMissionPhase: function() {
        this.emitStateUpdate();
        // Convert IDs to Player objects
        let humansOnTeam = this.proposedTeam
            .map(id => this.players[id])
            .filter(p => p.isHuman);

        if(humansOnTeam.length > 0) {
            eventBus.emit('requestMissionActions', {
                agents: humansOnTeam,
                callback: (humanActions) => {
                    this.resolveMission(humanActions);
                }
            });
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

        eventBus.emit('log', `Mission Outcome: ${fails} FAILS.`);
        if(success) eventBus.emit('logSuccess', "RESISTANCE SUCCESS!");
        else eventBus.emit('logFail', "MISSION FAILED!");

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

        this.emitStateUpdate();

        if(wins >= 3) {
            eventBus.emit('gameOver', { resistanceWon: true });
        } else if (losses >= 3) {
            eventBus.emit('gameOver', { resistanceWon: false });
        } else {
            setTimeout(() => this.startRound(), 2500);
        }
    },

    emitStateUpdate: function() {
        eventBus.emit('stateUpdate', {
            players: this.players,
            missionHistory: this.missionHistory,
            currentMissionIndex: this.currentMissionIndex,
            voteTrack: this.voteTrack,
            leaderIndex: this.leaderIndex,
            phase: this.phase,
            proposedTeam: this.proposedTeam
        });
    }
};
