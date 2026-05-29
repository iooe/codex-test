import { RELICS, ROOMS } from './content';
import type { DiceFace, Die, EnemyCard, GameState, Relic, RoomDefinition } from './types';

type Random = () => number;

const MAX_LOG = 8;

const clone = <T>(value: T): T => structuredClone(value);

const rollFace = (random: Random): DiceFace => (Math.floor(random() * 6) + 1) as DiceFace;

const hasRelic = (state: GameState, relicId: string): boolean =>
  state.hero.relics.some((relic) => relic.id === relicId);

const addLog = (state: GameState, entry: string): GameState => ({
  ...state,
  log: [entry, ...state.log].slice(0, MAX_LOG)
});

const makeEnemies = (room: RoomDefinition, runId: number): EnemyCard[] =>
  room.enemies.map((enemy, index) => ({
    ...enemy,
    id: `${room.id}-${runId}-${index}`,
    health: enemy.maxHealth,
    folded: false
  }));

export function createInitialState(random: Random = Math.random): GameState {
  const state: GameState = {
    runId: Date.now(),
    phase: 'rolling',
    roomIndex: 0,
    turn: 1,
    hero: {
      maxHealth: 24,
      health: 24,
      shield: 0,
      coins: 0,
      diceCount: 5,
      rerolls: 1,
      relics: []
    },
    dice: [],
    enemies: [],
    log: ['Добро пожаловать в прототип: бросай кубики и складывай карты врагов.'],
    rewardChoices: []
  };

  return startRoom(state, 0, random);
}

export function startRoom(state: GameState, roomIndex: number, random: Random = Math.random): GameState {
  const room = ROOMS[roomIndex];
  if (!room) {
    return { ...state, phase: 'victory', enemies: [], dice: [], rewardChoices: [] };
  }

  const rerolls = 1 + (hasRelic(state, 'reroll-kit') ? 1 : 0);
  const shield = hasRelic(state, 'first-block') ? state.hero.shield + 3 : state.hero.shield;
  const roomState: GameState = {
    ...state,
    roomIndex,
    phase: 'rolling',
    turn: 1,
    hero: { ...state.hero, rerolls, shield },
    dice: [],
    enemies: makeEnemies(room, state.runId),
    rewardChoices: []
  };

  return rollDice(addLog(roomState, `Комната: ${room.title}.`), random);
}

export function rollDice(state: GameState, random: Random = Math.random): GameState {
  if (state.phase !== 'rolling' && state.phase !== 'assigning') return state;

  const count = state.hero.diceCount + (hasRelic(state, 'extra-die') ? 1 : 0);
  const dice: Die[] = Array.from({ length: count }, (_, index) => {
    const baseValue = rollFace(random);
    const shouldBoost = index === 0 && hasRelic(state, 'lucky-edge');
    return {
      id: `t${state.turn}-d${index}-${baseValue}`,
      value: Math.min(6, baseValue + (shouldBoost ? 1 : 0)) as DiceFace,
      used: false,
      boosted: shouldBoost
    };
  });

  return addLog({ ...state, phase: 'assigning', dice }, `Бросок: ${dice.map((die) => die.value).join(', ')}.`);
}

export function rerollAvailableDice(state: GameState, random: Random = Math.random): GameState {
  if (state.phase !== 'assigning' || state.hero.rerolls <= 0) return state;

  const dice = state.dice.map((die) => (die.used ? die : { ...die, value: rollFace(random), boosted: false }));
  return addLog(
    { ...state, dice, hero: { ...state.hero, rerolls: state.hero.rerolls - 1 } },
    `Переброс: ${dice.filter((die) => !die.used).map((die) => die.value).join(', ')}.`
  );
}

export function assignDieToEnemy(state: GameState, dieId: string, enemyId: string): GameState {
  if (state.phase !== 'assigning') return state;

  const die = state.dice.find((item) => item.id === dieId);
  const enemy = state.enemies.find((item) => item.id === enemyId);
  if (!die || die.used || !enemy || enemy.folded) return state;

  const armorPenalty = enemy.trait === 'armored' ? 1 : 0;
  const damage = Math.max(1, die.value - armorPenalty);
  let foldedReward = 0;
  const enemies = state.enemies.map((item) => {
    if (item.id !== enemyId) return item;
    const health = Math.max(0, item.health - damage);
    const folded = health === 0;
    foldedReward = folded ? item.coins : 0;
    return { ...item, health, folded };
  });
  const dice = state.dice.map((item) => (item.id === dieId ? { ...item, used: true } : item));
  let nextState = addLog(
    {
      ...state,
      dice,
      enemies,
      hero: { ...state.hero, coins: state.hero.coins + foldedReward }
    },
    foldedReward > 0
      ? `${enemy.name} сложен! Получено ${foldedReward} монет.`
      : `${die.value} урона по ${enemy.name}${armorPenalty ? ' (броня -1)' : ''}.`
  );

  if (enemies.every((item) => item.folded)) {
    nextState = enterReward(nextState);
  } else if (dice.every((item) => item.used)) {
    nextState = enemyTurn(nextState);
  }

  return nextState;
}

export function enemyTurn(state: GameState): GameState {
  if (state.phase !== 'assigning') return state;

  const incoming = state.enemies
    .filter((enemy) => !enemy.folded)
    .reduce((total, enemy) => total + enemy.attack + (enemy.trait === 'poison' ? 1 : 0), 0);
  const blocked = Math.min(state.hero.shield, incoming);
  const damage = incoming - blocked;
  const hero = {
    ...state.hero,
    health: Math.max(0, state.hero.health - damage),
    shield: Math.max(0, state.hero.shield - incoming)
  };

  if (hero.health <= 0) {
    return addLog({ ...state, phase: 'defeat', hero, dice: [] }, `Враги наносят ${damage} урона. Забег окончен.`);
  }

  const splitEnemies = state.enemies.map((enemy) => {
    if (enemy.folded || enemy.trait !== 'split' || enemy.health >= enemy.maxHealth) return enemy;
    return { ...enemy, health: Math.min(enemy.maxHealth, enemy.health + 1) };
  });

  return rollDice(
    addLog(
      {
        ...state,
        hero: { ...hero, rerolls: 1 + (hasRelic(state, 'reroll-kit') ? 1 : 0) },
        enemies: splitEnemies,
        turn: state.turn + 1,
        phase: 'rolling',
        dice: []
      },
      `Ответ врагов: ${incoming} атаки, щит блокирует ${blocked}, герой теряет ${damage}.`
    )
  );
}

export function enterReward(state: GameState): GameState {
  if (state.roomIndex >= ROOMS.length - 1) {
    return addLog({ ...state, phase: 'victory', dice: [], rewardChoices: [] }, 'Босс сложен. Победа!');
  }

  const owned = new Set(state.hero.relics.map((relic) => relic.id));
  const choices = RELICS.filter((relic) => !owned.has(relic.id)).slice(0, 3);
  return addLog({ ...state, phase: 'reward', dice: [], rewardChoices: choices }, 'Комната очищена. Выбери улучшение.');
}

export function chooseReward(state: GameState, relicId: string, random: Random = Math.random): GameState {
  if (state.phase !== 'reward') return state;

  const relic = state.rewardChoices.find((choice) => choice.id === relicId);
  const heroRelics: Relic[] = relic ? [...state.hero.relics, clone(relic)] : state.hero.relics;
  const healed = relic?.id === 'coin-heal' ? 2 : 0;
  const nextState: GameState = {
    ...state,
    hero: {
      ...state.hero,
      relics: heroRelics,
      health: Math.min(state.hero.maxHealth, state.hero.health + healed)
    }
  };

  return startRoom(addLog(nextState, relic ? `Получено улучшение: ${relic.name}.` : 'Награда пропущена.'), state.roomIndex + 1, random);
}

export function restart(random: Random = Math.random): GameState {
  return createInitialState(random);
}
