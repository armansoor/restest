import { game } from './game.js';
import { ui } from './ui.js';
import { eventBus } from './eventBus.js';
import { network } from './network.js';

// --- Global Expose ---
window.game = game;
window.ui = ui;
window.network = network;

// --- Network Event Listeners ---

eventBus.on('networkReady', (id) => {
    document.getElementById('host-room-id').innerText = id;
});

eventBus.on('playerListUpdate', (players) => {
    const list = document.getElementById('lobby-player-list');
    list.innerHTML = players.map(p => `<div>${p.name} ${p.id===0 ? '(Host)' : ''}</div>`).join('');

    document.getElementById('lobby-count').innerText = players.length;

    if(network.isHost) {
        // Enable start button if players match selected total
        const needed = parseInt(document.getElementById('setup-multi-total').value);
        document.getElementById('btn-start-multi').disabled = (players.length < needed);
    }
});

eventBus.on('lobbyJoined', (players) => {
    // Client joined, show lobby UI
    ui.showScreen('lobby');
    document.getElementById('lobby-host-area').style.display = 'block';
    document.getElementById('host-room-id').innerText = "Connected";
    document.getElementById('lobby-options').style.display = 'none';

    const list = document.getElementById('lobby-player-list');
    list.innerHTML = players.map(p => `<div>${p.name} ${p.id===0 ? '(Host)' : ''}</div>`).join('');
});

eventBus.on('lobbyUpdate', (players) => {
    const list = document.getElementById('lobby-player-list');
    list.innerHTML = players.map(p => `<div>${p.name} ${p.id===0 ? '(Host)' : ''}</div>`).join('');
});

eventBus.on('networkAction', (data) => {
    // Only Host receives this
    if(!network.isHost) return;

    if(data.action === 'vote') {
        // Find the pending vote request and fulfill callback?
        // Since we decoupled game logic with callbacks, we need to map network actions back to those callbacks.
        // We can use a pendingCallbacks object in game or main.
        if(window.pendingVoteCallback) {
            // Add this vote to the collection.
            // But game logic expects ALL votes at once? Or we can collect them one by one.
            // game.js `runVotingPhase` uses `requestVotes` with a callback for ALL human votes.
            // We need a Vote Collector here.

            // Check if we have a voteCollector
            if(!window.voteCollector) window.voteCollector = [];
            window.voteCollector.push(data.payload);

            // Do we have all needed votes?
            // We need to know how many humans.
            let totalHumans = game.players.filter(p => p.isHuman).length;
            if(window.voteCollector.length >= totalHumans) {
                window.pendingVoteCallback(window.voteCollector);
                window.pendingVoteCallback = null;
                window.voteCollector = null;
            }
        }
    }

    if(data.action === 'mission') {
        if(window.pendingMissionCallback) {
            if(!window.missionCollector) window.missionCollector = [];
            window.missionCollector.push(data.payload);

            // We only ask Humans on team
            let humansOnTeam = game.proposedTeam.map(id => game.players[id]).filter(p => p.isHuman).length;

            if(window.missionCollector.length >= humansOnTeam) {
                window.pendingMissionCallback(window.missionCollector);
                window.pendingMissionCallback = null;
                window.missionCollector = null;
            }
        }
    }
});

// --- Game Logic Events ---

eventBus.on('stateUpdate', (state) => {
    // If Host, broadcast state
    if(network.isHost) {
        network.broadcast({ type: 'gameState', state: state });
    }
    // Determine my ID
    // If Single Player, I am 0.
    // If Multiplayer Host, I am 0.
    // If Multiplayer Client, I am network.myPlayerId.
    let myId = game.isMultiplayer ? (network.isHost ? 0 : network.myPlayerId) : 0;
    ui.update(state, myId);
});

eventBus.on('log', (msg) => {
    if(network.isHost) network.broadcast({ type: 'log', msg: msg });
    ui.log(msg);
});

eventBus.on('gameInit', (data) => {
    // Host starts game logic, this fires locally.
    // Client receives stateUpdate later.
    ui.initGameScreen(data.totalPlayers, data.players);
});

eventBus.on('gameOver', (data) => {
    if(network.isHost) network.broadcast({ type: 'gameOver', ...data });
    ui.showEndScreen(data.resistanceWon, game.players);
});

// Request Votes Logic
eventBus.on('requestVotes', (data) => {
    if(game.isMultiplayer) {
        if(network.isHost) {
            // Host needs to vote too?
            ui.showActionButtons('vote', game.players[0], (result) => {
                // Host votes locally
                if(!window.voteCollector) window.voteCollector = [];
                window.voteCollector.push(result);

                let totalHumans = game.players.filter(p => p.isHuman).length;
                if(window.voteCollector.length >= totalHumans) {
                    data.callback(window.voteCollector);
                    window.voteCollector = null;
                }
            });

            // Request from Clients
            window.pendingVoteCallback = data.callback;
            // Send requests to all other human players
            let otherHumans = data.voters.filter(p => p.id !== 0);
            otherHumans.forEach(p => {
                network.sendToPlayer(p.id, {
                    type: 'requestVote',
                    playerId: p.id,
                    role: p.role // Send role just in case client needs it for UI
                });
            });
        } else {
            // Client side logic (received from network)
            // Handled in network.js calling this event locally
            // data.voters only contains ME
            if(data.voters.length > 0) {
                ui.showActionButtons('vote', data.voters[0], (result) => {
                    data.callback([result]);
                });
            }
        }
    } else {
        // Single Player
        if(data.voters.length === 1 && data.voters[0].isHuman) {
            ui.showActionButtons('vote', data.voters[0], (result) => {
                data.callback([result]);
            });
        }
    }
});

eventBus.on('requestMissionActions', (data) => {
    if(game.isMultiplayer) {
        if(network.isHost) {
            // Check if Host is on team
            let hostOnTeam = data.agents.find(p => p.id === 0);
            if(hostOnTeam) {
                ui.showActionButtons('mission', hostOnTeam, (result) => {
                    if(!window.missionCollector) window.missionCollector = [];
                    window.missionCollector.push(result);

                    let humansOnTeam = data.agents.length;
                    if(window.missionCollector.length >= humansOnTeam) {
                        data.callback(window.missionCollector);
                        window.missionCollector = null;
                    }
                });
            }

            // Request from Clients
            window.pendingMissionCallback = data.callback;
            let otherHumans = data.agents.filter(p => p.id !== 0);
            otherHumans.forEach(p => {
                network.sendToPlayer(p.id, {
                    type: 'requestMission',
                    playerId: p.id,
                    role: p.role
                });
            });
        } else {
            // Client
            if(data.agents.length > 0) {
                ui.showActionButtons('mission', data.agents[0], (result) => {
                    data.callback([result]);
                });
            }
        }
    } else {
        if(data.agents.length === 1 && data.agents[0].isHuman) {
             ui.showActionButtons('mission', data.agents[0], (result) => {
                data.callback([result]);
            });
        }
    }
});


// --- DOM Event Listeners ---

// Mode Selection
document.getElementById('btn-mode-single').addEventListener('click', () => {
    ui.showScreen('single-setup');
});

document.getElementById('btn-mode-multi').addEventListener('click', () => {
    network.init();
    ui.showScreen('lobby');
});

// Single Player Start
document.getElementById('btn-start-single').addEventListener('click', () => {
    const totalP = parseInt(document.getElementById('setup-players').value);
    const diff = document.getElementById('setup-difficulty').value;
    game.init({
        totalPlayers: totalP,
        humanPlayers: 1,
        difficulty: diff,
        isMultiplayer: false
    });
});

// Lobby Actions
document.getElementById('btn-host-game').addEventListener('click', () => {
    network.hostGame();
    document.getElementById('lobby-host-area').style.display = 'block';
    document.getElementById('lobby-options').style.display = 'none';
});

document.getElementById('btn-join-game').addEventListener('click', () => {
    const roomId = document.getElementById('join-room-id').value;
    if(roomId) network.joinGame(roomId);
});

document.getElementById('btn-start-multi').addEventListener('click', () => {
    // Only Host can start
    if(network.isHost) {
        const totalP = parseInt(document.getElementById('setup-multi-total').value);
        // Ensure we have enough connected players?
        // Game allows filling with bots if we want, or force humans.
        // Prompt says "Multiplayer LAN", implies full human?
        // But logic supports mix. Let's assume remaining are bots.
        let humanCount = network.players.length;

        game.init({
            totalPlayers: totalP,
            humanPlayers: humanCount,
            difficulty: 'normal', // Default for now
            isMultiplayer: true
        });
    }
});

document.getElementById('btn-back-menu').addEventListener('click', () => ui.showScreen('menu'));
document.getElementById('btn-back-menu-lobby').addEventListener('click', () => ui.showScreen('menu'));
