import { ui } from './ui.js';

export const turnManager = {
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
