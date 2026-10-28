import { useState } from 'react';
import { formatPoints, getRoundPoints } from '../data/outingConfig';
import { getMatchStatus } from '../data/outingState';
import { blankHoles, getMatchProgress, normalizeHoles, updateHoleStrokes, finalizeMatch, reopenMatch, MAX_STROKES } from '../data/scoring';
import './ScoringPage.css';

const SIDES = ['black', 'white'];
const nameFor = (outing, id) => outing.players.find((player) => player.id === id)?.name || 'Unassigned';
const teamFor = (outing, side) => outing.config.teams.find((team) => team.id === side)?.name || side;

function MatchBadge({ match, progress }) {
  const ready = getMatchStatus(match).complete;
  const style = progress.finalized ? 'official' : progress.decided ? 'decided' : progress.started ? 'playing' : ready ? 'ready' : 'setup';
  const text = progress.finalized ? 'Final' : progress.decided ? 'Ready to finalize' : progress.started ? 'In progress' : ready ? 'Ready to score' : 'Needs lineup';
  return <span className={`scoring-badge scoring-badge--${style}`}>{text}</span>;
}

function MatchListCard({ outing, match, round, onOpen, canEdit }) {
  const progress = getMatchProgress(match);
  const ready = getMatchStatus(match).complete;
  const participants = (side) => match[side].map((id) => nameFor(outing, id)).join(' & ');
  return <article className="scoring-match-tile">
    <div className="scoring-match-tile__header"><strong>MATCH {String(match.number).padStart(2, '0')}</strong><MatchBadge match={match} progress={progress} /></div>
    <div className="scoring-match-tile__sides">
      {SIDES.map((side) => <div className="scoring-side" key={side}><span className={`scoring-side__dot scoring-side__dot--${side}`} />
        <div><span>{teamFor(outing, side)}</span><strong>{participants(side)}</strong></div>
      </div>)}
    </div>
    <div className="scoring-match-tile__bottom">
      <div><strong>{progress.label}</strong><span className={progress.leading ? `scoring-match-leader scoring-match-leader--${progress.leading}` : ''}>{progress.decided ? (progress.winner ? `${teamFor(outing, progress.winner)} wins` : 'Match halved') : progress.through > 0 ? (progress.leading ? `${teamFor(outing, progress.leading)} is leading` : 'All square — neither team leads') : progress.started ? 'Awaiting a completed hole' : `${formatPoints(round.pointsPerMatch)} points at stake`}</span></div>
      <button type="button" className="scoring-open" onClick={() => onOpen(match.id)} disabled={!ready}>{!canEdit ? 'View scores' : progress.finalized ? 'View result' : progress.started ? 'Continue' : 'Enter scores'} <span aria-hidden="true">→</span></button>
    </div>
    {!ready && <p className="scoring-match-tile__hint">Complete this matchup in Organizer before entering strokes.</p>}
  </article>;
}

export default function ScoringPage({ outing, onMatchUpdate, selectedRound, setSelectedRound, session, cloudEnabled, onRequestLogin }) {
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const round = outing.config.rounds[selectedRound] || outing.config.rounds[0];
  const matches = outing.matches.filter((match) => match.roundId === round.id);
  const match = matches.find((item) => item.id === selectedMatchId);
  const progress = match ? getMatchProgress(match) : null;
  const ready = match ? getMatchStatus(match).complete : false;
  const canEdit = !cloudEnabled || (Boolean(session) && (session.role === 'organizer' || (match && [...match.black,...match.white].includes(session.player_id))));
  const canEditMatch = (item) => !cloudEnabled || (Boolean(session) && (session.role === 'organizer' || [...item.black,...item.white].includes(session.player_id)));

  function changeRound(index) {
    setSelectedRound(index);
    setSelectedMatchId(null);
    setError('');
    setNotice('');
  }

  function openMatch(id) {
    setSelectedMatchId(id);
    setError('');
    setNotice('');
    document.documentElement.scrollTop = 0;
  }

  function changeStroke(index, side, rawValue) {
    if (!match) return;
    const value = rawValue === '' ? null : Number(rawValue);
    try {
      if (rawValue !== '' && (!/^\d+$/.test(rawValue) || !Number.isInteger(value) || value < 1 || value > MAX_STROKES)) throw new Error(`Use 1–${MAX_STROKES} strokes, or clear the field.`);
      if (!canEdit) throw new Error('Sign in as a participating golfer or organizer to edit this match.');
      const save = onMatchUpdate(match.id, (current) => updateHoleStrokes(current, index, side, value));
      save.catch((caught) => setError(caught.message));
      setError('');
      setNotice('');
    } catch (caught) { setError(caught.message); }
  }

  function finishMatch() {
    if (!match || !progress.decided || progress.finalized) return;
    const who = progress.winner ? teamFor(outing, progress.winner) : 'Both teams (halved match)';
    if (!window.confirm(`Finalize Match ${match.number}? ${who} will receive ${formatPoints(progress.winner ? round.pointsPerMatch : round.pointsPerMatch / 2)} point(s)${progress.winner ? '' : ' each'}. This awards official team points. You can reopen the match to correct errors.`)) return;
    try {
      if (!canEdit) throw new Error('Sign in to finalize this match.');
      onMatchUpdate(match.id, finalizeMatch).then(() => {
        setError(''); setNotice('Match finalized. Team points have been updated!');
      }).catch((caught) => setError(caught.message));
    } catch (caught) { setError(caught.message); }
  }

  function reopen() {
    if (!match?.finalized || !window.confirm('Reopen this match? Its awarded team points will be removed until it is finalized again.')) return;
    if (!canEdit) return setError('You do not have permission to reopen this match.');
    onMatchUpdate(match.id, reopenMatch).then(() => {
      setNotice('Match reopened. Adjust the strokes and finalize again when ready.'); setError('');
    }).catch((caught) => setError(caught.message));
  }

  function clearScores() {
    if (!match || match.finalized || !window.confirm('Clear ALL strokes from this match? This cannot be undone without a backup.')) return;
    if (!canEdit) return setError('You do not have permission to clear this match.');
    onMatchUpdate(match.id, (current) => ({ ...current, holes: blankHoles() })).then(() => {
      setNotice('All strokes for this match have been cleared.'); setError('');
    }).catch((caught) => setError(caught.message));
  }

  if (match) {
    const holes = normalizeHoles(match.holes);
    const leadSide = progress.winner || progress.leading;
    return <div className="page inner-page scoring-page scoring-page--detail">
      <button type="button" className="scoring-back" onClick={() => openMatch(null)}>← All {round.shortName} matches</button>
      <div className="page-intro scoring-detail-intro"><p className="eyebrow">ROUND {round.number} · MATCH {String(match.number).padStart(2, '0')}</p><h1>Scorecard<span className="title-period">.</span></h1><p>Holes {round.holeStart}–{round.holeEnd} · {round.name}. Enter strokes for both sides on each hole. Every edit {cloudEnabled ? 'syncs to the shared leaderboard' : 'saves on this device'}.</p></div>
      <div className="scoring-local-banner"><span aria-hidden="true">◉</span> {cloudEnabled ? 'Scores sync to every phone automatically.' : 'Local preview only — configure Supabase for shared scoring.'}</div>
      {cloudEnabled && !canEdit && <div className="scoring-permission"><strong>View-only scorecard</strong><p>{session ? 'Only golfers assigned to this match (or the organizer) can enter scores.' : 'Sign in to enter strokes for your matches.'}</p>{!session && <button type="button" className="button button--forest" onClick={onRequestLogin}>Golfer sign in</button>}</div>}
      <section className="scoring-live-card" aria-label="Current match standings">
        <div className="scoring-live-card__top"><span>MATCH STANDING</span><MatchBadge match={match} progress={progress} /></div>
        <div className="scoring-live-card__lead"><strong>{progress.label}</strong><span>{leadSide ? `${teamFor(outing, leadSide)} ${progress.decided ? 'wins' : 'is leading'}` : progress.decided ? 'Match halved' : 'All square — neither team is leading'}</span></div>
        <div className="scoring-live-card__foot"><span>{progress.blackWins} holes won · {teamFor(outing, 'black')}</span><span>{progress.whiteWins} holes won · {teamFor(outing, 'white')}</span></div>
      </section>
      <div className="scoring-player-key">
        {SIDES.map((side) => <div className="scoring-player-key__side" key={side}><span className={`scoring-side__dot scoring-side__dot--${side}`} /><span><strong>{teamFor(outing, side)}</strong><small>{match[side].map((id) => nameFor(outing, id)).join(' & ')}</small></span></div>)}
      </div>
      {error && <div role="alert" className="scoring-feedback scoring-feedback--error">{error}</div>}
      {notice && <div role="status" className="scoring-feedback scoring-feedback--success">{notice}</div>}
      <div className="scoring-holes-heading"><h2>Hole-by-hole</h2><span>Strokes</span></div>
      <div className="scoring-hole-list" aria-label="Hole stroke entry">
        {holes.map((hole, index) => {
          const holeNumber = round.holeStart + index;
          const both = hole.black !== null && hole.white !== null;
          const holeWinner = both ? hole.black < hole.white ? 'black' : hole.white < hole.black ? 'white' : null : undefined;
          const pastFinish = progress.decided && index >= progress.finishedAt;
          const disabled = !ready || !canEdit || progress.finalized || pastFinish;
          return <div className={`scoring-hole ${index < progress.through ? 'scoring-hole--counted' : ''} ${pastFinish ? 'scoring-hole--unneeded' : ''}`} key={holeNumber}>
            <div className="scoring-hole__number"><span>HOLE</span><strong>{holeNumber}</strong></div>
            {SIDES.map((side) => <label className="scoring-hole__entry" key={side}>
              <span className="scoring-hole__side">{side === 'black' ? 'BLACK' : 'WHITE'}</span>
              <input aria-label={`Hole ${holeNumber} ${teamFor(outing, side)} strokes`} type="number" min="1" max={MAX_STROKES} step="1" inputMode="numeric" value={pastFinish ? '' : hole[side] ?? ''} placeholder="–" disabled={disabled} onChange={(event) => changeStroke(index, side, event.target.value)} />
            </label>)}
            <div className="scoring-hole__result">{pastFinish ? 'Not needed' : !both ? hole.black !== null || hole.white !== null ? 'Incomplete' : '—' : holeWinner ? <span className={`scoring-hole__win scoring-hole__win--${holeWinner}`}>{teamFor(outing, holeWinner)} won</span> : 'Halved'}</div>
          </div>;
        })}
      </div>
      <div className="scoring-explainer">{progress.decided ? `Match decided after ${progress.finishedAt} hole${progress.finishedAt === 1 ? '' : 's'}. Remaining holes are not required.` : `Enter both sides’ strokes in hole order. ${9 - progress.through} hole${9 - progress.through === 1 ? '' : 's'} remaining; matches end early when a team cannot be caught.`}</div>
      <section className="scoring-finish-panel">
        <div><strong>{progress.finalized ? 'Official result' : progress.decided ? 'Ready to make it official' : 'Match not decided yet'}</strong><p>{progress.finalized ? `${formatPoints(round.pointsPerMatch)} team points awarded${progress.winner ? ` to ${teamFor(outing, progress.winner)}` : ' (split equally)'}.` : progress.decided ? `Confirm the result to award ${formatPoints(round.pointsPerMatch)} total team points.` : 'Finish entering each played hole before awarding points.'}</p></div>
        {progress.finalized ? <button type="button" className="button button--outline scoring-finish-panel__main" onClick={reopen} disabled={!canEdit}>Reopen match to edit</button> : <button type="button" className="button button--forest scoring-finish-panel__main" onClick={finishMatch} disabled={!canEdit || !ready || !progress.decided}>Finalize match & award points</button>}
        {!progress.finalized && progress.started && canEdit && <button type="button" className="scoring-clear" onClick={clearScores}>Clear all strokes from this match</button>}
      </section>
    </div>;
  }

  return <div className="page inner-page scoring-page">
    <div className="page-intro"><p className="eyebrow">THE SCORECARD</p><h1>Match center<span className="title-period">.</span></h1><p>Choose a match, enter strokes hole by hole, then finalize to award team points.</p></div>
    <div className="scoring-local-banner"><span aria-hidden="true">◉</span> {cloudEnabled ? 'Shared scoring is active. You can browse all matches; only your assigned matches can be edited.' : 'Scores save only in this browser until Supabase is configured.'}</div>
    <div className="round-tabs" role="tablist" aria-label="Choose a round">
      {outing.config.rounds.map((r, i) => <button key={r.id} type="button" role="tab" aria-selected={selectedRound === i} className={`round-tab ${selectedRound === i ? 'round-tab--active' : ''}`} onClick={() => changeRound(i)}><small>ROUND {r.number}</small><strong>{r.shortName}</strong></button>)}
    </div>
    <div className="match-summary"><div className="match-summary__number" aria-hidden="true">⛳</div><div className="match-summary__body"><p>ROUND {round.number} · HOLES {round.holeStart}–{round.holeEnd}</p><h2>{round.name}</h2><span>{round.summary}</span></div><div className="match-summary__points"><strong>{formatPoints(getRoundPoints(round))}</strong><span>POINTS</span></div></div>
    <div className="matches-title"><h3>Matches <span>({matches.length})</span></h3><span>{formatPoints(round.pointsPerMatch)} pts per match</span></div>
    <div className="scoring-match-grid">{matches.map((item) => <MatchListCard key={item.id} outing={outing} round={round} match={item} onOpen={openMatch} canEdit={canEditMatch(item)} />)}</div>
    {matches.every((item) => !getMatchStatus(item).complete) && <div className="scoring-explainer">Go to <strong>Organize → Matchups</strong> to assign golfers. When a match has its full lineup, its scorecard will unlock.</div>}
  </div>;
}
