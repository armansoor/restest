// Optional Local Signaling Server for offline LAN
// Run with: node server.js
// Clients connect via: new Peer({ host: 'localhost', port: 9000, path: '/myapp' })
// Note: This requires the 'peer' package (npm install peer)

const { PeerServer } = require('peer');

const peerServer = PeerServer({ port: 9000, path: '/myapp' });

console.log('PeerJS server running on port 9000');
