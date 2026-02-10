import { game } from './game.js';
import { ui } from './ui.js';
import { turnManager } from './turnManager.js';

// Expose game to window for debugging/Playwright
window.game = game;
window.ui = ui;
window.turnManager = turnManager;

document.getElementById('btn-init').addEventListener('click', () => game.init());
document.getElementById('btn-rules').addEventListener('click', () => ui.showScreen('rules'));
document.getElementById('btn-back-menu').addEventListener('click', () => ui.showScreen('menu'));
document.getElementById('btn-pass-confirm').addEventListener('click', () => turnManager.confirmReady());
