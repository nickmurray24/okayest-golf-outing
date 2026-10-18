import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import OrganizerPage from './components/OrganizerPage';
import ScoringPage from './components/ScoringPage';
import SignInPage from './components/SignInPage';
import { cloud, cloudEnabled, getStoredSession, storeSession, subscribeToChanges } from './data/cloud';
import { getStandings, getMatchProgress } from './data/scoring';
import { readOuting, saveOuting, createInitialOuting, normalizeOuting, getRosterCounts } from './data/outingState';
import {
  getRoundPoints,
  getTotalPoints,
  getOutingPointsToWin,
  formatPoints,
} from './data/outingConfig';

const ASSETS = `${process.env.PUBLIC_URL || ''}/assets`;

const ICONS = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h14V9" /><path d="M9 21v-7h6v7" /></>,
  flag: <><path d="M5 22V4" /><path d="M5 5c4-3 7 3 14 0v10c-7 3-10-3-14 0" /></>,
  trophy: <><path d="M8 21h8M12 17v4M7 3h10v7a5 5 0 0 1-10 0V3Z" /><path d="M7 5H4v4a4 4 0 0 0 4 4M17 5h3v4a4 4 0 0 1-4 4h-1" /></>,
  users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M9 7h7M9 11h7" /></>,
  arrowRight: <><path d="M4 12h16m-7-7 7 7-7 7" /></>,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
  medal: <><circle cx="12" cy="16" r="5" /><path d="m8.5 11-3-8H10l2 7m3.5 1 3-8H14l-2 7" /></>,
  pencil: <><path d="m15 5 4 4M4 20l5-.9L20 8a2.1 2.1 0 0 0-4-4L5 15z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  sparkle: <><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3ZM19 18l.5 1.5L21 20l-1.5.5L19 22l-.5-1.5L17 20l1.5-.5L19 18Z" /></>,
};

function Icon({ name, size = 20, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'scoring', label: 'Scores', icon: 'flag' },
  { id: 'standings', label: 'Standings', icon: 'trophy' },
  { id: 'teams', label: 'Teams', icon: 'users' },
  { id: 'rules', label: 'Rules', icon: 'book' },
];

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <div className="brand__seal" aria-hidden="true">
        <img src={`${ASSETS}/okayest-mascot.webp`} alt="" />
      </div>
      <div className="brand__text">
        <span>THE OKAYEST</span>
        <strong>GOLF OUTING <em>Ever.</em></strong>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatusTag({ children = 'Not started' }) {
  return <span className="status-tag"><span className="status-dot" />{children}</span>;
}

function Scoreboard({ outing, compact = false }) {
  const standings = getStandings(outing);
  const TOTAL_POINTS = getTotalPoints(outing.config);
  const POINTS_TO_WIN = getOutingPointsToWin(outing.config);
  const resultText = standings.winner ? `${outing.config.teams.find((t) => t.id === standings.winner)?.name} wins!` :
    standings.isTie ? 'Outing ends in a tie' : standings.startedMatches > 0 ? 'Matches underway' : 'Not started';
  return (
    <section className={`scoreboard ${compact ? 'scoreboard--compact' : ''}`} aria-label="Team scoreboard">
      <div className="scoreboard__top"><span className="scoreboard__caption">THE MAIN EVENT</span><StatusTag>{resultText}</StatusTag></div>
      <div className="scoreboard__teams">
        {outing.config.teams.map((team) => <div className="score-team" key={team.id}>
          <span className={`team-mark team-mark--${team.id}`}><span /></span>
          <span className="score-team__name">{team.name}</span>
          <span className="score-team__points">{formatPoints(standings.points[team.id])}</span>
        </div>).reduce((elements, element, index) => index === 0 ? [element] : [...elements, <div className="scoreboard__versus" key="vs" aria-hidden="true"><span>VS</span></div>, element], [])}
      </div>
      <div className="scoreboard__progress">
        <div className="scoreboard__progress-copy"><span>Race to {formatPoints(POINTS_TO_WIN)}</span><span><strong>{formatPoints(standings.awarded)}</strong> of {formatPoints(TOTAL_POINTS)} pts awarded</span></div>
        <div className="progress-track" role="progressbar" aria-label="Points awarded" aria-valuenow={standings.awarded} aria-valuemin={0} aria-valuemax={TOTAL_POINTS}>
          <div className="progress-track__fill" style={{ width: `${Math.min(100, standings.awarded / TOTAL_POINTS * 100)}%` }} />
        </div>
        <p className="scoreboard__helper">{standings.finalizedMatches} of {standings.totalMatches} matches finalized · {formatPoints(standings.remaining)} points remain.</p>
      </div>
    </section>
  );
}

function RoundCard({ round, onClick }) {
  return (
    <button type="button" className="round-card" onClick={onClick}>
      <span className="round-card__number">0{round.number}</span>
      <span className="round-card__content">
        <span className="round-card__sub">ROUND {round.number} <span className="dot-separator">·</span> HOLES {round.holeStart}–{round.holeEnd}</span>
        <span className="round-card__title">{round.name}</span>
        <span className="round-card__desc">{round.format}</span>
      </span>
      <span className="round-card__right">
        <span className="round-card__points">{formatPoints(getRoundPoints(round))} PTS</span>
        <Icon name="chevronRight" size={19} />
      </span>
    </button>
  );
}

function HomePage({ outing, navigate, selectRound, cloudEnabled }) {
  const TOTAL_POINTS = getTotalPoints(outing.config);
  const POINTS_TO_WIN = getOutingPointsToWin(outing.config);
  return (
    <div className="page page--home">
      <section className="hero">
        <div className="hero__copy">
          <span className="hero__overline"><span className="hero__line" /> EST. 2026-ISH <span className="hero__line" /></span>
          <p className="hero__kicker">SAME GUYS. NEW EXCUSES.</p>
          <h1>THE <span>OKAYEST</span><br />GOLF OUTING <em>Ever.</em></h1>
          <p className="hero__description">Three rounds. Two teams. One highly questionable claim to golf greatness.</p>
          <div className="hero__actions">
            <button type="button" className="button button--cream" onClick={() => navigate('standings')}>View standings <Icon name="arrowRight" size={18} /></button>
            <button type="button" className="button button--text-light" onClick={() => navigate('rules')}>The rules <Icon name="chevronRight" size={17} /></button>
          </div>
        </div>
        <div className="hero__art" aria-hidden="true"><div className="hero__art-disc"><img src={`${ASSETS}/okayest-mascot.webp`} alt="" /></div><span className="hero__orbit hero__orbit--one" /><span className="hero__orbit hero__orbit--two" /></div>
        <span className="hero__corner" aria-hidden="true">⛳</span>
      </section>

      <div className="home-layout">
        <div className="home-layout__primary">
          <section className="section-block">
            <SectionHeading eyebrow="THE CLUBHOUSE" title="The scoreboard" subtitle="The only number that matters is the one at the top." />
            <Scoreboard outing={outing} />
          </section>

          <section className="section-block">
            <SectionHeading eyebrow="THE FORMAT" title="Three rounds. One winner." subtitle={`${formatPoints(TOTAL_POINTS)} total points up for grabs across all matches.`} />
            <div className="round-list">
              {outing.config.rounds.map((round, index) => <RoundCard key={round.id} round={round} onClick={() => selectRound(index)} />)}
            </div>
          </section>
        </div>

        <aside className="home-layout__side">
          <section className="quick-facts">
            <p className="eyebrow">AT A GLANCE</p>
            <h2>It's anyone's game.</h2>
            <div className="quick-facts__grid">
              <div><strong>{formatPoints(TOTAL_POINTS)}</strong><span>Available points</span></div>
              <div><strong>{formatPoints(POINTS_TO_WIN)}</strong><span>Points to win</span></div>
              <div><strong>{outing.config.rounds.length}</strong><span>Rounds</span></div>
              <div><strong>{outing.players.length}</strong><span>Golfers registered</span></div>
            </div>
            <p className="quick-facts__foot">{outing.players.length === 0 ? `${outing.config.estimatedGolfers} golfers expected · roster not entered yet.` : `${outing.players.length} golfers currently on the roster.`} <button type="button" className="organizer-inline-link" onClick={() => navigate('organizer')}>Manage outing →</button></p>
          </section>
          <section className="notice-card">
            <span className="notice-card__icon"><Icon name="info" size={21} /></span>
            <div><strong>{cloudEnabled ? "Shared live outing" : "Local scoring preview"}</strong><p>{cloudEnabled ? "Scores and standings synchronize across phones. Sign in to record your assigned matches." : "Enter strokes and finalize matches in Scores. Data saves only on this device until Supabase is configured."}</p></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StandingsPage({ outing }) {
  const standings = getStandings(outing);
  const finalized = outing.matches.filter((match) => getMatchProgress(match).finalized).slice().reverse();
  return (
    <div className="page inner-page">
      <div className="page-intro"><p className="eyebrow">THE LEADERBOARD</p><h1>Standings<span className="title-period">.</span></h1><p>Official team points update when matches are finalized. Scores are local to this browser until Phase 4.</p></div>
      <Scoreboard outing={outing} compact />
      {standings.winner && <div className="champion-banner"><Icon name="trophy" size={25} /><div><strong>{outing.config.teams.find((t) => t.id === standings.winner)?.name} wins the outing!</strong><span>First team to earn more than half of the available points.</span></div></div>}
      {standings.isTie && <div className="champion-banner"><Icon name="medal" size={25} /><div><strong>The outing ends all square.</strong><span>The teams split the available points. Set a tiebreaker if you need one.</span></div></div>}
      <section className="standings-section">
        <SectionHeading eyebrow="ROUND-BY-ROUND" title="Points breakdown" />
        <div className="breakdown-list">
          {outing.config.rounds.map((round) => {
            const result = standings.byRound[round.id];
            return <div className="breakdown-row" key={round.id}>
              <div className="breakdown-row__title"><span className="breakdown-row__number">{round.number}</span><div><strong>{round.name}</strong><span>{result.finalized}/{round.matchCount} matches final · Holes {round.holeStart}–{round.holeEnd}</span></div></div>
              <div className="breakdown-row__result"><strong>{formatPoints(result.black)} – {formatPoints(result.white)}</strong><span>{formatPoints(result.black + result.white)} / {formatPoints(result.available)} pts awarded</span></div>
            </div>;
          })}
        </div>
      </section>
      <section className="standings-section">
        <SectionHeading eyebrow="THE SCOREBOOK" title="Finalized matches" subtitle={`${standings.finalizedMatches} of ${standings.totalMatches} results official.`} />
        {finalized.length ? <div className="standings-results">{finalized.map((match) => {
          const result = getMatchProgress(match);
          const round = outing.config.rounds.find((r) => r.id === match.roundId);
          return <div className="standings-result" key={match.id}><span>{round.shortName} · Match {match.number}</span><strong>{result.winner ? outing.config.teams.find((t) => t.id === result.winner)?.name : 'Halved'} · {result.label}</strong></div>;
        })}</div> : <div className="empty-state"><span className="empty-state__icon"><Icon name="trophy" size={28} /></span><h3>No official results yet.</h3><p>Enter hole scores in the Scores tab, then finalize a match to award its points.</p></div>}
      </section>
    </div>
  );
}

function TeamsPage({ outing, navigate }) {
  const counts = getRosterCounts(outing.players);
  return (
    <div className="page inner-page">
      <div className="page-intro"><p className="eyebrow">THE ROSTER</p><h1>Meet the teams<span className="title-period">.</span></h1><p>Lineups stay flexible as more golfers join. Set the roster and pairings in the organizer dashboard.</p></div>
      <div className="roster-summary"><span className="roster-summary__icon"><Icon name="users" size={23}/></span><div><span>CURRENT ROSTER</span><strong>{outing.players.length} golfers added · {counts.unassigned} unassigned</strong><p>{outing.players.length ? "Manage names, teams, and matchups below." : `${outing.config.estimatedGolfers} expected golfers · add their names when ready.`}</p></div></div>
      <button type="button" className="organizer-entry" onClick={() => navigate('organizer')}>Open organizer dashboard →</button>
      <div className="team-grid">
        {outing.config.teams.map((team) => {
          const members = outing.players.filter((player) => player.teamId === team.id).sort((a, b) => a.name.localeCompare(b.name));
          return <section className="team-panel" key={team.id}>
            <div className={`team-panel__banner team-panel__banner--${team.id}`}><span className={`team-mark team-mark--${team.id}`}><span /></span><h2>{team.name}</h2><span>{members.length} GOLFERS</span></div>
            {members.length ? <div className="organizer-team-members"><ul>{members.map((player) => <li key={player.id}><span className={`organizer-avatar organizer-avatar--${team.id}`}>{player.name.charAt(0).toUpperCase()}</span>{player.name}</li>)}</ul></div> : <div className="team-panel__empty"><Icon name="users" size={26} /><strong>No golfers assigned yet</strong><p>Use Organizer to add golfers to this team.</p></div>}
          </section>;
        })}
      </div>
      {counts.unassigned > 0 && <div className="unassigned-list"><strong>Unassigned golfers ({counts.unassigned})</strong><p>{outing.players.filter((player) => !player.teamId).map((p) => p.name).join(' · ')}</p></div>}
    </div>
  );
}

const localRules = [
  { title: 'Putt everything out', detail: 'Every putt must be holed unless the other team concedes it.' },
  { title: '“Fluff” within reason', detail: 'No one should have to hit from a divot, but you cannot improve conditions (for example, rough to fairway). One club length is allowed.' },
  { title: 'Scramble ball placement', detail: 'Drop your ball within one club length of the ball you are playing.' },
  { title: 'Breakfast ball', detail: 'With no driving range, each player gets one breakfast ball on the first tee of the first round only.' },
  { title: 'Mulligans', detail: 'Each player receives one mulligan per nine holes.' },
  { title: 'Reverse mulligan', detail: 'Each player may use one reverse mulligan per round to force an opponent to replay their shot. In a 2 vs 2 match, both opponents must replay their shots. The outing rules require a Fireball shot and/or shotgunning a beer to use it.' },
];

function RulesPage({ outing }) {
  const TOTAL_POINTS = getTotalPoints(outing.config);
  const POINTS_TO_WIN = getOutingPointsToWin(outing.config);
  const [showPoster, setShowPoster] = useState(false);
  return (
    <div className="page inner-page rules-page">
      <div className="page-intro"><p className="eyebrow">THE OFFICIAL PLAYBOOK</p><h1>House rules<span className="title-period">.</span></h1><p>A little structure for a lot of very okay golf. Here's everything you need to know before teeing off.</p></div>
      <div className="rules-points"><Icon name="trophy" size={28} /><div><strong>{formatPoints(TOTAL_POINTS)} total points. First to {formatPoints(POINTS_TO_WIN)} wins.</strong><p>Each match is worth the configured points. A tied match after nine holes splits its points evenly between teams.</p></div></div>
      <SectionHeading eyebrow="THE THREE ROUNDS" title="How we play" subtitle="Nine holes per round. All rounds use match play." />
      <div className="rules-rounds">
        {outing.config.rounds.map((round) => (
          <section className="rule-round" key={round.id}>
            <div className="rule-round__top"><span className="rule-round__num">0{round.number}</span><div><p>ROUND {round.number} · {formatPoints(getRoundPoints(round))} POINTS</p><h3>{round.name}</h3></div><span className="rule-round__holes">HOLES {round.holeStart}–{round.holeEnd}</span></div>
            <p className="rule-round__type">{round.format}</p>
            <p>{round.id === 'singles' ? 'One golfer versus one golfer. Win a hole by taking fewer strokes. The golfer who wins more holes wins their match, worth the configured team points regardless of the margin.' : round.id === 'alternate-shot' ? 'Two golfers per team play one ball. Partner 1 tees off on odd-numbered holes, partner 2 on even-numbered holes. After the tee shot, partners alternate strokes until the hole is finished.' : 'Two golfers per team each hit a shot. The team chooses the preferred ball, and both golfers play their next shot from there. Continue until the hole is finished.'}</p>
          </section>
        ))}
      </div>
      <div className="local-rules-heading"><SectionHeading eyebrow="KEEP IT FAIR(ISH)" title="Local rules" subtitle="The little details that keep the arguing to a minimum." /></div>
      <div className="rule-accordion">
        {localRules.map((rule, i) => (
          <details className="rule-detail" key={rule.title} open={i === 0 ? true : undefined}>
            <summary><span className="rule-detail__number">{String(i + 1).padStart(2, '0')}</span><strong>{rule.title}</strong><span className="rule-detail__chevron"><Icon name="chevronDown" size={19} /></span></summary>
            <p>{rule.detail}</p>
          </details>
        ))}
      </div>
      <div className="poster-box"><div><p className="eyebrow">THE ORIGINAL</p><h3>See the official rules poster</h3><p>The artwork that started it all.</p></div><button type="button" className="button button--outline" onClick={() => setShowPoster((value) => !value)} aria-expanded={showPoster}>{showPoster ? 'Hide poster' : 'View poster'} <Icon name="chevronDown" size={18} className={showPoster ? 'icon-rotated' : ''} /></button></div>
      {showPoster && <div className="poster-image"><img src={`${ASSETS}/outing-rules.webp`} alt="Original Okayest Golf Outing Ever rules poster, with scoring, three rounds, and local rules." loading="lazy" /></div>}
      <p className="rules-footer">Same guys. New excuses. <span>⛳</span></p>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState('home');
  const [selectedRound, setSelectedRound] = useState(0);
  const [outing, setOutingLocal] = useState(() => cloudEnabled ? createInitialOuting() : readOuting());
  const [session, setSession] = useState(null);
  const [authRole, setAuthRole] = useState('player');
  const [syncStatus, setSyncStatus] = useState(cloudEnabled ? 'Connecting to Supabase…' : 'Local preview — not shared');
  const [syncError, setSyncError] = useState('');
  const [ready, setReady] = useState(!cloudEnabled);
  const [saveError, setSaveError] = useState(false);
  const outingRef = useRef(outing);
  const revisionRef = useRef(0);
  const versionsRef = useRef({});
  const pendingWrites = useRef(0);
  const writeQueues = useRef({});
  const sessionRef = useRef(null);
  const currentPage = useRef(activePage);
  currentPage.current = activePage;

  const adoptOuting = useCallback((snapshot, revision) => {
    const next = normalizeOuting(snapshot);
    outingRef.current = next;
    setOutingLocal(next);
    revisionRef.current = revision;
    versionsRef.current = Object.fromEntries(next.matches.map((m) => [m.id, m.revision || 0]));
  }, []);

  const refresh = useCallback(async (force = false) => {
    if (!cloudEnabled || pendingWrites.current > 0) return;
    try {
      const response = await cloud.read();
      if (!response?.state) throw new Error('Supabase returned an empty outing. Check the SQL setup.');
      if (pendingWrites.current > 0) return; // In-flight fetch must not overwrite a newly typed hole score.
      if (force || response.revision > revisionRef.current || !ready) adoptOuting(response.state, response.revision);
      setReady(true);
      setSyncError('');
      setSyncStatus('Live scoring connected');
    } catch (error) {
      setSyncError(error.message);
      setSyncStatus('Connection unavailable');
    }
  }, [adoptOuting, ready]);

  useEffect(() => {
    if (!cloudEnabled) return;
    refresh(true);
    const unwatch = subscribeToChanges(() => { refresh(); });
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') refresh();
    }, 6000);
    const focus = () => refresh();
    window.addEventListener('focus', focus);
    return () => { unwatch(); window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [refresh]);

  useEffect(() => {
    if (!cloudEnabled) return;
    const stored = getStoredSession();
    if (!stored) return;
    let cancelled = false;
    cloud.sessionInfo(stored.token).then((info) => {
      if (cancelled) return;
      if (info?.error || !info?.role) { storeSession(null); return; }
      const valid = { ...info, token: stored.token };
      sessionRef.current = valid;
      setSession(valid);
    }).catch(() => { /* Retry signing in if the previous session is unavailable. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (cloudEnabled) return;
    try { saveOuting(outing); setSaveError(false); }
    catch (_) { setSaveError(true); }
  }, [outing]);

  const setOuting = (update) => { // Used only by the no-Supabase local preview.
    setOutingLocal((previous) => {
      const next = typeof update === 'function' ? update(previous) : update;
      outingRef.current = next;
      return next;
    });
  };

  async function saveOrganizer(update) {
    if (!cloudEnabled) { setOuting(update); return; }
    if (sessionRef.current?.role !== 'organizer') throw new Error('Organizer sign-in required.');
    if (pendingWrites.current) throw new Error('Another change is still saving. Try again in a moment.');
    const current = outingRef.current;
    const next = typeof update === 'function' ? update(current) : update;
    pendingWrites.current += 1;
    setSyncStatus('Saving organizer changes…');
    try {
      const saved = await cloud.saveOrganizer(sessionRef.current.token, revisionRef.current, next);
      adoptOuting(saved.state, saved.revision);
      setSyncError('');
      setSyncStatus('Changes saved for everyone');
    } catch (error) {
      setSyncError(error.message);
      setSyncStatus('Save failed');
      throw error;
    } finally {
      pendingWrites.current -= 1;
      if (pendingWrites.current === 0) refresh(true);
    }
  }

  function saveMatch(matchId, updater) {
    if (!cloudEnabled) {
      setOuting((previous) => ({ ...previous,
        matches: previous.matches.map((m) => m.id === matchId ? updater(m) : m),
      }));
      return Promise.resolve();
    }
    const auth = sessionRef.current;
    if (!auth) return Promise.reject(new Error('Sign in to enter scores.'));
    const existing = outingRef.current.matches.find((m) => m.id === matchId);
    if (!existing) return Promise.reject(new Error('Match not found.'));
    if (auth.role !== 'organizer' && ![...existing.black, ...existing.white].includes(auth.player_id))
      return Promise.reject(new Error('You can edit only matches you are playing in.'));
    let updated;
    try { updated = updater(existing); }
    catch (error) { return Promise.reject(error); }
    const next = { ...outingRef.current,
      matches: outingRef.current.matches.map((m) => m.id === matchId ? updated : m),
    };
    outingRef.current = next;
    setOutingLocal(next); // Immediate feedback on slow golf-course cellular data.
    pendingWrites.current += 1;
    setSyncStatus('Saving score…');
    const prior = writeQueues.current[matchId] || Promise.resolve();
    const work = prior.then(async () => {
      const result = await cloud.saveMatch(auth.token, matchId, versionsRef.current[matchId] || 0, updated);
      versionsRef.current[matchId] = result.match_revision;
      revisionRef.current = Math.max(revisionRef.current, result.revision);
      setSyncStatus('All scores saved');
      setSyncError('');
    });
    writeQueues.current[matchId] = work;
    return work.catch(async (error) => {
      setSyncError(error.message);
      setSyncStatus('Score save failed — refreshing');
      throw error;
    }).finally(() => {
      pendingWrites.current -= 1;
      if (pendingWrites.current === 0) refresh(true);
    });
  }

  async function signIn(role, playerId, pin) {
    if (!cloudEnabled) throw new Error('Configure Supabase first.');
    const result = role === 'organizer' ? await cloud.loginOrganizer(pin) : await cloud.loginPlayer(playerId, pin);
    if (result?.error || !result?.token) throw new Error(result?.error || 'Sign-in failed.');
    storeSession(result);
    sessionRef.current = result;
    setSession(result);
    setSyncError('');
    navigate(role === 'organizer' ? 'organizer' : 'scoring');
  }

  async function signOut() {
    const token = sessionRef.current?.token;
    sessionRef.current = null;
    setSession(null);
    storeSession(null);
    navigate('home');
    if (token && cloudEnabled) cloud.logout(token).catch(() => {});
  }

  const navigate = (page) => {
    if (page === 'organizer' && cloudEnabled && sessionRef.current?.role !== 'organizer') {
      setAuthRole('organizer');
      setActivePage('signin');
    } else setActivePage(page);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  const selectRound = (index) => {
    setSelectedRound(index);
    navigate('scoring');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'scoring': return <ScoringPage outing={outing} selectedRound={selectedRound} setSelectedRound={setSelectedRound}
        onMatchUpdate={saveMatch} session={session} cloudEnabled={cloudEnabled} onRequestLogin={() => { setAuthRole('player'); navigate('signin'); }} />;
      case 'standings': return <StandingsPage outing={outing} />;
      case 'teams': return <TeamsPage outing={outing} navigate={navigate} />;
      case 'rules': return <RulesPage outing={outing} />;
      case 'organizer': return <OrganizerPage outing={outing} setOuting={setOuting} onSaveOuting={saveOrganizer}
        cloudEnabled={cloudEnabled} session={session} onSetPlayerPin={(playerId,pin) => cloud.setPlayerPin(sessionRef.current.token,playerId,pin)}
        onReadPinStatuses={() => cloud.pinStatuses(sessionRef.current.token)} />;
      case 'signin': return <SignInPage outing={outing} defaultRole={authRole} key={authRole} onSignIn={signIn} onCancel={() => navigate('home')} />;
      default: return <HomePage outing={outing} navigate={navigate} selectRound={selectRound} cloudEnabled={cloudEnabled} />;
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="desktop-rail" aria-label="Main navigation"><Brand /><p className="desktop-rail__eyebrow">THE CLUBHOUSE</p><nav className="desktop-nav" aria-label="Desktop navigation">{[...NAV_ITEMS, { id: 'organizer', label: 'Organizer', icon: 'pencil' }].map((item) => <button key={item.id} type="button" className={`desktop-nav__item ${activePage === item.id ? 'is-active' : ''}`} onClick={() => navigate(item.id)} aria-current={activePage === item.id ? 'page' : undefined}><Icon name={item.icon} size={19} /><span>{item.label}</span>{activePage === item.id && <Icon name="chevronRight" size={17} />}</button>)}{cloudEnabled && <button type="button" className="desktop-nav__item" onClick={() => session ? signOut() : (setAuthRole('player'), navigate('signin'))}><Icon name="lock" size={19}/><span>{session ? 'Sign out' : 'Golfer sign in'}</span></button>}</nav><div className="desktop-rail__footer"><Icon name="flag" size={18} /><span>2026-ISH · EST. FOR GREATNESS</span></div></aside>
      <div className="app-content"><header className="mobile-header"><Brand compact /><div className="header-tools">{cloudEnabled && <button type="button" className="mobile-signin-button" onClick={() => session ? signOut() : (setAuthRole('player'), navigate('signin'))}>{session ? 'Sign out' : 'Sign in'}</button>}<button type="button" className={`mobile-organizer-button ${activePage === 'organizer' ? 'is-active' : ''}`} onClick={() => navigate(activePage === 'organizer' ? 'teams' : 'organizer')}><Icon name="pencil" size={15} />{activePage === 'organizer' ? 'Teams' : 'Organize'}</button></div></header>{saveError && <div role="alert" className="app-save-warning">Unable to save outing data in this browser. Export a backup before leaving this page.</div>}{cloudEnabled && <div className={`cloud-status ${syncError ? 'cloud-status--error' : ''}`} role="status"><span className="cloud-status__dot" />{!ready ? 'Loading shared outing…' : syncStatus}{session && <span> · {session.role === 'organizer' ? 'Organizer' : outing.players.find(p => p.id === session.player_id)?.name || 'Golfer'}</span>}</div>}{cloudEnabled && syncError && <div role="alert" className="app-save-warning">{syncError} <button type="button" className="organizer-inline-link" onClick={() => refresh(true)}>Retry</button></div>}<main id="main-content" tabIndex={-1}>{cloudEnabled && !ready ? <div className="page inner-page"><h2>{syncError ? 'Unable to connect to the clubhouse' : 'Loading the clubhouse…'}</h2><p>{syncError ? 'Check your Supabase setup and press Retry above. No local scorecard will be used while cloud scoring is configured.' : 'Connecting to Supabase.'}</p></div> : renderPage()}</main><footer className="desktop-footer"><span>THE OKAYEST GOLF OUTING EVER</span><span>Built for the fairway, not the clubhouse.</span></footer></div>
      <nav className="mobile-nav" aria-label="Main navigation">{NAV_ITEMS.map((item) => <button key={item.id} type="button" className={`mobile-nav__item ${activePage === item.id ? 'is-active' : ''}`} onClick={() => navigate(item.id)} aria-current={activePage === item.id ? 'page' : undefined}><Icon name={item.icon} size={21} /><span>{item.label}</span></button>)}</nav>
    </div>
  );
}

export default App;
