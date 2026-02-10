// Simple Event Bus for Decoupling
export const eventBus = {
    listeners: {},

    on: function(event, callback) {
        if(!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },

    emit: function(event, data) {
        if(this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
};
