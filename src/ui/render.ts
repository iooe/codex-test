import { ROOMS } from '../game/content';
import { assignDieToEnemy, chooseReward, rerollAvailableDice, restart } from '../game/engine';
import type { Die, EnemyCard, GameState } from '../game/types';
import './styles.css';

let state: GameState;
let selectedDieId: string | null = null;

const traitText: Record<EnemyCard['trait'], string> = {
  none: 'обычный',
  armored: 'броня',
  poison: 'яд',
  split: 'регенерация'
};

const traitHint: Record<EnemyCard['trait'], string> = {
  none: 'Без особенностей',
  armored: 'Каждый кубик наносит на 1 урон меньше',
  poison: 'Атакует на 1 сильнее',
  split: 'Лечится на 1 HP после хода'
};

const enemyArt: Record<EnemyCard['trait'], string> = {
  none: '👹',
  armored: '🛡️',
  poison: '🦇',
  split: '🧬'
};

const phaseTitle: Record<GameState['phase'], string> = {
  rolling: 'Бросок',
  assigning: 'Твой ход',
  reward: 'Сокровища',
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
    <main class="game-shell">
      <section class="tabletop" aria-label="Игровое поле Dice Fold">
        <div class="ambient-orb orb-one"></div>
        <div class="ambient-orb orb-two"></div>

        <header class="game-hud">
          <div class="title-lockup">
            <p class="eyebrow">Dice Fold Prototype</p>
            <h1>Подземелье складных карт</h1>
            <p class="subtitle">Бросай физичные d6, бей карты врагов и складывай их прямо на игровом столе.</p>
          </div>
          <div class="run-stats" aria-label="Состояние героя">
            ${stat('❤ HP', `${state.hero.health}/${state.hero.maxHealth}`)}
            ${stat('◆ Щит', state.hero.shield)}
            ${stat('✦ Монеты', state.hero.coins)}
            ${stat('↻ Ход', state.turn)}
          </div>
        </header>

        <section class="game-board">
          <aside class="left-rail">
            <article class="hero-card game-card">
              <span class="tag">${phaseTitle[state.phase]}</span>
              <div class="hero-portrait" aria-hidden="true">🧙</div>
              <h2>Искатель складок</h2>
              <div class="meter health-meter"><span style="width: ${heroPercent()}%"></span></div>
              <p>${room?.title ?? 'Финальный зал'} · Комната ${Math.min(state.roomIndex + 1, ROOMS.length)} / ${ROOMS.length}</p>
              <button data-action="restart" class="rune-button ghost">Новый забег</button>
            </article>

            <article class="deck-zone game-card" aria-label="Колода карт">
              <div class="deck-stack" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </div>
              <div>
                <span class="tag">Колода</span>
                <h3>Комнаты и реликвии</h3>
                <p>Карты дышат, покачиваются и ждут следующего раскрытия.</p>
              </div>
            </article>

            <article class="relic-board game-card">
              <h3>Реликвии</h3>
              <div class="relics">
                ${state.hero.relics.length ? state.hero.relics.map((relic) => `<div class="relic"><b>${relic.name}</b><small>${relic.description}</small></div>`).join('') : '<p class="muted">Пока нет улучшений.</p>'}
              </div>
            </article>
          </aside>

          <section class="arena">
            <div class="room-banner">
              <span class="tag">${phaseTitle[state.phase]}</span>
              <h2>${room?.title ?? 'Подземелье очищено'}</h2>
            </div>
            ${renderOutcome()}
            ${renderEnemies(state.enemies)}
            ${renderDice()}
            ${renderRewards()}
          </section>

          <aside class="right-rail">
            <article class="log-card game-card">
              <h3>Журнал боя</h3>
              <ol>${state.log.map((entry) => `<li>${entry}</li>`).join('')}</ol>
            </article>
          </aside>
        </section>
      </section>
    </main>
  `;

  bind(root);
}

function heroPercent(): number {
  return Math.max(0, Math.min(100, (state.hero.health / state.hero.maxHealth) * 100));
}

function stat(label: string, value: string | number): string {
  return `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`;
}

function renderOutcome(): string {
  if (state.phase !== 'victory' && state.phase !== 'defeat') return '';
  const isWin = state.phase === 'victory';
  return `
    <div class="outcome ${isWin ? 'win' : 'loss'}">
      <div class="outcome-burst" aria-hidden="true">${isWin ? '🏆' : '💀'}</div>
      <h2>${isWin ? 'Победа!' : 'Герой пал'}</h2>
      <p>${isWin ? 'Все карты сложены, подземелье очищено.' : 'Попробуй другой порядок назначения кубиков.'}</p>
      <button class="rune-button" data-action="restart">Играть снова</button>
    </div>
  `;
}

function renderEnemies(enemies: EnemyCard[]): string {
  if (state.phase === 'reward' || state.phase === 'victory' || state.phase === 'defeat') return '';

  return `
    <div class="enemy-lane" aria-label="Карты врагов">
      ${enemies.map((enemy, index) => `
        <button class="enemy-card battle-card ${enemy.folded ? 'folded' : ''}" data-enemy-id="${enemy.id}" style="--tilt: ${index % 2 === 0 ? '-2deg' : '2deg'}" ${enemy.folded ? 'disabled' : ''}>
          <span class="card-glow"></span>
          <span class="fold-label">${enemy.folded ? 'Сложен' : traitText[enemy.trait]}</span>
          <div class="enemy-art" aria-hidden="true">${enemyArt[enemy.trait]}</div>
          <h3>${enemy.name}</h3>
          <div class="meter hp"><span style="width: ${(enemy.health / enemy.maxHealth) * 100}%"></span></div>
          <div class="card-stats">
            <span><b>${enemy.health}</b>/${enemy.maxHealth} HP</span>
            <span>⚔ ${enemy.attack}</span>
            <span>🪙 ${enemy.coins}</span>
          </div>
          <p>${traitHint[enemy.trait]}</p>
        </button>
      `).join('')}
    </div>
  `;
}

function renderDice(): string {
  if (state.phase !== 'assigning') return '';

  return `
    <div class="dice-tray game-card">
      <div class="panel-head">
        <div>
          <span class="tag">Physics dice</span>
          <h2>Бросок на столе</h2>
          <p>Выбери кубик, затем карту врага. Наведение поднимает кости как реальные игровые токены.</p>
        </div>
        <button class="rune-button" data-action="reroll" ${state.hero.rerolls <= 0 ? 'disabled' : ''}>Переброс (${state.hero.rerolls})</button>
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
    <button class="die ${selected} ${die.used ? 'used' : ''}" data-die-id="${die.id}" style="--roll: ${die.value * 17}deg" aria-label="Кубик ${die.value}" ${die.used ? 'disabled' : ''}>
      <span class="die-face face-${die.value}">${dicePips(die.value)}</span>
      ${die.boosted ? '<small>+1</small>' : ''}
    </button>
  `;
}

function dicePips(value: number): string {
  return Array.from({ length: value }, () => '<i></i>').join('');
}

function renderRewards(): string {
  if (state.phase !== 'reward') return '';

  return `
    <div class="reward-grid">
      ${state.rewardChoices.map((relic, index) => `
        <button class="reward-card battle-card" data-reward-id="${relic.id}" style="--tilt: ${index - 1}deg">
          <span class="card-glow"></span>
          <span class="tag">Улучшение</span>
          <div class="enemy-art relic-art" aria-hidden="true">✦</div>
          <h3>${relic.name}</h3>
          <p>${relic.description}</p>
        </button>
      `).join('')}
      <button class="reward-card battle-card skip" data-reward-id="skip" style="--tilt: 2deg">
        <span class="card-glow"></span>
        <span class="tag">Риск</span>
        <div class="enemy-art relic-art" aria-hidden="true">…</div>
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
