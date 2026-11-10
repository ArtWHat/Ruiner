/** OpenDota game_mode / lobby_type → читаемые ярлыки. */
const GAME_MODE: Record<number, string> = {
  0: 'None',
  1: 'All Pick',
  2: 'Captains Mode',
  3: 'Random Draft',
  4: 'Single Draft',
  5: 'All Random',
  12: 'Least Played',
  13: 'Limited Heroes',
  14: 'Compendium',
  15: 'Custom',
  16: 'Captains Draft',
  18: 'Ability Draft',
  20: 'All Random Deathmatch',
  21: '1v1 Mid',
  22: 'All Pick',
  23: 'Turbo',
  24: 'Mutation',
}

const LOBBY: Record<number, string> = {
  0: 'Обычная',
  1: 'Практика',
  2: 'Турнир',
  4: 'Co-op боты',
  5: 'Рейтинг (команда)',
  6: 'Рейтинг (соло)',
  7: 'Рейтинг',
  8: '1v1 Mid',
  9: 'Battle Cup',
}

export function isTurbo(gameMode?: number): boolean {
  return gameMode === 23
}

export function matchTypeLabel(gameMode?: number, lobbyType?: number): string {
  const mode =
    gameMode === 23
      ? 'Turbo'
      : gameMode !== undefined
        ? (GAME_MODE[gameMode] ?? `Режим ${gameMode}`)
        : undefined

  const ranked =
    lobbyType === 5 || lobbyType === 6 || lobbyType === 7 || gameMode === 22

  if (gameMode === 23) {
    return ranked ? 'Turbo · Рейтинг' : 'Turbo'
  }

  if (ranked) {
    return mode && mode !== 'All Pick' ? `Рейтинг · ${mode}` : 'Рейтинг · All Pick'
  }

  if (mode) return mode
  if (lobbyType !== undefined && LOBBY[lobbyType]) return LOBBY[lobbyType]
  return 'Обычная игра'
}
