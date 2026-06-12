import './game/styles.css';
import { Game } from './game/Game';

const container = document.getElementById('game-container');
if (!container) throw new Error('#game-container not found');

container.style.position = 'relative';
container.style.display = 'block';

const game = new Game(container);

if (import.meta.env.DEV) {
  (window as unknown as { game: Game }).game = game;
}

export default game;
