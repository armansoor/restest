export const SoundManager = {
    sounds: {},
    enabled: true,

    init: function() {
        // We can load base64 sounds or external URLs.
        // For this demo, let's use simple synthesizer or placeholders if no assets.
        // Actually, Howler works best with files.
        // We can use a free open source UI sound pack hosted via CDN or similar,
        // but for reliability in this sandbox let's just log or try to use a data URI if possible.

        // Since I cannot upload mp3 files easily, I will use very short data URIs for beeps.
        // Or just rely on visual cues if audio fails.

        // Let's try to add a mute button to UI later.
    },

    play: function(key) {
        if(!this.enabled) return;
        // console.log(`[Sound] Playing ${key}`);

        // In a real implementation, we would do:
        // if(this.sounds[key]) this.sounds[key].play();

        // For now, let's just do nothing as we don't have audio assets.
        // I will add a placeholder note.
    },

    // Theme music manager
    setTheme: function(phase) {
        // Change background ambient track
    }
};

export const ThemeManager = {
    setTheme: function(phase) {
        const body = document.body;
        // Default
        let gradient = "linear-gradient(rgba(26, 26, 29, 0.95), rgba(26, 26, 29, 0.95))";
        let color = "#1a1a1d";

        if (phase === 'propose') {
            // Calm Blue/Green
            gradient = "linear-gradient(rgba(20, 40, 50, 0.9), rgba(26, 26, 29, 0.95))";
        } else if (phase === 'vote') {
            // Tense Purple
            gradient = "linear-gradient(rgba(40, 20, 50, 0.9), rgba(26, 26, 29, 0.95))";
        } else if (phase === 'mission') {
            // Dark Red/Orange tension
            gradient = "linear-gradient(rgba(50, 20, 20, 0.9), rgba(26, 26, 29, 0.95))";
        } else if (phase === 'gameover') {
             gradient = "linear-gradient(rgba(10, 10, 10, 0.95), rgba(0, 0, 0, 0.95))";
        }

        // Keep the texture pattern
        body.style.backgroundImage = `${gradient}, url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232b2b33' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;
    }
};
