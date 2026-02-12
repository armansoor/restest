// Assuming game state is mostly global or passed in.
import { game } from './game.js';
import { GAME_MATRIX } from './constants.js';
import { Toaster, Animator } from './utils/animations.js';

export const ui = {
    screens: ['menu', 'game', 'rules', 'pass', 'private'],
    pendingPlayer: null,

    showScreen: function(id) {
        // Hide all screens first
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        // Show target
        const target = document.getElementById('screen-'+id);
        if(target) {
            target.classList.add('active');
            Animator.animateFadeIn(target.querySelectorAll('.card, .player-grid, h1, h2, h3'));
        }
    },

    initGameScreen: function(totalP, players) {
        this.showScreen('game');
        document.getElementById('game-status-text').innerText = "SYSTEM ONLINE";
        document.getElementById('game-status-text').style.color = "var(--accent-blue)";

        const track = document.getElementById('mission-track');
        track.innerHTML = '';
        GAME_MATRIX[totalP].missions.forEach((num, idx) => {
            let node = document.createElement('div');
            node.className = 'mission-node';
            node.innerText = num;
            node.id = `m-node-${idx}`;
            track.appendChild(node);
        });
        this.renderPlayers(players);
    },

    update: function(state, localId = 0) {
        this.renderBoard(state, localId);
        if(state.voteHistoryLog) {
            this.updateHistory(state.voteHistoryLog);
        }
    },

    updateHistory: function(log) {
        const tbody = document.querySelector('#history-table tbody');
        if(!tbody) return;

        tbody.innerHTML = '';
        // Show last 10? or all.
        log.slice().reverse().forEach(entry => {
            let tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #333';

            let votesSummary = entry.votes.map(v =>
                `<span style="color:${v.approve ? 'var(--accent-blue)' : 'var(--accent-red)'}" title="${v.name}">${v.approve ? '✓' : '✗'}</span>`
            ).join(' ');

            tr.innerHTML = `
                <td style="padding:8px;">${entry.mission}</td>
                <td style="padding:8px;">${entry.leader}</td>
                <td style="padding:8px;">${entry.team}</td>
                <td style="padding:8px;">${votesSummary}</td>
                <td style="padding:8px; color:${entry.result==='Approved' ? 'var(--accent-blue)' : 'var(--accent-red)'}">${entry.result}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderPlayers: function(players, localId) {
        const grid = document.getElementById('player-grid');
        grid.innerHTML = '';

        // Determine if local player is a spy
        let localPlayer = players.find(p => p.id === localId);
        let amISpy = localPlayer && localPlayer.role === 'spy';

        players.forEach(p => {
            let div = document.createElement('div');
            div.className = `player-card ${game.proposedTeam.includes(p.id) ? 'selected' : ''}`;

            if(p.id === game.leaderIndex) {
                div.classList.add('is-leader');
                div.style.borderColor = 'var(--gold)';
            }

            // Is this me?
            let isMe = (p.id === localId);
            if(isMe) div.classList.add('is-me');

            let roleText = "";
            // Show role ONLY if:
            // 1. It is ME
            // 2. It is a Spy AND I am a Spy

            if (isMe) {
                roleText = `<div class="badge ${p.role === 'spy' ? 'role-spy' : 'role-res'}">${p.role.toUpperCase()}</div>`;
            } else if (amISpy && p.role === 'spy') {
                roleText = `<div class="badge role-spy">SPY (KNOWN)</div>`;
            }

            let leaderBadge = p.id === game.leaderIndex
                ? '<div class="badge" style="background:var(--gold);color:black;font-weight:bold;box-shadow:0 0 5px var(--gold);">LEADER</div>'
                : '';

            let nameText = p.name + (isMe ? " (YOU)" : "");

            // Generate avatar seed from name
            // minidenticons automatically replaces <minidenticon-svg> tags
            // We need to make sure we use the tag correctly.
            // Since it's a web component, we just insert the tag.

            div.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center;">
                    <minidenticon-svg username="${p.name}" style="background:#222; border-radius:50%; width:60px; height:60px; margin-bottom:5px;"></minidenticon-svg>
                    <div style="font-size: 1.1em; margin-bottom: 4px; font-weight:bold;">${nameText}</div>
                    ${roleText}
                    ${leaderBadge}
                </div>
            `;
            div.onclick = () => this.handlePlayerClick(p.id);
            grid.appendChild(div);
        });
    },

    handlePlayerClick: function(id) {
        if(game.phase !== 'propose') return;
        // In multiplayer, check if WE are the leader
        // For now, check if local human is leader
        // But we need to know WHICH human is leader if multiple.

        let leader = game.players[game.leaderIndex];
        if(!leader.isHuman) return;

        // Add/Remove from proposed team
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

    renderBoard: function(state = null, localId = 0) {
        // Use state if provided, otherwise fallback to game global (for legacy compatibility during refactor)
        let players = state ? state.players : game.players;
        let history = state ? state.missionHistory : game.missionHistory;
        let missionIdx = state ? state.currentMissionIndex : game.currentMissionIndex;
        let phase = state ? state.phase : game.phase;

        this.renderPlayers(players, localId);

        history.forEach((result, idx) => {
            let node = document.getElementById(`m-node-${idx}`);
            if(node) node.className = `mission-node ${result ? 'mission-success' : 'mission-fail'}`;
        });

        // Highlight current mission
        if(missionIdx < 5) {
            let curr = document.getElementById(`m-node-${missionIdx}`);
            if(curr) curr.classList.add('mission-current');
        }

        if(state && state.voteTrack !== undefined) {
            this.updateVoteTrack(state.voteTrack);
        }

        if(phase) this.updateActionArea(phase);
    },

    updateVoteTrack: function(count) {
        // We can inject this into the header or near mission track
        // For simplicity, let's update a specific element or append if missing
        let track = document.getElementById('vote-track-display');
        if(!track) {
            track = document.createElement('div');
            track.id = 'vote-track-display';
            track.style.textAlign = 'center';
            track.style.marginBottom = '10px';
            track.style.color = 'var(--text-dim)';
            // Insert after mission track
            document.getElementById('mission-track').after(track);
        }

        // Visual bubbles for rejected votes
        let bubbles = '';
        for(let i=0; i<5; i++) {
            let color = i < count ? 'var(--accent-red)' : '#333';
            bubbles += `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin:0 2px;"></span>`;
        }

        track.innerHTML = `Rejected Proposals: ${bubbles}`;
    },

    updateActionArea: function(phase) {
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
        if(typeof msg === 'string' && msg.includes('<span')) {
             entry.innerHTML = `> ${msg}`;
        } else {
             entry.innerText = `> ${msg}`;
        }
        log.prepend(entry);

        // Also show important logs as Toasts
        // Simple heuristic: if uppercase or exclamation, it's important?
        // Or if it contains "APPROVED", "REJECTED", "SUCCESS", "FAILED"
        if(msg.includes('APPROVED') || msg.includes('REJECTED') || msg.includes('SUCCESS') || msg.includes('FAILED') || msg.includes('SPIES WIN')) {
            let type = (msg.includes('SUCCESS') || msg.includes('APPROVED') || msg.includes('Resistance wins')) ? 'success' : 'error';
            // Wait, REJECTED is technically 'neutral' game flow but red color.
            if(msg.includes('REJECTED')) type = 'error';
            Toaster.show(msg.replace(/<[^>]*>/g, ''), type);
        }
    },

    showEndScreen: function(resistanceWon, players) {
        const area = document.getElementById('action-buttons');
        document.getElementById('phase-title').innerText = "GAME OVER";
        document.getElementById('phase-desc').innerText = resistanceWon ? "Resistance wins!" : "Spies win!";

        document.getElementById('game-status-text').innerText = "MISSION COMPLETE";
        document.getElementById('game-status-text').style.color = resistanceWon ? "var(--accent-blue)" : "var(--accent-red)";

        area.innerHTML = "";

        let restartBtn = document.createElement('button');
        restartBtn.className = 'btn';
        restartBtn.innerText = "Play Again";
        restartBtn.onclick = () => {
             // Logic: If Single Player, just re-init.
             // If Multiplayer Host, emit restart event.
             // If Multiplayer Client, wait for host (disable button or show text).

             // We need to access game state or network state.
             // Ideally we emit an event that main.js handles.
             if(game.isMultiplayer) {
                 if(network.isHost) {
                      eventBus.emit('gameRestart', game.lastSettings);
                 } else {
                      // Client cannot restart
                      alert("Waiting for Host to restart...");
                 }
             } else {
                 eventBus.emit('gameRestart', game.lastSettings);
             }
        };

        if (game.isMultiplayer && !network.isHost) {
            restartBtn.innerText = "Waiting for Host...";
            restartBtn.disabled = true;
        }

        area.appendChild(restartBtn);

        let revealHTML = "<div class='role-reveal'>";
        revealHTML += "<h3>Operative Status Report</h3>";
        revealHTML += "<table style='width:100%; border-collapse:collapse; text-align:left; font-size:0.9em;'>";
        revealHTML += "<tr style='border-bottom:1px solid #444;'><th>Name</th><th>Role</th><th>Approve/Reject</th></tr>";

        players.forEach(p => {
            let roleClass = p.role === 'spy' ? 'log-bad' : 'log-good';
            // Need to ensure stats exist (in case of legacy/restart issues)
            let approved = p.stats ? p.stats.votesApproved : 0;
            let rejected = p.stats ? p.stats.votesRejected : 0;

            revealHTML += `<tr>
                <td>${p.name}</td>
                <td class="${roleClass}">${p.role.toUpperCase()}</td>
                <td>${approved} / ${rejected}</td>
            </tr>`;
        });
        revealHTML += "</table></div>";
        document.getElementById('game-log').innerHTML = revealHTML;
    },

    showRoleReveal: function(player, allies, callback) {
        this.showScreen('role-reveal');
        const roleText = document.getElementById('reveal-role-text');
        const alliesDiv = document.getElementById('reveal-allies');

        roleText.innerText = player.role.toUpperCase();
        roleText.className = player.role === 'spy' ? 'log-bad' : 'log-good';

        if(allies.length > 0) {
            alliesDiv.innerHTML = "Other Spies: " + allies.join(', ');
        } else {
            alliesDiv.innerHTML = "";
        }

        const btn = document.getElementById('btn-reveal-confirm');
        // Remove old listeners to prevent double clicks if reused
        let newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            callback();
        });
    },

    showPassScreen: function(player) {
        this.pendingPlayer = player;
        document.getElementById('pass-player-name').innerText = player.name;
        this.showScreen('pass');
    },

    reset: function() {
        document.getElementById('game-log').innerHTML = '';
        document.getElementById('action-buttons').innerHTML = '';
        document.getElementById('mission-track').innerHTML = '';
        document.getElementById('vote-track-display')?.remove();
        document.getElementById('player-grid').innerHTML = '';
    },

    showActionButtons: function(phase, player, callback) {
        const area = document.getElementById('action-buttons');
        const title = document.getElementById('phase-title');
        const desc = document.getElementById('phase-desc');
        area.innerHTML = '';

        if(phase === 'vote') {
            title.innerText = "Phase: Voting";
            desc.innerText = `Approve or Reject team: ${game.proposedTeam.map(id => game.players[id].name).join(', ')}`;

            let btnYes = document.createElement('button');
            btnYes.className = 'btn';
            btnYes.innerText = "APPROVE";
            btnYes.onclick = () => callback({id: player.id, approve: true});

            let btnNo = document.createElement('button');
            btnNo.className = 'btn btn-red';
            btnNo.innerText = "REJECT";
            btnNo.onclick = () => callback({id: player.id, approve: false});

            area.appendChild(btnYes);
            area.appendChild(btnNo);
        } else if (phase === 'mission') {
            title.innerText = "Phase: Mission";
            desc.innerText = "Choose your mission action.";

            if(player.role === 'spy') {
                let btnFail = document.createElement('button');
                btnFail.className = 'btn btn-red';
                btnFail.innerText = "SABOTAGE";
                btnFail.onclick = () => callback({id: player.id, fail: true});

                let btnSuccess = document.createElement('button');
                btnSuccess.className = 'btn';
                btnSuccess.innerText = "SUPPORT (BLUFF)";
                btnSuccess.onclick = () => callback({id: player.id, fail: false});

                area.appendChild(btnSuccess);
                area.appendChild(btnFail);
            } else {
                let btn = document.createElement('button');
                btn.className = 'btn';
                btn.innerText = "SUPPORT MISSION";
                btn.onclick = () => callback({id: player.id, fail: false});
                area.appendChild(btn);
            }
        }
    }
};
