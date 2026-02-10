/* --- GAME CONFIGURATION --- */
const GAME_MATRIX = {
    5: { spies: 2, missions: [2, 3, 2, 3, 3], failsRequired: [1, 1, 1, 1, 1] },
    6: { spies: 2, missions: [2, 3, 4, 3, 4], failsRequired: [1, 1, 1, 1, 1] },
    7: { spies: 3, missions: [2, 3, 3, 4, 4], failsRequired: [1, 1, 1, 2, 1] }, // Mission 4 needs 2 fails
    8: { spies: 3, missions: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
    9: { spies: 3, missions: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
    10: { spies: 4, missions: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] }
};

/* --- THE ENGINE --- */
const game = {
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
        let humansOnTeam = this.proposedTeam.filter(id => this.players[id].isHuman);
        
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

/* --- THE ARTIFICIAL INTELLIGENCE --- */
const ai = {
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

/* --- TURN MANAGER (HOTSEAT) --- */
const turnManager = {
    queue: [],
    actionCallback: null,
    currentAction: null, // 'vote' or 'mission'
    data: null,

    start: function(players, action, callback, data) {
        this.queue = [...players];
        this.currentAction = action;
        this.actionCallback = callback;
        this.data = data || [];
        this.next();
    },

    next: function() {
        if(this.queue.length === 0) {
            // All done, return to game screen and callback
            ui.showScreen('game');
            this.actionCallback(this.data);
            return;
        }

        let p = this.queue.shift();
        ui.showPassScreen(p);
    },

    confirmReady: function() {
        let p = ui.pendingPlayer;
        ui.showPrivateScreen(p, this.currentAction);
    },

    submitAction: function(result) {
        this.data.push(result);
        this.next();
    }
};

/* --- UI CONTROLLER --- */
const ui = {
    screens: ['menu', 'game', 'rules', 'pass', 'private'],
    pendingPlayer: null,
    
    showScreen: function(id) {
        this.screens.forEach(s => document.getElementById('screen-'+s).classList.remove('active'));
        document.getElementById('screen-'+id).classList.add('active');
    },

    showPassScreen: function(player) {
        this.pendingPlayer = player;
        document.getElementById('pass-player-name').innerText = player.name;
        this.showScreen('pass');
    },

    showPrivateScreen: function(player, action) {
        this.showScreen('private');
        const title = document.getElementById('private-title');
        const desc = document.getElementById('private-desc');
        const info = document.getElementById('private-role-info');
        const btns = document.getElementById('private-buttons');
        btns.innerHTML = '';

        // Show Role Info
        let roleName = player.role.toUpperCase();
        let roleClass = player.role === 'spy' ? 'log-bad' : 'log-good';
        info.innerHTML = `You are: <span class="${roleClass}">${roleName}</span>`;

        // If Spy, show partners
        if(player.role === 'spy') {
            let partners = game.players.filter(p => p.role === 'spy' && p.id !== player.id);
            if(partners.length > 0) {
                let names = partners.map(p => p.name).join(', ');
                info.innerHTML += `<br><span style="font-size:0.8em">Allies: ${names}</span>`;
            }
        }

        if(action === 'vote') {
            title.innerText = "VOTE ON TEAM";
            desc.innerText = `Leader proposed: ${game.proposedTeam.map(id => game.players[id].name).join(', ')}`;

            let btnYes = document.createElement('button');
            btnYes.className = 'btn';
            btnYes.innerText = "APPROVE";
            btnYes.onclick = () => turnManager.submitAction({id: player.id, approve: true});

            let btnNo = document.createElement('button');
            btnNo.className = 'btn btn-red';
            btnNo.innerText = "REJECT";
            btnNo.onclick = () => turnManager.submitAction({id: player.id, approve: false});

            btns.appendChild(btnYes);
            btns.appendChild(btnNo);
        } else if (action === 'mission') {
            title.innerText = "MISSION ACTION";
            desc.innerText = "Choose your action carefully.";

            if(player.role === 'spy') {
                let btnFail = document.createElement('button');
                btnFail.className = 'btn btn-red';
                btnFail.innerText = "SABOTAGE";
                btnFail.onclick = () => turnManager.submitAction({id: player.id, fail: true});

                let btnSuccess = document.createElement('button');
                btnSuccess.className = 'btn';
                btnSuccess.innerText = "SUPPORT (BLUFF)";
                btnSuccess.onclick = () => turnManager.submitAction({id: player.id, fail: false});

                btns.appendChild(btnSuccess);
                btns.appendChild(btnFail);
            } else {
                let btn = document.createElement('button');
                btn.className = 'btn';
                btn.innerText = "SUPPORT MISSION";
                btn.onclick = () => turnManager.submitAction({id: player.id, fail: false});
                btns.appendChild(btn);
            }
        }
    },

    initGameScreen: function(totalP) {
        this.showScreen('game');
        const track = document.getElementById('mission-track');
        track.innerHTML = '';
        GAME_MATRIX[totalP].missions.forEach((num, idx) => {
            let node = document.createElement('div');
            node.className = 'mission-node';
            node.innerText = num;
            node.id = `m-node-${idx}`;
            track.appendChild(node);
        });
        this.renderPlayers();
    },

    renderPlayers: function() {
        const grid = document.getElementById('player-grid');
        grid.innerHTML = '';

        // Check for Single Player Spy Visibility
        let showAllSpies = false;
        let humans = game.players.filter(p => p.isHuman);
        if(humans.length === 1 && humans[0].role === 'spy') {
            showAllSpies = true;
        }

        game.players.forEach(p => {
            let div = document.createElement('div');
            div.className = `player-card ${game.proposedTeam.includes(p.id) ? 'selected' : ''}`;
            if(p.id === game.leaderIndex) div.classList.add('is-leader');
            if(p.isHuman) div.classList.add('is-me');

            let roleText = "";
            if(p.isHuman) {
                roleText = `<div class="badge ${p.role === 'spy' ? 'role-spy' : 'role-res'}">${p.role.toUpperCase()}</div>`;
            } else if (showAllSpies && p.role === 'spy') {
                roleText = `<div class="badge role-spy">SPY (KNOWN)</div>`;
            }

            div.innerHTML = `
                <div>${p.name}</div>
                ${roleText}
                ${p.id === game.leaderIndex ? '<div class="badge" style="background:gold;color:black">LEADER</div>' : ''}
            `;
            div.onclick = () => this.handlePlayerClick(p.id);
            grid.appendChild(div);
        });
    },

    handlePlayerClick: function(id) {
        if(game.phase !== 'propose') return;
        if(!game.players[game.leaderIndex].isHuman) return; 

        let idx = game.proposedTeam.indexOf(id);
        if(idx > -1) {
            game.proposedTeam.splice(idx, 1);
        } else {
            let max = GAME_MATRIX[game.players.length].missions[game.currentMissionIndex];
            if(game.proposedTeam.length < max) {
                game.proposedTeam.push(id);
            }
        }
        this.renderBoard();
        this.updateActionArea('propose');
    },

    renderBoard: function() {
        this.renderPlayers();
        game.missionHistory.forEach((result, idx) => {
            let node = document.getElementById(`m-node-${idx}`);
            node.className = `mission-node ${result ? 'mission-success' : 'mission-fail'}`;
        });
        // Highlight current mission
        if(game.currentMissionIndex < 5) {
            let curr = document.getElementById(`m-node-${game.currentMissionIndex}`);
            if(curr) curr.classList.add('mission-current');
        }
    },

    updateActionArea: function(phase, data) {
        const area = document.getElementById('action-buttons');
        const title = document.getElementById('phase-title');
        const desc = document.getElementById('phase-desc');
        area.innerHTML = '';

        if(phase === 'propose') {
            title.innerText = "Phase: Assemble Team";
            let size = GAME_MATRIX[game.players.length].missions[game.currentMissionIndex];
            
            if(game.players[game.leaderIndex].isHuman) {
                desc.innerText = `Select ${size} operatives.`;
                let btn = document.createElement('button');
                btn.className = 'btn';
                btn.innerText = "Submit Proposal";
                if(game.proposedTeam.length !== size) btn.disabled = true;
                btn.onclick = () => game.submitTeam(game.proposedTeam);
                area.appendChild(btn);
            } else {
                desc.innerText = "Computer is calculating...";
            }
        }

        if(phase === 'vote' || phase === 'vote_pending') {
            title.innerText = "Phase: Voting";
            desc.innerText = "Check your private screen.";
        }

        if(phase === 'mission' || phase === 'mission_pending') {
            title.innerText = "Phase: Mission";
            desc.innerText = "Mission in progress... Check private screen.";
        }
    },

    log: function(msg) {
        const log = document.getElementById('game-log');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `> ${msg}`;
        log.prepend(entry);
    },

    showEndScreen: function(resistanceWon) {
        const area = document.getElementById('action-buttons');
        document.getElementById('phase-title').innerText = "GAME OVER";
        document.getElementById('phase-desc').innerText = resistanceWon ? "Resistance wins!" : "Spies win!";
        
        area.innerHTML = `<button class='btn' onclick='location.reload()'>Play Again</button>`;
        
        let revealHTML = "<div class='role-reveal'>";
        game.players.forEach(p => {
            revealHTML += `<div class="${p.role === 'spy' ? 'log-bad' : 'log-good'}">${p.name}: ${p.role.toUpperCase()}</div>`;
        });
        revealHTML += "</div>";
        document.getElementById('game-log').innerHTML = revealHTML;
    }
};

/* --- EVENT LISTENERS --- */
document.getElementById('btn-init').addEventListener('click', () => game.init());
document.getElementById('btn-rules').addEventListener('click', () => ui.showScreen('rules'));
document.getElementById('btn-back-menu').addEventListener('click', () => ui.showScreen('menu'));
document.getElementById('btn-pass-confirm').addEventListener('click', () => turnManager.confirmReady());
