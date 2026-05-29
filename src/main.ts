import { createInitialState } from './game/engine';
import { mountGame } from './ui/render';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Root element #app was not found.');
}

mountGame(root, createInitialState());
