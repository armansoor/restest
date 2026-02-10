export const Random = {
    // Fisher-Yates Shuffle
    shuffle: function(array) {
        let currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle.
        while (currentIndex != 0) {

            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }

        return array;
    },

    // Get random integer min (inclusive) to max (exclusive)
    range: function(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    },

    // Pick random element from array
    pick: function(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
};
