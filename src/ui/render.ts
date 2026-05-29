import { ROOMS } from '../game/content';
import { assignDieToEnemy, chooseReward, rerollAvailableDice, restart } from '../game/engine';
import type { Die, EnemyCard, GameState } from '../game/types';
import './styles.css';

let state: GameState;
let selectedDieId: string | null = null;

const traitText: Record<EnemyCard['trait'], string> = {
  none: 'обычный',
  armored: 'броня: каждый кубик -1 урон',
  poison: 'яд: +1 атака',
  split: 'регенерация: +1 HP после хода'
};

const phaseTitle: Record<GameState['phase'], string> = {
  rolling: 'Бросок',
  assigning: 'Назначь кубики',
  reward: 'Награда',
  victory: 'Победа',
  defeat: 'Поражение'
};

export function mountGame(root: HTMLElement, initialState: GameState): void {
  state = initialState;
  render(root);
}

function update(root: HTMLElement, nextState: GameState): void {
  state = nextState;
  selectedDieId = state.dice.some((die) => die.id === selectedDieId && !die.used) ? selectedDieId : null;
  render(root);
}

function render(root: HTMLElement): void {
  const room = ROOMS[state.roomIndex];
  root.innerHTML = `
    <main class="shell">
      <section class="hero-panel">
        <div>
          <p class="eyebrow">Dice Fold Prototype</p>
          <h1>Подземелье складных карт</h1>
          <p class="subtitle">Клон-основа: бросай d6, распределяй значения по врагам и «складывай» карты, когда их HP падает до нуля.</p>
        </div>
        <div class="stats">
          ${stat('HP', `${state.hero.health}/${state.hero.maxHealth}`)}
          ${stat('Щит', state.hero.shield)}
          ${stat('Монеты', state.hero.coins)}
          ${stat('Ход', state.turn)}
        </div>
      </section>

      <section class="board">
        <aside class="sidebar">
          <div class="card room-card">
            <span class="tag">${phaseTitle[state.phase]}</span>
            <h2>${room?.title ?? 'Финал'}</h2>
            <p>Комната ${Math.min(state.roomIndex + 1, ROOMS.length)} / ${ROOMS.length}</p>
            <button data-action="restart" class="ghost">Новый забег</button>
          </div>
          <div class="card">
            <h3>Реликвии</h3>
            <div class="relics">
              ${state.hero.relics.length ? state.hero.relics.map((relic) => `<div class="relic"><b>${relic.name}</b><small>${relic.description}</small></div>`).join('') : '<p class="muted">Пока нет улучшений.</p>'}
            </div>
          </div>
          <div class="card log-card">
            <h3>Журнал</h3>
            <ol>${state.log.map((entry) => `<li>${entry}</li>`).join('')}</ol>
          </div>
        </aside>

        <section class="play-area">
          ${renderOutcome()}
          ${renderEnemies(state.enemies)}
          ${renderDice()}
          ${renderRewards()}
        </section>
      </section>
    </main>
  `;

  bind(root);
}

function stat(label: string, value: string | number): string {
  return `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`;
}

function renderOutcome(): string {
  if (state.phase !== 'victory' && state.phase !== 'defeat') return '';
  const isWin = state.phase === 'victory';
  return `
    <div class="outcome ${isWin ? 'win' : 'loss'}">
      <h2>${isWin ? 'Победа!' : 'Герой пал'}</h2>
      <p>${isWin ? 'Все карты сложены, подземелье очищено.' : 'Попробуй другой порядок назначения кубиков.'}</p>
      <button data-action="restart">Играть снова</button>
    </div>
  `;
}

function renderEnemies(enemies: EnemyCard[]): string {
  if (state.phase === 'reward' || state.phase === 'victory' || state.phase === 'defeat') return '';

  return `
    <div class="enemy-grid">
      ${enemies.map((enemy) => `
        <button class="enemy-card ${enemy.folded ? 'folded' : ''}" data-enemy-id="${enemy.id}" ${enemy.folded ? 'disabled' : ''}>
          <span class="fold-label">${enemy.folded ? 'Сложен' : traitText[enemy.trait]}</span>
          <h3>${enemy.name}</h3>
          <div class="hp"><span style="width: ${(enemy.health / enemy.maxHealth) * 100}%"></span></div>
          <p><b>${enemy.health}</b> / ${enemy.maxHealth} HP</p>
          <p>⚔ ${enemy.attack} · 🪙 ${enemy.coins}</p>
        </button>
      `).join('')}
    </div>
  `;
}

function renderDice(): string {
  if (state.phase !== 'assigning') return '';

  return `
    <div class="dice-panel card">
      <div class="panel-head">
        <div>
          <h2>Кубики</h2>
          <p>Выбери кубик, затем карту врага. Использованные кубики исчезают до следующего хода.</p>
        </div>
        <button data-action="reroll" ${state.hero.rerolls <= 0 ? 'disabled' : ''}>Переброс (${state.hero.rerolls})</button>
      </div>
      <div class="dice-row">
        ${state.dice.map(renderDie).join('')}
      </div>
    </div>
  `;
}

function renderDie(die: Die): string {
  const selected = die.id === selectedDieId ? 'selected' : '';
  return `
    <button class="die ${selected} ${die.used ? 'used' : ''}" data-die-id="${die.id}" ${die.used ? 'disabled' : ''}>
      <span>${die.value}</span>
      ${die.boosted ? '<small>+1</small>' : ''}
    </button>
  `;
}

function renderRewards(): string {
  if (state.phase !== 'reward') return '';

  return `
    <div class="reward-grid">
      ${state.rewardChoices.map((relic) => `
        <button class="reward-card" data-reward-id="${relic.id}">
          <span class="tag">Улучшение</span>
          <h3>${relic.name}</h3>
          <p>${relic.description}</p>
        </button>
      `).join('')}
      <button class="reward-card skip" data-reward-id="skip">
        <span class="tag">Риск</span>
        <h3>Пропустить</h3>
        <p>Без бонуса перейти дальше.</p>
      </button>
    </div>
  `;
}

function bind(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-die-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedDieId = button.dataset.dieId ?? null;
      render(root);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-enemy-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!selectedDieId) return;
      update(root, assignDieToEnemy(state, selectedDieId, button.dataset.enemyId ?? ''));
    });
  });

  root.querySelectorAll<HTMLElement>('[data-reward-id]').forEach((button) => {
    button.addEventListener('click', () => update(root, chooseReward(state, button.dataset.rewardId ?? 'skip')));
  });

  root.querySelectorAll<HTMLElement>('[data-action="reroll"]').forEach((button) => {
    button.addEventListener('click', () => update(root, rerollAvailableDice(state)));
  });

  root.querySelectorAll<HTMLElement>('[data-action="restart"]').forEach((button) => {
    button.addEventListener('click', () => update(root, restart()));
  });
}
