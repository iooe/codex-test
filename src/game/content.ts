import type { Relic, RoomDefinition } from './types';

export const ROOMS: RoomDefinition[] = [
  {
    id: 'cellar-ambush',
    title: 'Погреб: первые карты',
    enemies: [
      { name: 'Слизень', maxHealth: 5, attack: 1, coins: 2, trait: 'none' },
      { name: 'Гоблин', maxHealth: 7, attack: 2, coins: 3, trait: 'none' }
    ]
  },
  {
    id: 'bone-table',
    title: 'Костяной стол',
    enemies: [
      { name: 'Скелет', maxHealth: 8, attack: 2, coins: 3, trait: 'armored' },
      { name: 'Летучая мышь', maxHealth: 4, attack: 1, coins: 2, trait: 'poison' },
      { name: 'Мимик', maxHealth: 10, attack: 3, coins: 5, trait: 'none' }
    ]
  },
  {
    id: 'folding-gate',
    title: 'Врата складок',
    enemies: [
      { name: 'Двойник', maxHealth: 9, attack: 2, coins: 4, trait: 'split' },
      { name: 'Страж кубов', maxHealth: 14, attack: 4, coins: 7, trait: 'armored' }
    ]
  },
  {
    id: 'boss',
    title: 'Босс: Архивариус бросков',
    enemies: [
      { name: 'Архивариус', maxHealth: 24, attack: 5, coins: 12, trait: 'armored' }
    ]
  }
];

export const RELICS: Relic[] = [
  {
    id: 'extra-die',
    name: '+1 кубик',
    description: 'Каждый ход бросай на один кубик больше.'
  },
  {
    id: 'first-block',
    name: 'Складной щит',
    description: 'В начале комнаты получай 3 щита.'
  },
  {
    id: 'lucky-edge',
    name: 'Счастливое ребро',
    description: 'Первый кубик каждого броска получает +1 к значению, максимум 6.'
  },
  {
    id: 'coin-heal',
    name: 'Монетный бинт',
    description: 'После выбора награды лечись на 2 здоровья.'
  },
  {
    id: 'reroll-kit',
    name: 'Набор переброса',
    description: 'Получай +1 переброс в каждой комнате.'
  }
];
