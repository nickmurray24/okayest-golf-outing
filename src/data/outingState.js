import { outingConfig, getTotalPoints } from './outingConfig';
import { blankHoles, normalizeHoles, getMatchProgress, hasEnteredScores } from './scoring';

// Phase 3 storage is PER BROWSER. Supabase will replace this persistence layer in Phase 4.
export const STORAGE_KEY = 'okayest-golf-setup-v3';
export const LEGACY_STORAGE_KEY = 'okayest-golf-setup-v2';
export const DATA_VERSION = 3;
export const SIDE_IDS = ['black', 'white'];

export const playersPerSide = (roundId) => (roundId === 'singles' ? 1 : 2);
export const createMatch = (roundId, number) => ({
  id: `${roundId}-${number}`,
  roundId,
  number,
  black: Array(playersPerSide(roundId)).fill(''),
  white: Array(playersPerSide(roundId)).fill(''),
  holes: blankHoles(),
  finalized: false,
  revision: 0,
});

export const createInitialOuting = () => ({
  version: DATA_VERSION,
  config: JSON.parse(JSON.stringify(outingConfig)),
  players: [],
  matches: outingConfig.rounds.flatMap((round) =>
    Array.from({ length: round.matchCount }, (_, index) => createMatch(round.id, index + 1))
  ),
});

// Normalise imported/local data rather than trusting every shape read from storage.
export const normalizeOuting = (input) => {
  if (!input || ![2, DATA_VERSION].includes(input.version) || !input.config || !Array.isArray(input.players) || !Array.isArray(input.matches)) {
    throw new Error('This is not a supported Okayest Golf setup file.');
  }
  const defaults = createInitialOuting();
  const players = [];
  const ids = new Set();
  for (const candidate of input.players) {
    if (!candidate || typeof candidate.id !== 'string' || !candidate.id || ids.has(candidate.id) || typeof candidate.name !== 'string') continue;
    const name = candidate.name.trim().slice(0, 70);
    if (!name) continue;
    const teamId = SIDE_IDS.includes(candidate.teamId) ? candidate.teamId : '';
    ids.add(candidate.id);
    players.push({ id: candidate.id, name, teamId });
  }
  const rounds = defaults.config.rounds.map((base) => {
    const source = input.config.rounds?.find((round) => round?.id === base.id);
    const matchCount = Number(source?.matchCount);
    const pointsPerMatch = Number(source?.pointsPerMatch);
    return {
      ...base,
      matchCount: Number.isInteger(matchCount) && matchCount >= 1 && matchCount <= 200 ? matchCount : base.matchCount,
      pointsPerMatch: Number.isFinite(pointsPerMatch) && pointsPerMatch >= 0.5 && pointsPerMatch <= 10 && Number.isInteger(pointsPerMatch * 2) ? pointsPerMatch : base.pointsPerMatch,
    };
  });
  const teams = defaults.config.teams.map((base) => {
    const source = input.config.teams?.find((team) => team?.id === base.id);
    return { ...base, name: typeof source?.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 35) : base.name };
  });
  const matches = rounds.flatMap((round) => {
    const usedInRound = new Set();
    return Array.from({ length: round.matchCount }, (_, index) => {
      const number = index + 1;
      const base = createMatch(round.id, number);
      const stored = input.matches.find((m) => m?.roundId === round.id && m?.number === number);
      SIDE_IDS.forEach((side) => {
        base[side] = base[side].map((_, playerIndex) => {
          const id = stored?.[side]?.[playerIndex];
          const player = players.find((candidate) => candidate.id === id && candidate.teamId === side);
          if (!player || usedInRound.has(id)) return '';
          usedInRound.add(id);
          return id;
        });
      });
      // Do not preserve scores if a pairing was altered or a player was removed.
      const pairingsUnchanged = SIDE_IDS.every((side) =>
        base[side].every((id, index) => id && id === stored?.[side]?.[index]));
      base.revision = Number.isInteger(stored?.revision) && stored.revision >= 0 ? stored.revision : 0;
      if (pairingsUnchanged && input.version === DATA_VERSION) {
        base.holes = normalizeHoles(stored.holes);
        base.finalized = Boolean(stored.finalized) && getMatchProgress(base).decided;
      }
      return base;
    });
  });
  const result = { version: DATA_VERSION, config: { ...defaults.config, teams, rounds }, players, matches };
  if (getTotalPoints(result.config) <= 0) throw new Error('Invalid point configuration.');
  return result;
};

export function readOuting() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return saved ? normalizeOuting(JSON.parse(saved)) : createInitialOuting();
  } catch (error) {
    // Keep an invalid or stale saved version from crashing the app.
    return createInitialOuting();
  }
}

export function saveOuting(value) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getMatchStatus(match) {
  const assigned = [...match.black, ...match.white].filter(Boolean).length;
  const required = match.black.length + match.white.length;
  return { assigned, required, complete: assigned === required };
}

export function getRosterCounts(players) {
  return {
    black: players.filter((player) => player.teamId === 'black').length,
    white: players.filter((player) => player.teamId === 'white').length,
    unassigned: players.filter((player) => !player.teamId).length,
  };
}

export function getReadyMatches(matches) {
  return matches.filter((match) => getMatchStatus(match).complete).length;
}

export function resizeMatches(matches, nextRounds) {
  return nextRounds.flatMap((round) => Array.from({ length: round.matchCount }, (_, index) =>
    matches.find((match) => match.roundId === round.id && match.number === index + 1) || createMatch(round.id, index + 1)
  ));
}

// A golfer may play in different rounds, but never in two matches in the same round.
export function assignPlayer(matches, players, roundId, matchId, side, position, playerId) {
  if (!SIDE_IDS.includes(side)) throw new Error('Unknown team.');
  const match = matches.find((m) => m.id === matchId && m.roundId === roundId);
  if (!match || !Number.isInteger(position) || position < 0 || position >= match[side].length) throw new Error('Unknown match slot.');
  if (playerId) {
    const player = players.find((p) => p.id === playerId);
    if (!player || player.teamId !== side) throw new Error('Choose a golfer from the correct team.');
    const alreadyAssigned = matches.some((m) => m.roundId === roundId && SIDE_IDS.some((team) => m[team].some((id, index) => id === playerId && !(m.id === matchId && team === side && index === position))));
    if (alreadyAssigned) throw new Error('That golfer is already playing in this round.');
  }
  if (hasEnteredScores(match) || match.finalized) throw new Error('This match has scores. Clear or finish scoring before changing its lineup.');
  return matches.map((m) => m.id === matchId ? { ...m, [side]: m[side].map((id, index) => index === position ? playerId : id) } : m);
}
