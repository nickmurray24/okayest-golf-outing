import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { outingConfig, getTotalPoints, getPointsToWin, getOutingPointsToWin } from './data/outingConfig';
import { createInitialOuting, assignPlayer, getMatchStatus, normalizeOuting, resizeMatches, STORAGE_KEY, LEGACY_STORAGE_KEY } from './data/outingState';
import { getMatchProgress, getStandings, updateHoleStrokes, finalizeMatch, reopenMatch } from './data/scoring';

beforeEach(() => {
  window.localStorage.clear();
});

function preparedOuting() {
  const outing = createInitialOuting();
  outing.players = [
    { id: 'alex', name: 'Alex Example', teamId: 'black' },
    { id: 'bailey', name: 'Bailey Example', teamId: 'white' },
  ];
  outing.matches = assignPlayer(outing.matches, outing.players, 'singles', 'singles-1', 'black', 0, 'alex');
  outing.matches = assignPlayer(outing.matches, outing.players, 'singles', 'singles-1', 'white', 0, 'bailey');
  return outing;
}

test('default format has 16 points, 8.5 to win, and 16 empty matches', () => {
  expect(getTotalPoints(outingConfig)).toBe(16);
  expect(getPointsToWin(16)).toBe(8.5);
  expect(getOutingPointsToWin(outingConfig)).toBe(8.5);
  expect(getOutingPointsToWin({ rounds: [{ matchCount: 3, pointsPerMatch: 0.5 }] })).toBe(1);
  const initial = createInitialOuting();
  expect(initial.matches).toHaveLength(16);
  expect(initial.players).toHaveLength(0);
  expect(initial.matches[0].holes).toHaveLength(9);
});

test('renders clubhouse, navigates to rules and round scores', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /the okayest golf outing ever/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /the rules/i }));
  expect(screen.getByRole('heading', { name: /house rules/i })).toBeInTheDocument();
  expect(screen.getByText(/Each player receives one mulligan per nine holes/i)).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /^home$/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: /ROUND 2.*HOLES 10.*18/i }));
  expect(screen.getByRole('heading', { name: 'Alternate Shot' })).toBeInTheDocument();
  expect(screen.getByText(/Choose a match, enter strokes/i)).toBeInTheDocument();
});

test('organizer can add a golfer and roster persists locally', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /^organize$/i }));
  fireEvent.change(screen.getByRole('textbox', { name: 'New golfer name' }), { target: { value: 'Alex Example' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'New golfer team' }), { target: { value: 'black' } });
  fireEvent.click(screen.getByRole('button', { name: /add golfer/i }));
  expect(screen.getByText('Alex Example')).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).players).toEqual([expect.objectContaining({ name: 'Alex Example', teamId: 'black' })]);
});

test('cannot assign one golfer to multiple matches in the same round', () => {
  const outing = preparedOuting();
  expect(getMatchStatus(outing.matches[0]).complete).toBe(true);
  expect(() => assignPlayer(outing.matches, outing.players, 'singles', 'singles-2', 'black', 0, 'alex')).toThrow(/already playing/);
  expect(() => assignPlayer(outing.matches, outing.players, 'alternate-shot', 'alternate-shot-1', 'black', 0, 'alex')).not.toThrow();
});

test('match counts resize without discarding remaining pairings', () => {
  const outing = preparedOuting();
  const resized = resizeMatches(outing.matches, outing.config.rounds.map((round) => ({ ...round, matchCount: round.id === 'singles' ? 10 : round.matchCount })));
  expect(resized).toHaveLength(18);
  expect(resized[0].black[0]).toBe('alex');
  expect(resizeMatches(resized, outing.config.rounds)).toHaveLength(16);
});

test('early finish is 5 & 4; only finalized matches award team points', () => {
  const outing = preparedOuting();
  let match = outing.matches[0];
  for (let hole = 0; hole < 5; hole += 1) {
    match = updateHoleStrokes(match, hole, 'black', 4);
    match = updateHoleStrokes(match, hole, 'white', 5);
  }
  const progress = getMatchProgress(match);
  expect(progress.decided).toBe(true);
  expect(progress.label).toBe('5 & 4');
  expect(progress.winner).toBe('black');
  outing.matches[0] = match;
  expect(getStandings(outing).points.black).toBe(0);
  match = finalizeMatch(match);
  outing.matches[0] = match;
  expect(getStandings(outing).points.black).toBe(1);
  expect(getStandings(outing).finalizedMatches).toBe(1);
  expect(() => updateHoleStrokes(match, 0, 'black', 3)).toThrow(/finalized/);
  match = reopenMatch(match);
  expect(getMatchProgress(match).finalized).toBe(false);
  outing.matches[0] = match;
  expect(getStandings(outing).points.black).toBe(0);
});

test('match is halved after 9 tied holes and supports fractional match points', () => {
  const outing = preparedOuting();
  outing.config.rounds[0].pointsPerMatch = 0.5;
  let match = outing.matches[0];
  for (let hole = 0; hole < 9; hole += 1) {
    match = updateHoleStrokes(match, hole, 'black', 4);
    match = updateHoleStrokes(match, hole, 'white', 4);
  }
  expect(getMatchProgress(match).decided).toBe(true);
  expect(getMatchProgress(match).winner).toBeNull();
  outing.matches[0] = finalizeMatch(match);
  expect(getStandings(outing).points.black).toBe(0.25);
  expect(getStandings(outing).points.white).toBe(0.25);
});

test('skipped holes do not trigger an early win, and scores cannot go beyond clinch', () => {
  const outing = preparedOuting();
  let match = outing.matches[0];
  for (let hole = 4; hole < 9; hole += 1) {
    match = updateHoleStrokes(match, hole, 'black', 3);
    match = updateHoleStrokes(match, hole, 'white', 5);
  }
  expect(getMatchProgress(match).through).toBe(0);
  expect(getMatchProgress(match).decided).toBe(false);
  for (let hole = 0; hole < 5; hole += 1) {
    match = updateHoleStrokes(match, hole, 'black', 3);
    match = updateHoleStrokes(match, hole, 'white', 5);
  }
  expect(getMatchProgress(match).label).toBe('5 & 4');
  expect(() => updateHoleStrokes(match, 5, 'black', 5)).toThrow(/already decided/);
  expect(() => assignPlayer([match], outing.players, 'singles', match.id, 'black', 0, '')).toThrow(/has scores/);
});

test('Phase 2 saved roster migrates to Phase 3 without losing golfers', () => {
  const outing = preparedOuting();
  outing.version = 2;
  outing.matches.forEach((match) => { delete match.holes; delete match.finalized; });
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(outing));
  render(<App />);
  const migrated = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  expect(migrated.version).toBe(3);
  expect(migrated.players).toHaveLength(2);
  expect(migrated.matches[0].black[0]).toBe('alex');
  expect(migrated.matches[0].holes).toHaveLength(9);
});

test('import validation strips mismatched players and impossible scores', () => {
  expect(() => normalizeOuting({ version: 1 })).toThrow(/supported/);
  const outing = preparedOuting();
  outing.matches[0].holes[0] = { black: 24, white: -5 };
  outing.matches[0].finalized = true;
  const cleaned = normalizeOuting(outing);
  expect(cleaned.matches[0].holes[0]).toEqual({ black: null, white: null });
  expect(cleaned.matches[0].finalized).toBe(false);
  outing.matches[0].white = ['alex'];
  expect(normalizeOuting(outing).matches[0].white).toEqual(['']);
  expect(normalizeOuting(outing).matches[0].holes[0]).toEqual({ black: null, white: null });
});


test('phone-oriented scorecard enters strokes and finalizes a match', () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedOuting()));
  const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true);
  try {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /^scores$/i })[0]);
    const scoreButtons = screen.getAllByRole('button', { name: /enter scores/i });
    fireEvent.click(scoreButtons.find((button) => !button.disabled));
    for (let hole = 1; hole <= 5; hole += 1) {
      fireEvent.change(screen.getByRole('spinbutton', { name: `Hole ${hole} Team Black strokes` }), { target: { value: '4' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: `Hole ${hole} Team White strokes` }), { target: { value: '5' } });
    }
    expect(screen.getByText('5 & 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /finalize match & award points/i }));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).matches[0].finalized).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: /^standings$/i })[0]);
    expect(screen.getByText(/1 \u2013 0/)).toBeInTheDocument();
  } finally { confirm.mockRestore(); }
});


test('projections include current leaders without awarding official points', () => {
  const outing = preparedOuting();
  let match = outing.matches[0];
  // A half-entered hole should never count toward projections.
  match = updateHoleStrokes(match, 0, 'black', 4);
  outing.matches[0] = match;
  expect(getStandings(outing).projected.points).toEqual({ black: 0, white: 0 });
  match = updateHoleStrokes(match, 0, 'white', 5);
  outing.matches[0] = match;
  let standing = getStandings(outing);
  expect(standing.points).toEqual({ black: 0, white: 0 });
  expect(standing.projected.points).toEqual({ black: 1, white: 0 });
  expect(standing.projected.includedMatches).toBe(1);
  expect(standing.byRound.singles.projectedBlack).toBe(1);
  // Tie it up on Hole 2 and the live projection becomes half a point each.
  match = updateHoleStrokes(match, 1, 'black', 5);
  match = updateHoleStrokes(match, 1, 'white', 4);
  outing.matches[0] = match;
  standing = getStandings(outing);
  expect(standing.projected.points).toEqual({ black: 0.5, white: 0.5 });
  expect(standing.points).toEqual({ black: 0, white: 0 });
  // Adjusting the lead must recompute the projection from scratch.
  match = updateHoleStrokes(match, 0, 'black', 6);
  outing.matches[0] = match;
  expect(getStandings(outing).projected.points).toEqual({ black: 0, white: 1 });
});

test('finalized matches contribute to both official and projected standings', () => {
  const outing = preparedOuting();
  let match = outing.matches[0];
  for (let i = 0; i < 5; i += 1) {
    match = updateHoleStrokes(match, i, 'black', 4);
    match = updateHoleStrokes(match, i, 'white', 5);
  }
  outing.matches[0] = match;
  expect(getStandings(outing).projected.points.black).toBe(1);
  expect(getStandings(outing).points.black).toBe(0);
  outing.matches[0] = finalizeMatch(match);
  expect(getStandings(outing).points.black).toBe(1);
  expect(getStandings(outing).projected.points.black).toBe(1);
  expect(getStandings(outing).projected.uncountedMatches).toBe(15);
});
