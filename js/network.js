import { eventBus } from './eventBus.js';

export const network = {
    peer: null,
    connections: [],
    hostConn: null,
    isHost: false,
    myId: null, // Peer ID
    myPlayerId: null, // Game Player Index (0-9)
    players: [], // List of connected players {id, name, peerId}

    init: function() {
        this.peer = new Peer(null, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            this.myId = id;
            console.log('My peer ID is: ' + id);
            eventBus.emit('networkReady', id);
        });

        this.peer.on('connection', (conn) => {
            if(this.isHost) {
                this.handleIncomingConnection(conn);
            } else {
                conn.close();
            }
        });

        this.peer.on('error', (err) => {
            console.error(err);
            alert("Network Error: " + err.type);
        });
    },

    hostGame: function(playerName) {
        this.isHost = true;
        this.myPlayerId = 0;
        this.players = [{
            id: 0,
            name: playerName,
            peerId: this.myId,
            isHuman: true
        }];
        eventBus.emit('playerListUpdate', this.players);
    },

    joinGame: function(hostId, playerName) {
        this.isHost = false;
        this.hostConn = this.peer.connect(hostId);

        this.hostConn.on('open', () => {
            console.log("Connected to host");
            this.hostConn.send({ type: 'join', name: playerName });
        });

        this.hostConn.on('data', (data) => {
            this.handleDataFromHost(data);
        });

        this.hostConn.on('close', () => {
             alert("Disconnected from Host");
             location.reload();
        });
    },

    handleIncomingConnection: function(conn) {
        // We need to wait for 'open' before sending anything, but for 'data' logic it's fine
        conn.on('data', (data) => {
            if(data.type === 'join') {
                if(this.players.length >= 10) {
                    conn.send({type: 'error', msg: 'Room full'});
                    return;
                }

                let newPlayerId = this.players.length;
                // Use provided name or fallback
                let pName = data.name || `Player ${newPlayerId + 1}`;
                let newPlayer = {
                    id: newPlayerId,
                    name: pName,
                    peerId: conn.peer,
                    isHuman: true,
                    conn: conn
                };

                this.players.push(newPlayer);
                this.connections.push(conn);

                // Confirm join to client
                conn.send({ type: 'joined', playerId: newPlayerId, players: this.players.map(p => ({name: p.name, id: p.id})) });

                // Broadcast updated list to all
                this.broadcast({ type: 'lobbyUpdate', players: this.players.map(p => ({name: p.name, id: p.id})) });
                eventBus.emit('playerListUpdate', this.players);
            }

            if(data.type === 'action') {
                let p = this.players.find(pl => pl.conn === conn);
                if(p) {
                    eventBus.emit('networkAction', { playerId: p.id, action: data.action, payload: data.payload });
                }
            }

            if(data.type === 'chat') {
                let p = this.players.find(pl => pl.conn === conn);
                if(p) {
                    // Broadcast chat to everyone else
                    this.broadcast({ type: 'chat', sender: p.name, msg: data.msg });
                    // Emit locally
                    eventBus.emit('chatMessage', { sender: p.name, msg: data.msg });
                }
            }
        });

        conn.on('close', () => {
             this.players = this.players.filter(p => p.conn !== conn);
             this.connections = this.connections.filter(c => c !== conn);
             this.broadcast({ type: 'lobbyUpdate', players: this.players.map(p => ({name: p.name, id: p.id})) });
             eventBus.emit('playerListUpdate', this.players);
        });
    },

    handleDataFromHost: function(data) {
        if(data.type === 'joined') {
            this.myPlayerId = data.playerId;
            eventBus.emit('lobbyJoined', data.players);
        }
        else if(data.type === 'lobbyUpdate') {
             eventBus.emit('lobbyUpdate', data.players);
        }
        else if(data.type === 'gameState') {
            // We receive full state, but ui.js handles visibility based on myPlayerId
            // However, we need to ensure 'stateUpdate' listener knows myPlayerId
            // The listener in main.js calls network.myPlayerId, so we are good.
            eventBus.emit('stateUpdate', data.state);
        }
        else if(data.type === 'requestVote') {
            eventBus.emit('requestVotes', {
                voters: [{id: this.myPlayerId, isHuman: true, role: data.role}],
                callback: (result) => {
                    this.hostConn.send({type: 'action', action: 'vote', payload: result[0]});
                }
            });
        }
        else if(data.type === 'requestMission') {
            eventBus.emit('requestMissionActions', {
                agents: [{id: this.myPlayerId, isHuman: true, role: data.role}],
                callback: (result) => {
                    this.hostConn.send({type: 'action', action: 'mission', payload: result[0]});
                }
            });
        }
        else if(data.type === 'log') eventBus.emit('log', data.msg);
        else if(data.type === 'gameOver') eventBus.emit('gameOver', data);
        else if(data.type === 'chat') eventBus.emit('chatMessage', data);
    },

    broadcast: function(msg) {
        this.connections.forEach(c => c.send(msg));
    },

    sendToPlayer: function(playerId, msg) {
        let p = this.players.find(x => x.id === playerId);
        if(p && p.conn) {
            p.conn.send(msg);
        }
    }
};
