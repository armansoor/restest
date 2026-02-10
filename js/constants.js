export const GAME_MATRIX = {
    5: { spies: 2, missions: [2, 3, 2, 3, 3], failsRequired: [1, 1, 1, 1, 1] },
    6: { spies: 2, missions: [2, 3, 4, 3, 4], failsRequired: [1, 1, 1, 1, 1] },
    7: { spies: 3, missions: [2, 3, 3, 4, 4], failsRequired: [1, 1, 1, 2, 1] }, // Mission 4 needs 2 fails
    8: { spies: 3, missions: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
    9: { spies: 3, missions: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
    10: { spies: 4, missions: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] }
};
