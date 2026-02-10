# The Resistance: AI Protocol

**The Resistance** is a social deduction board game brought to life in the browser. Players are either members of the **Resistance**, trying to overthrow a malignant government, or **Spies**, trying to sabotage the Resistance from within.

This implementation features a robust **Single Player** mode against AI bots and a **Multiplayer** mode that works over LAN or the Internet using Peer-to-Peer (WebRTC) technology.

![Game Preview](https://armansoor.github.io/restest/)

## 🚀 Features

*   **🕵️ Single Player Mode**: Play solo against intelligent AI bots that vote and act based on game logic.
*   **🌐 Multiplayer (P2P)**: Host and join games directly without a central game server. Uses WebRTC (PeerJS) for low-latency connection.
*   **📱 Fully Responsive**: Optimized for Desktop, Tablet, and Mobile devices.
*   **📜 Official Rules**:
    *   Supports 5 to 10 players.
    *   **5 Failed Votes Rule**: Spies win immediately if 5 team proposals are rejected in a row.
    *   **7+ Player Rule**: Mission 4 requires two fails to fail the mission.
    *   **Spy Visibility**: Spies can see their teammates (implemented securely in Multiplayer).
*   **💬 In-Game Chat**: Integrated secure text chat for Multiplayer games.
*   **📊 Mission History**: Detailed log of every vote, team proposal, and mission outcome.
*   **🔒 Secure Identity**: Role information is strictly managed on the client-side to prevent leaks in multiplayer.

## 🎮 How to Play

1.  **Objective**:
    *   **Resistance**: Succeed 3 Missions.
    *   **Spies**: Fail 3 Missions (or force 5 rejected team votes in a single round).
2.  **Phases**:
    *   **Team Building**: The Leader proposes a team for the mission.
    *   **Voting**: All players vote to Approve or Reject the team. Majority rules.
    *   **Mission**: If approved, the team goes on the mission. Resistance members must support; Spies may support or sabotage.

## 🛠️ Installation & Setup

You can run this game using any static file server.

### Method 1: Local Development (Online P2P)
This method uses the public PeerJS cloud server for signaling. Requires Internet access.

1.  Clone the repository.
2.  Start a local server in the project root:
    ```bash
    # Python 3
    python3 -m http.server 8000

    # or Node.js http-server
    npx http-server
    ```
3.  Open `http://localhost:8000` in your browser.

### Method 2: Offline LAN Play
If you have no internet access, you can run a local signaling server using Node.js.

1.  Install dependencies:
    ```bash
    npm install peer
    ```
2.  Start the signaling server:
    ```bash
    node server.js
    ```
3.  *Note: You may need to update `js/network.js` to point to `localhost` and port `9000` instead of the default PeerJS cloud config.*

## 📂 Project Structure

*   `index.html`: Main entry point and UI layout.
*   `style.css`: Responsive styling and animations.
*   `js/`: Modular JavaScript logic.
    *   `main.js`: Application entry point and event wiring.
    *   `game.js`: Core game state and logic (rules, phases).
    *   `network.js`: WebRTC/PeerJS networking logic for Multiplayer.
    *   `ui.js`: DOM manipulation and screen rendering.
    *   `ai.js`: Bot logic for Single Player.
    *   `eventBus.js`: Pub/Sub system for decoupling logic and UI.
    *   `constants.js`: Game configuration matrices.
*   `server.js`: Optional Node.js signaling server.

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
