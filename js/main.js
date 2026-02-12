import { game } from './game.js';
import { ui } from './ui.js';
import { eventBus } from './eventBus.js';
import { network } from './network.js';
import { chatter } from './chatter.js';
import { SpectatorManager } from './utils/spectator.js';
import { Toaster } from './utils/animations.js';
import { ThemeManager } from './utils/audiovisual.js';
import { Tutorial } from './utils/tutorial.js';

// Initialize subsystems
chatter.init();
Tutorial.hasRun = false; // Reset for session if needed, or use localStorage check inside Tutorial
SpectatorManager.init();
// ThemeManager has no init

// --- Global Expose ---
window.game = game;
window.ui = ui;
window.network = network;
window.chatter = chatter;

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

eventBus.on('gameRestart', (settings) => {
    // Only Host triggers this, but clients receive it via network if needed
    // Actually, game.js emits this when host clicks "Play Again"
    // We need to re-init game with same players but new roles

    // If Multiplayer
    if(game.isMultiplayer && network.isHost) {
        // Shuffle roles is handled in game.init
        // We just need to call game.init again with preserved settings
        // But we need to make sure we don't drop connections

        // Preserve current player list from network
        // Reuse settings
        game.init({
            totalPlayers: settings.totalPlayers,
            humanPlayers: settings.humanPlayers,
            difficulty: settings.difficulty,
            isMultiplayer: true,
            playerList: network.players
        });

        // Broadcast restart to clients
        // The game.init emits 'gameInit', which we already broadcast?
        // Let's check game.js... yes, game.init emits 'gameInit'.
        // And main.js listens to 'gameInit'.
        // inside 'gameInit' listener:
        // ui.showRoleReveal...

        // But we need to tell clients to reset their local state first?
        // Actually 'gameInit' payload contains everything needed.
        // However, we might want a specific 'restart' event to clear logs/chat?
        network.broadcast({ type: 'gameRestart' });
    } else if (!game.isMultiplayer) {
         game.init(settings);
    }
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
    // Update theme
    ThemeManager.setTheme(state.phase);

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
    // Reset UI state for restart
    ui.reset();

    // Show Role Reveal instead of going straight to game
    // We need to know OUR player object.
    let myId = game.isMultiplayer ? (network.isHost ? 0 : network.myPlayerId) : 0;

    // If I am a spectator (not in player list), handle gracefully
    // In current logic, spectators might not be in data.players if they joined late?
    // Wait, game.init uses network.players.
    // If spectator joined LATE, they are in network.players but maybe not in game.players if game already started?
    // But here we are INIT-ing a NEW game. So everyone currently connected becomes a player.

    // However, if we support "Spectator Mode" explicitly where >10 players or late joiners:
    // We need to check if myId is valid in data.players

    let me = data.players.find(p => p.id === myId);

    if(!me) {
        // I am a spectator
        SpectatorManager.setSpectator(true);
        ui.initGameScreen(data.totalPlayers, data.players);
        ui.log("You are spectating this game.");
        return;
    } else {
        SpectatorManager.setSpectator(false);
    }

    // Check for spies
    let spies = [];
    if(me && me.role === 'spy') {
        spies = data.players.filter(p => p.role === 'spy' && p.id !== myId).map(p => p.name);
    }

    ui.showRoleReveal(me, spies, () => {
        ui.initGameScreen(data.totalPlayers, data.players);
        // Start Tutorial if first time
        Tutorial.start();
    });
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

// Helper to validate name
function validateName(name) {
    if (!name) return false;
    if (name.length < 3 || name.length > 20) return false;
    // if (name.includes(' ')) return false; // Allow spaces for better UX
    return true;
}

// Single Player Start
document.getElementById('btn-start-single').addEventListener('click', () => {
    const totalP = parseInt(document.getElementById('setup-players').value);
    const diff = document.getElementById('setup-difficulty').value;

    // Default name for single player
    const playerName = "Player 1";

    game.init({
        totalPlayers: totalP,
        humanPlayers: 1,
        difficulty: diff,
        isMultiplayer: false,
        playerName: playerName
    });
});

// Lobby Actions
document.getElementById('btn-host-game').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name-input');
    const playerName = nameInput.value.trim();

    if (!validateName(playerName)) {
        Toaster.show("Please enter a valid codename (3-20 characters).", "error");
        Toaster.show("Please enter a valid codename (3-20 characters).", "error");
        nameInput.focus();
        return;
    }

    network.hostGame(playerName);
    document.getElementById('lobby-host-area').style.display = 'block';
    document.getElementById('lobby-options').style.display = 'none';
});

document.getElementById('btn-join-game').addEventListener('click', () => {
    const roomId = document.getElementById('join-room-id').value;
    const nameInput = document.getElementById('player-name-input');
    const playerName = nameInput.value.trim();

    if (!validateName(playerName)) {
        alert("Please enter a valid codename (3-20 characters, no spaces).");
        nameInput.focus();
        return;
    }

    if(roomId) network.joinGame(roomId, playerName);
});

document.getElementById('btn-start-multi').addEventListener('click', () => {
    // Only Host can start
    if(network.isHost) {
        const totalP = parseInt(document.getElementById('setup-multi-total').value);
        const difficulty = document.getElementById('setup-multi-difficulty').value;
        let humanCount = network.players.length;

        if (humanCount > totalP) {
            Toaster.show(`Too many players joined for a ${totalP}-player game!`, "error");
            return;
        }

        // Remaining slots will be filled with bots by game.js automatically
        // because we pass humanPlayers = humanCount.
        // game.js init loop: for(let i=0; i<totalP; i++) { isHuman: i < humanP }
        // This implies Humans MUST be the first N players.
        // network.js assigns IDs 0, 1, 2... sequentially.
        // So this logic works perfectly.

        game.init({
            totalPlayers: totalP,
            humanPlayers: humanCount, // Rest will be bots
            difficulty: difficulty,
            isMultiplayer: true,
            playerList: network.players
        });
    }
});

document.getElementById('btn-rules').addEventListener('click', () => {
    const rulesScreen = document.getElementById('screen-rules');
    if(rulesScreen) {
        // Ensure it's not hidden by display:none in css
        // ui.showScreen adds .active which is display:block in CSS
        // But if we have inline style issues, clear them
        rulesScreen.removeAttribute('style');
        ui.showScreen('rules');
        // Double check inner content is visible?
        // It's a static HTML, should be fine.
    }
});
document.getElementById('btn-back-menu-lobby').addEventListener('click', () => ui.showScreen('menu'));
document.getElementById('btn-rules-back').addEventListener('click', () => ui.showScreen('menu'));

// History
document.getElementById('btn-show-history').addEventListener('click', () => {
    document.getElementById('screen-history').classList.add('active');
});
document.getElementById('btn-close-history').addEventListener('click', () => {
    document.getElementById('screen-history').classList.remove('active');
});

// Chat
eventBus.on('gameInit', () => {
    if(game.isMultiplayer) {
        document.getElementById('chat-container').style.display = 'block';
    }
});

eventBus.on('chatMessage', (data) => {
    // Ensure chat container is visible even in Single Player if bots chat
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer.style.display === 'none' && data.isBot) {
        chatContainer.style.display = 'block';
        // Disable input for single player if we only want bots to talk?
        // Actually, let's allow player to talk to void (logs) or bots.
    }

    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.style.marginBottom = "4px";
    if (data.isBot) {
        div.style.color = "#aaa";
        div.style.fontStyle = "italic";
    }
    div.innerText = `${data.sender}: ${data.msg}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

document.getElementById('btn-send-chat').addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if(!msg) return;

    // Send to Network
    if(network.isHost) {
        network.broadcast({ type: 'chat', sender: 'Host', msg: msg });
        eventBus.emit('chatMessage', { sender: 'Host (You)', msg: msg });
    } else {
        network.hostConn.send({ type: 'chat', msg: msg });
        eventBus.emit('chatMessage', { sender: 'You', msg: msg });
    }
    input.value = '';
});
