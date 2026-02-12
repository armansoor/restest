// Wrapper for Toastify
export const Toaster = {
    show: function(msg, type='info') {
        let color = "#333";
        if(type === 'error') color = "var(--accent-red)";
        if(type === 'success') color = "var(--accent-blue)";

        Toastify({
            text: msg,
            duration: 3000,
            gravity: "top", // `top` or `bottom`
            position: "center", // `left`, `center` or `right`
            backgroundColor: color,
            stopOnFocus: true, // Prevents dismissing of toast on hover
        }).showToast();
    }
};

// Wrapper for Anime.js
export const Animator = {
    animateFadeIn: function(element) {
        anime({
            targets: element,
            opacity: [0, 1],
            translateY: [20, 0],
            easing: 'easeOutExpo',
            duration: 800
        });
    },

    pulse: function(element) {
        anime({
            targets: element,
            scale: [1, 1.2, 1],
            duration: 1000,
            loop: 3
        });
    }
};
