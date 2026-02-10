import { game } from './game.js';
import { GAME_MATRIX } from './constants.js';
import { turnManager } from './turnManager.js';

export const ui = {
    screens: ['menu', 'game', 'rules', 'pass', 'private'],
    pendingPlayer: null,

    showScreen: function(id) {
        this.screens.forEach(s => document.getElementById('screen-'+s).classList.remove('active'));
        document.getElementById('screen-'+id).classList.add('active');
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

        // Check for Single Player Spy Visibility (only if 1 human player)
        let showAllSpies = false;
        let humans = game.players.filter(p => p.isHuman);
        if(humans.length === 1 && humans[0].role === 'spy') {
            showAllSpies = true;
        }

        game.players.forEach(p => {
            let div = document.createElement('div');
            // Basic classes
            div.className = `player-card ${game.proposedTeam.includes(p.id) ? 'selected' : ''}`;

            // Add visual distinction for leader
            if(p.id === game.leaderIndex) {
                div.classList.add('is-leader');
                // Ensure leader is visually distinct even without badge if needed
                div.style.borderColor = 'var(--gold)';
            }

            if(p.isHuman) div.classList.add('is-me');

            let roleText = "";
            if(p.isHuman) {
                roleText = `<div class="badge ${p.role === 'spy' ? 'role-spy' : 'role-res'}">${p.role.toUpperCase()}</div>`;
            } else if (showAllSpies && p.role === 'spy') {
                roleText = `<div class="badge role-spy">SPY (KNOWN)</div>`;
            }

            let leaderBadge = p.id === game.leaderIndex
                ? '<div class="badge" style="background:var(--gold);color:black;font-weight:bold;box-shadow:0 0 5px var(--gold);">LEADER</div>'
                : '';

            div.innerHTML = `
                <div style="font-size: 1.1em; margin-bottom: 4px;">${p.name}</div>
                ${roleText}
                ${leaderBadge}
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
    }
};
