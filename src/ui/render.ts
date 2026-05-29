import { ROOMS } from '../game/content';
import { assignDieToEnemy, chooseReward, rerollAvailableDice, restart } from '../game/engine';
import type { Die, EnemyCard, GameState } from '../game/types';
import './styles.css';

let state: GameState;
let selectedDieId: string | null = null;
let draggedDieId: string | null = null;

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
            <p class="subtitle">Игровое поле — это 3D стол: карты врагов лежат как настоящая колода, а кубики можно физически бросать мышью в слоты.</p>
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

          <section class="arena" aria-label="3D игровой стол">
            <div class="room-banner">
              <span class="tag">${phaseTitle[state.phase]}</span>
              <h2>${room?.title ?? 'Подземелье очищено'}</h2>
            </div>
            <div class="physical-table">
              <div class="table-rim" aria-hidden="true"></div>
              <div class="felt-surface">
                <div class="table-depth-lines" aria-hidden="true"></div>
                <div class="draw-pile" aria-label="Колода карт на столе">
                  <span></span><span></span><span></span>
                  <b>колода</b>
                </div>
                ${renderOutcome()}
                ${renderEnemies(state.enemies)}
                ${renderRewards()}
                ${renderDice()}
              </div>
            </div>
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
    <div class="enemy-lane" aria-label="Карты врагов, выложенные из колоды на игровой стол">
      ${enemies.map((enemy, index) => `
        <button class="enemy-slot ${enemy.folded ? 'slot-cleared' : ''}" data-enemy-id="${enemy.id}" aria-label="Слот врага ${enemy.name}" ${enemy.folded ? 'disabled' : ''}>
          <span class="slot-ring"></span>
          <span class="slot-caption">Брось кубик сюда</span>
          <span class="enemy-card battle-card playing-card ${enemy.folded ? 'folded' : ''}" style="--tilt: ${index % 2 === 0 ? '-4deg' : '4deg'}; --deal-x: ${(index - 1) * 34}px;">
            <span class="card-back-pattern" aria-hidden="true"></span>
            <span class="card-glow"></span>
            <span class="card-suit">♠</span>
            <span class="fold-label">${enemy.folded ? 'Сложен' : traitText[enemy.trait]}</span>
            <span class="enemy-art" aria-hidden="true">${enemyArt[enemy.trait]}</span>
            <h3>${enemy.name}</h3>
            <span class="meter hp"><span style="width: ${(enemy.health / enemy.maxHealth) * 100}%"></span></span>
            <span class="card-stats">
              <span><b>${enemy.health}</b>/${enemy.maxHealth} HP</span>
              <span>⚔ ${enemy.attack}</span>
              <span>🪙 ${enemy.coins}</span>
            </span>
            <p>${traitHint[enemy.trait]}</p>
            <span class="card-suit bottom">♣</span>
          </span>
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
          <span class="tag">3D physics dice</span>
          <h2>Кубики на столе</h2>
          <p>Зажми кубик мышью, размахнись и отпусти над слотом врага — куб летит как физическая модель. Клик по-прежнему выбирает кубик.</p>
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
    <button class="die ${selected} ${die.used ? 'used' : ''}" data-die-id="${die.id}" style="--roll: ${die.value * 17}deg; --spin-x: ${die.value * 31}deg; --spin-y: ${die.value * -43}deg" aria-label="3D кубик ${die.value}" ${die.used ? 'disabled' : ''}>
      <span class="die-shadow" aria-hidden="true"></span>
      <span class="die-cube" aria-hidden="true">
        <span class="cube-face cube-front face-${die.value}">${dicePips(die.value)}</span>
        <span class="cube-face cube-back face-6">${dicePips(6)}</span>
        <span class="cube-face cube-right face-3">${dicePips(3)}</span>
        <span class="cube-face cube-left face-4">${dicePips(4)}</span>
        <span class="cube-face cube-top face-5">${dicePips(5)}</span>
        <span class="cube-face cube-bottom face-2">${dicePips(2)}</span>
      </span>
      <span class="die-value">${die.value}</span>
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
    button.addEventListener('pointerdown', (event) => beginDieDrag(event, button, root));
    button.addEventListener('click', () => {
      if (draggedDieId) return;
      selectedDieId = button.dataset.dieId ?? null;
      render(root);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-enemy-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!selectedDieId || draggedDieId) return;
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


function beginDieDrag(event: PointerEvent, dieButton: HTMLElement, root: HTMLElement): void {
  if (event.button !== 0 || dieButton.hasAttribute('disabled')) return;

  const dieId = dieButton.dataset.dieId;
  if (!dieId) return;

  draggedDieId = dieId;
  selectedDieId = dieId;
  dieButton.setPointerCapture(event.pointerId);
  dieButton.classList.add('dragging');
  moveDraggedDie(dieButton, event.clientX, event.clientY);

  const onPointerMove = (moveEvent: PointerEvent) => {
    moveEvent.preventDefault();
    moveDraggedDie(dieButton, moveEvent.clientX, moveEvent.clientY);
    highlightEnemySlot(moveEvent.clientX, moveEvent.clientY, root);
  };

  const onPointerUp = (upEvent: PointerEvent) => {
    dieButton.releasePointerCapture(event.pointerId);
    dieButton.removeEventListener('pointermove', onPointerMove);
    dieButton.removeEventListener('pointerup', onPointerUp);
    dieButton.removeEventListener('pointercancel', onPointerUp);
    const target = findEnemySlot(upEvent.clientX, upEvent.clientY, root);
    root.querySelectorAll('.enemy-slot.hot-drop').forEach((slot) => slot.classList.remove('hot-drop'));
    dieButton.classList.remove('dragging');
    dieButton.style.removeProperty('--drag-x');
    dieButton.style.removeProperty('--drag-y');

    window.setTimeout(() => {
      draggedDieId = null;
    }, 0);

    if (target) {
      update(root, assignDieToEnemy(state, dieId, target.dataset.enemyId ?? ''));
      return;
    }

    render(root);
  };

  dieButton.addEventListener('pointermove', onPointerMove);
  dieButton.addEventListener('pointerup', onPointerUp);
  dieButton.addEventListener('pointercancel', onPointerUp);
}

function moveDraggedDie(dieButton: HTMLElement, clientX: number, clientY: number): void {
  dieButton.style.setProperty('--drag-x', `${clientX}px`);
  dieButton.style.setProperty('--drag-y', `${clientY}px`);
}

function highlightEnemySlot(clientX: number, clientY: number, root: HTMLElement): void {
  const target = findEnemySlot(clientX, clientY, root);
  root.querySelectorAll('.enemy-slot.hot-drop').forEach((slot) => {
    if (slot !== target) slot.classList.remove('hot-drop');
  });
  target?.classList.add('hot-drop');
}

function findEnemySlot(clientX: number, clientY: number, root: HTMLElement): HTMLElement | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  const slot = elements.find((element) => element instanceof HTMLElement && element.matches('[data-enemy-id]:not(:disabled)'));
  return slot instanceof HTMLElement && root.contains(slot) ? slot : null;
}
