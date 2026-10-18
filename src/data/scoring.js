/** Pure, browser-independent match-play calculations. No network calls. */
export const HOLES_PER_ROUND = 9;
export const MAX_STROKES = 20;

export function blankHoles() {
  return Array.from({ length: HOLES_PER_ROUND }, () => ({ black: null, white: null }));
}

export function hasEnteredScores(match) {
  return Array.isArray(match.holes) && match.holes.some((hole) => hole && (hole.black != null || hole.white != null));
}

const validStroke = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_STROKES;

export function normalizeHoles(holes) {
  return blankHoles().map((empty, index) => {
    const entry = Array.isArray(holes) ? holes[index] : null;
    return {
      black: validStroke(entry?.black) ? entry.black : null,
      white: validStroke(entry?.white) ? entry.white : null,
    };
  });
}

/** Scores are counted in hole order, to avoid clinching based on skipped holes. */
export function getMatchProgress(match) {
  const holes = normalizeHoles(match.holes);
  let blackWins = 0;
  let whiteWins = 0;
  let through = 0;
  let decided = false;
  let winner = null;
  let remaining = HOLES_PER_ROUND;
  let margin = 0;
  let finishedAt = 0;

  for (let i = 0; i < HOLES_PER_ROUND; i += 1) {
    const hole = holes[i];
    if (hole.black === null || hole.white === null) break;
    through = i + 1;
    if (hole.black < hole.white) blackWins += 1;
    if (hole.white < hole.black) whiteWins += 1;
    remaining = HOLES_PER_ROUND - through;
    margin = Math.abs(blackWins - whiteWins);
    if (margin > remaining || through === HOLES_PER_ROUND) {
      decided = true;
      winner = blackWins > whiteWins ? 'black' : whiteWins > blackWins ? 'white' : null;
      finishedAt = through;
      break;
    }
  }

  const leading = blackWins === whiteWins ? null : blackWins > whiteWins ? 'black' : 'white';
  let label;
  if (decided && !winner) label = 'All square · Halved';
  else if (decided && remaining > 0) label = `${margin} & ${remaining}`;
  else if (decided) label = `${margin} UP`;
  else if (through === 0) label = hasEnteredScores(match) ? 'Awaiting Hole 1' : 'Not started';
  else if (!leading) label = `All square · Thru ${through}`;
  else label = `${margin} UP · Thru ${through}`;

  return { blackWins, whiteWins, through, remaining, margin, leading, decided, winner, finishedAt, label,
    started: hasEnteredScores(match), finalized: Boolean(match.finalized) && decided };
}

export function updateHoleStrokes(match, holeIndex, side, value) {
  if (match.finalized) throw new Error('This match is finalized. Reopen it before editing scores.');
  if (side !== 'black' && side !== 'white') throw new Error('Unknown team.');
  if (!Number.isInteger(holeIndex) || holeIndex < 0 || holeIndex >= HOLES_PER_ROUND) throw new Error('Invalid hole.');
  if (value !== null && !validStroke(value)) throw new Error(`Enter between 1 and ${MAX_STROKES} strokes.`);
  const progress = getMatchProgress(match);
  if (progress.decided && holeIndex >= progress.finishedAt) throw new Error('This match is already decided. Edit an earlier hole to change the result.');
  const holes = normalizeHoles(match.holes);
  holes[holeIndex] = { ...holes[holeIndex], [side]: value };
  const updated = { ...match, holes };
  const updatedProgress = getMatchProgress(updated);
  // If holes were entered out of order and this edit clinches the match,
  // remove later scores. They are not part of the result or legal to submit.
  if (updatedProgress.decided && updatedProgress.finishedAt < HOLES_PER_ROUND) {
    for (let i = updatedProgress.finishedAt; i < HOLES_PER_ROUND; i += 1) {
      holes[i] = { black: null, white: null };
    }
  }
  return updated;
}

export function finalizeMatch(match) {
  if (match.finalized) throw new Error('This match is already finalized.');
  if ([...match.black, ...match.white].some((id) => !id)) throw new Error('Assign every golfer before finalizing.');
  if (!getMatchProgress(match).decided) throw new Error('The match is not decided yet. Enter both sides’ strokes for each played hole.');
  return { ...match, finalized: true };
}

export function reopenMatch(match) {
  return { ...match, finalized: false };
}

export function getStandings(outing) {
  const points = { black: 0, white: 0 };
  const byRound = {};
  let finalizedMatches = 0;
  let decidedMatches = 0;
  let startedMatches = 0;

  for (const round of outing.config.rounds) {
    const result = { black: 0, white: 0, finalized: 0, decided: 0, started: 0, available: round.matchCount * round.pointsPerMatch };
    outing.matches.filter((match) => match.roundId === round.id).forEach((match) => {
      const progress = getMatchProgress(match);
      if (progress.started) { startedMatches += 1; result.started += 1; }
      if (progress.decided) { decidedMatches += 1; result.decided += 1; }
      if (!progress.finalized) return;
      finalizedMatches += 1;
      result.finalized += 1;
      const amount = round.pointsPerMatch;
      const blackPoints = progress.winner === 'black' ? amount : progress.winner === null ? amount / 2 : 0;
      const whitePoints = amount - blackPoints;
      points.black += blackPoints;
      points.white += whitePoints;
      result.black += blackPoints;
      result.white += whitePoints;
    });
    byRound[round.id] = result;
  }
  const totalAvailable = outing.config.rounds.reduce((sum, round) => sum + round.matchCount * round.pointsPerMatch, 0);
  const winner = points.black > totalAvailable / 2 ? 'black' : points.white > totalAvailable / 2 ? 'white' : null;
  const awarded = points.black + points.white;
  const isComplete = finalizedMatches === outing.matches.length;
  return { points, byRound, finalizedMatches, decidedMatches, startedMatches, totalMatches: outing.matches.length,
    totalAvailable, awarded, remaining: Math.max(0, totalAvailable - awarded), winner, isComplete, isTie: isComplete && !winner };
}
