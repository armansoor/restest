export const SpectatorManager = {
    isSpectator: false,

    init: function() {
        this.isSpectator = false;
    },

    setSpectator: function(status) {
        this.isSpectator = status;
        if(status) {
            document.body.classList.add('spectator-mode');
            // Hide action buttons for spectators
            const actionArea = document.getElementById('action-buttons');
            if(actionArea) actionArea.style.display = 'none';
        } else {
            document.body.classList.remove('spectator-mode');
            const actionArea = document.getElementById('action-buttons');
            if(actionArea) actionArea.style.display = 'block';
        }
    }
};
