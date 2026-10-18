/**
 * Default outing settings. Phase 2 stores organizer edits in outingState.js.
 * No live scores, player accounts, or PINs are stored here.
 */
export const outingConfig = {
  name: 'The Okayest Golf Outing Ever',
  estimatedGolfers: 17,
  teams: [
    { id: 'black', name: 'Team Black' },
    { id: 'white', name: 'Team White' },
  ],
  rounds: [
    {
      id: 'singles',
      number: 1,
      name: 'Singles',
      shortName: 'Singles',
      format: '1 vs 1 · Match Play',
      matchCount: 8,
      pointsPerMatch: 1,
      holeStart: 1,
      holeEnd: 9,
      summary: 'Every golfer plays their own ball. The lowest score takes the hole.',
    },
    {
      id: 'alternate-shot',
      number: 2,
      name: 'Alternate Shot',
      shortName: 'Alt. Shot',
      format: '2 vs 2 · Match Play',
      matchCount: 4,
      pointsPerMatch: 1,
      holeStart: 10,
      holeEnd: 18,
      summary: 'Partners alternate tee shots by odd/even holes, then alternate strokes.',
    },
    {
      id: 'scramble',
      number: 3,
      name: '2 vs 2 Scramble',
      shortName: 'Scramble',
      format: '2 vs 2 · Match Play',
      matchCount: 4,
      pointsPerMatch: 1,
      holeStart: 1,
      holeEnd: 9,
      summary: 'Both partners hit; the team chooses which ball to play next.',
    },
  ],
};

export const getRoundPoints = (round) => round.matchCount * round.pointsPerMatch;

export const getTotalPoints = (config = outingConfig) =>
  config.rounds.reduce((sum, round) => sum + getRoundPoints(round), 0);

/** First score in half-point increments strictly greater than half the available points. */
export const getPointsToWin = (totalPoints) =>
  Math.floor(totalPoints) / 2 + 0.5;

/** When fractional-valued matches are possible, a tie can award quarter points. */
export const getOutingPointsToWin = (config = outingConfig) => {
  const total = getTotalPoints(config);
  const increment = config.rounds.some((round) => !Number.isInteger(round.pointsPerMatch)) ? 0.25 : 0.5;
  return (Math.floor(total / 2 / increment + 1e-9) + 1) * increment;
};

export const formatPoints = (value) =>
  Number.isInteger(value) ? String(value) :
  Number.isInteger(value * 2) ? value.toFixed(1) : value.toFixed(2);
