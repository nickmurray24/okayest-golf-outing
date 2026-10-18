import { useEffect, useRef, useState } from 'react';
import { createInitialOuting, getMatchStatus, getReadyMatches, getRosterCounts, normalizeOuting, assignPlayer, resizeMatches, SIDE_IDS } from '../data/outingState';
import { formatPoints, getOutingPointsToWin, getTotalPoints } from '../data/outingConfig';
import { hasEnteredScores } from '../data/scoring';
import './OrganizerPage.css';

function Metric({ value, label }) {
  return <div className="organizer-metric"><strong>{value}</strong><span>{label}</span></div>;
}

const teamName = (outing, id) => outing.config.teams.find((team) => team.id === id)?.name || id;
const idForPlayer = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `golfer-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function OrganizerPage({ outing, setOuting, onSaveOuting, cloudEnabled, session, onSetPlayerPin, onReadPinStatuses }) {
  const [tab, setTab] = useState('golfers');
  const [roundId, setRoundId] = useState('singles');
  const [addName, setAddName] = useState('');
  const [addTeam, setAddTeam] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [editTeam, setEditTeam] = useState('');
  const [message, setMessage] = useState(null);
  const [pinStatuses, setPinStatuses] = useState([]);
  const [pinGolferId, setPinGolferId] = useState('');
  const [newGolferPin, setNewGolferPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [draftRounds, setDraftRounds] = useState(null);
  const [draftTeamNames, setDraftTeamNames] = useState(null);
  const fileInputRef = useRef(null);

  const counts = getRosterCounts(outing.players);
  const readyMatches = getReadyMatches(outing.matches);
  const round = outing.config.rounds.find((item) => item.id === roundId) || outing.config.rounds[0];
  const activeMatches = outing.matches.filter((match) => match.roundId === round.id);
  const usedInRound = new Set(activeMatches.flatMap((match) => [...match.black, ...match.white]).filter(Boolean));
  const total = getTotalPoints(outing.config);

  const flash = (text, kind = 'success') => setMessage({ text, kind });
  const save = async (update) => {
    try { if (cloudEnabled) await onSaveOuting(update); else setOuting(update); return true; }
    catch (error) { flash(error.message, 'error'); return false; }
  };

  useEffect(() => {
    if (!cloudEnabled || session?.role !== 'organizer') return;
    let cancelled = false;
    onReadPinStatuses().then((ids) => { if (!cancelled) setPinStatuses(Array.isArray(ids) ? ids : []); })
      .catch((error) => { if (!cancelled) flash(error.message, 'error'); });
    return () => { cancelled = true; };
  }, [cloudEnabled, session?.token, outing.players.length]);

  async function applyPin(event) {
    event.preventDefault();
    if (!/^\d{6,12}$/.test(newGolferPin)) return flash('Use a 6–12 digit golfer PIN.', 'error');
    if (!pinGolferId) return flash('Select a golfer first.', 'error');
    setPinBusy(true);
    try {
      await onSetPlayerPin(pinGolferId, newGolferPin);
      setPinStatuses((previous) => Array.from(new Set([...previous, pinGolferId])));
      setNewGolferPin('');
      flash('Golfer PIN saved. Any earlier sign-in for that golfer was revoked.');
    } catch (error) { flash(error.message, 'error'); }
    finally { setPinBusy(false); }
  }

  async function addGolfer(event) {
    event.preventDefault();
    const name = addName.trim();
    if (!name) return flash('Enter the golfer’s name.', 'error');
    if (name.length > 70) return flash('Names must be 70 characters or less.', 'error');
    if (outing.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) return flash('A golfer with that name is already on the roster.', 'error');
    if (await save((previous) => ({ ...previous, players: [...previous.players, { id: idForPlayer(), name, teamId: addTeam }] }))) {
      setAddName(''); flash(`${name} added. ${cloudEnabled ? 'Set a personal PIN below for this golfer.' : ''}`);
    }
  }

  function beginEdit(player) {
    setEditingId(player.id);
    setEditName(player.name);
    setEditTeam(player.teamId);
    setMessage(null);
  }

  async function changeGolfer(event) {
    event.preventDefault();
    const name = editName.trim();
    const player = outing.players.find((item) => item.id === editingId);
    if (!player) return;
    if (!name || name.length > 70) return flash('Enter a name of 70 characters or less.', 'error');
    if (outing.players.some((p) => p.id !== editingId && p.name.toLowerCase() === name.toLowerCase())) return flash('That name is already in use.', 'error');
    const teamChanged = player.teamId !== editTeam;
    const assigned = outing.matches.some((m) => [...m.black, ...m.white].includes(editingId));
    if (teamChanged && outing.matches.some((m) => [...m.black, ...m.white].includes(editingId) && (hasEnteredScores(m) || m.finalized))) return flash('This golfer has scored matches. Reopen and clear their scores before changing teams.', 'error');
    if (teamChanged && assigned && !window.confirm('Changing teams will remove this golfer from every existing matchup. Continue?')) return;
    const saved = await save((previous) => ({
      ...previous,
      players: previous.players.map((p) => p.id === editingId ? { ...p, name, teamId: editTeam } : p),
      matches: teamChanged ? clearPlayerFromMatches(previous.matches, editingId) : previous.matches,
    }));
    if (saved) { setEditingId(''); flash(`${name} updated.${teamChanged && assigned ? ' Previous match assignments were cleared.' : ''}`); }
  }

  async function deleteGolfer(player) {
    if (outing.matches.some((m) => [...m.black, ...m.white].includes(player.id) && (hasEnteredScores(m) || m.finalized))) return flash('This golfer has scored matches. Clear those scores before removing them.', 'error');
    if (!window.confirm(`Remove ${player.name} from the outing? This will also clear their match assignments.`)) return;
    if (await save((previous) => ({
      ...previous,
      players: previous.players.filter((p) => p.id !== player.id),
      matches: clearPlayerFromMatches(previous.matches, player.id),
    }))) { if (editingId === player.id) setEditingId(''); flash(`${player.name} removed.`); }
  }

  async function updateAssignment(match, side, position, playerId) {
    try {
      const next = assignPlayer(outing.matches, outing.players, round.id, match.id, side, position, playerId);
      if (await save((previous) => ({ ...previous, matches: next }))) setMessage(null);
    } catch (error) {
      flash(error.message, 'error');
    }
  }

  const workingRounds = draftRounds || outing.config.rounds.map(({ id, matchCount, pointsPerMatch }) => ({ id, matchCount: String(matchCount), pointsPerMatch: String(pointsPerMatch) }));
  const workingTeamNames = draftTeamNames || outing.config.teams.map(({ id, name }) => ({ id, name }));
  const previewTotal = workingRounds.reduce((sum, r) => sum + (Number(r.matchCount) || 0) * (Number(r.pointsPerMatch) || 0), 0);

  function updateRoundField(id, field, value) {
    setDraftRounds(workingRounds.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  async function applyFormat(event) {
    event.preventDefault();
    if (workingTeamNames.some((team) => !team.name.trim() || team.name.trim().length > 35)) return flash('Team names must be 1–35 characters.', 'error');
    const normalized = workingRounds.map((item) => ({ id: item.id, matchCount: Number(item.matchCount), pointsPerMatch: Number(item.pointsPerMatch) }));
    if (normalized.some((r) => !Number.isInteger(r.matchCount) || r.matchCount < 1 || r.matchCount > 200)) return flash('Each round needs between 1 and 200 matches.', 'error');
    if (normalized.some((r) => !Number.isFinite(r.pointsPerMatch) || r.pointsPerMatch < 0.5 || r.pointsPerMatch > 10 || !Number.isInteger(r.pointsPerMatch * 2))) return flash('Points per match must be 0.5–10 in half-point steps.', 'error');
    const lockedRounds = outing.config.rounds.filter((r) => outing.matches.some((m) => m.roundId === r.id && (hasEnteredScores(m) || m.finalized)));
    if (lockedRounds.some((r) => normalized.find((v) => v.id === r.id).pointsPerMatch !== r.pointsPerMatch)) return flash('Points per match are locked in rounds with entered scores. Clear those scores before changing points.', 'error');
    const trimmedMatches = outing.matches.filter((match) => match.number > normalized.find((r) => r.id === match.roundId).matchCount);
    if (trimmedMatches.some((m) => hasEnteredScores(m) || m.finalized)) return flash('Cannot remove matches with scores. Reopen and clear them first.', 'error');
    if (trimmedMatches.some((m) => getMatchStatus(m).assigned > 0) && !window.confirm('Reducing the match count will delete some configured pairings. Continue?')) return;
    const saved = await save((previous) => {
      const rounds = previous.config.rounds.map((r) => ({ ...r, ...normalized.find((item) => item.id === r.id) }));
      const teams = previous.config.teams.map((t) => ({ ...t, name: workingTeamNames.find((team) => team.id === t.id).name.trim() }));
      return { ...previous, config: { ...previous.config, rounds, teams }, matches: resizeMatches(previous.matches, rounds) };
    });
    if (saved) { setDraftRounds(null); setDraftTeamNames(null); flash(cloudEnabled ? 'Outing format saved for everyone.' : 'Outing format saved on this device.'); }
  }

  function exportSetup() {
    const blob = new Blob([JSON.stringify(outing, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'okayest-golf-outing-backup.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    flash('Outing backup downloaded, including scores and results.');
  }

  async function importSetup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) return flash('That setup file is too large (2 MB max).', 'error');
    try {
      const loaded = normalizeOuting(JSON.parse(await file.text()));
      if (!window.confirm(`Replace ${cloudEnabled ? 'the SHARED outing for everyone' : 'this device’s roster, matchups AND SCORES'} with the backup containing ${loaded.players.length} golfers? Export the current outing first if you need a backup.`)) return;
      if (!await save(loaded)) return;
      setDraftRounds(null);
      setDraftTeamNames(null);
      setEditingId('');
      flash(cloudEnabled ? 'Backup imported to Supabase for everyone.' : 'Setup imported successfully.');
    } catch (error) {
      flash('Unable to import this file. Use an Okayest Golf Phase 2 or Phase 3 JSON backup.', 'error');
    }
  }

  async function resetSetup() {
    if (!window.confirm(`Reset ALL golfers, teams, matchups, hole scores, and finalized results ${cloudEnabled ? 'for EVERYONE' : 'on this device'}? This cannot be undone without a backup.`)) return;
    if (!await save(createInitialOuting())) return;
    setDraftRounds(null);
    setDraftTeamNames(null);
    setEditingId('');
    setRoundId('singles');
    flash(cloudEnabled ? 'The shared outing has been reset.' : 'Outing setup reset on this device.');
  }

  return (
    <div className="page inner-page organizer-page">
      <div className="page-intro"><p className="eyebrow">THE TOURNAMENT DESK</p><h1>Organizer<span className="title-period">.</span></h1><p>Build your roster, assign matchups, and set the points on the line. Started matches are protected from lineup changes.</p></div>
      <div className="organizer-local-warning" role="note"><strong>{cloudEnabled ? 'Organizer · Shared setup' : 'Local setup preview'}</strong><p>{cloudEnabled ? 'Roster, matchups and format changes now save to Supabase for every golfer. Set each golfer’s personal PIN before they sign in. Only organizers can change these settings.' : 'Changes are saved in this browser only. To enable secure shared scoring, follow PHASE_4_SETUP.md and connect Supabase.'}</p></div>
      <div className="organizer-metrics">
        <Metric value={outing.players.length} label="Golfers added" />
        <Metric value={`${readyMatches}/${outing.matches.length}`} label="Matches ready" />
        <Metric value={formatPoints(total)} label="Points available" />
      </div>
      {message && <div role="status" className={`organizer-message organizer-message--${message.kind}`}>{message.text}<button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button></div>}
      <div className="organizer-tabs" role="tablist" aria-label="Organizer tools">
        {[['golfers','Golfers'], ['matchups','Matchups'], ['format','Format & backup']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-selected' : ''} onClick={() => { setTab(id); setMessage(null); }}>{label}</button>)}
      </div>

      {tab === 'golfers' && <section className="organizer-panel" aria-label="Golfer management">
        <div className="organizer-panel-heading"><div><p className="eyebrow">BUILD THE ROSTER</p><h2>Manage golfers</h2><p>Add as many golfers as you need. You can assign or change their team later.</p></div></div>
        <form className="organizer-add-form" onSubmit={addGolfer}>
          <label className="organizer-field"><span>Golfer name</span><input aria-label="New golfer name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. John Smith" maxLength={70} required /></label>
          <label className="organizer-field"><span>Team</span><select aria-label="New golfer team" value={addTeam} onChange={(e) => setAddTeam(e.target.value)}><option value="">Unassigned</option>{outing.config.teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
          <button type="submit" className="button button--forest">+ Add golfer</button>
        </form>
        <div className="organizer-count-strip"><span>{teamName(outing, 'black')}: <b>{counts.black}</b></span><span>{teamName(outing, 'white')}: <b>{counts.white}</b></span><span>Unassigned: <b>{counts.unassigned}</b></span></div>
        {cloudEnabled && <section className="organizer-pin-panel" aria-label="Golfer PIN management">
          <h3>Golfer sign-in PINs</h3>
          <p>Assign or reset a private 6–12 digit PIN for each golfer. Only the organizer can change PINs; existing sessions are revoked when a PIN changes. Never use the organizer PIN here.</p>
          <form onSubmit={applyPin} className="organizer-pin-form">
            <label className="organizer-field"><span>Golfer</span><select value={pinGolferId} onChange={(e) => setPinGolferId(e.target.value)} required><option value="">Choose golfer</option>{outing.players.slice().sort((a,b) => a.name.localeCompare(b.name)).map((p) => <option value={p.id} key={p.id}>{p.name}{pinStatuses.includes(p.id) ? ' · PIN set' : ' · No PIN'}</option>)}</select></label>
            <label className="organizer-field"><span>New PIN (6–12 digits)</span><input type="password" inputMode="numeric" autoComplete="off" placeholder="Enter golfer PIN" value={newGolferPin} onChange={(e)=>setNewGolferPin(e.target.value)} minLength={6} maxLength={12} pattern="[0-9]{6,12}" required /></label>
            <button type="submit" className="button button--forest" disabled={!pinGolferId || pinBusy}>{pinBusy ? 'Saving…' : 'Set / reset PIN'}</button>
          </form>
          <p>{pinStatuses.length} of {outing.players.length} golfers have PINs assigned.</p>
        </section>}
        {outing.players.length === 0 && <div className="organizer-empty"><strong>No golfers added yet.</strong><p>You mentioned 17 expected golfers. Add their names above whenever the roster is ready.</p></div>}
        {['black','white',''].map((side) => {
          const members = outing.players.filter((player) => player.teamId === side).sort((a,b) => a.name.localeCompare(b.name));
          if (members.length === 0) return null;
          return <div className="organizer-roster-group" key={side || 'unassigned'}><h3>{side ? teamName(outing, side) : 'Unassigned'} <span>({members.length})</span></h3>
            {members.map((player) => <div className="organizer-player" key={player.id}>
              {editingId === player.id ? <form className="organizer-edit-form" onSubmit={changeGolfer}>
                <label className="organizer-field"><span>Name</span><input aria-label={`Edit name for ${player.name}`} maxLength={70} value={editName} onChange={(e) => setEditName(e.target.value)} required /></label>
                <label className="organizer-field"><span>Team</span><select aria-label={`Edit team for ${player.name}`} value={editTeam} onChange={(e) => setEditTeam(e.target.value)}><option value="">Unassigned</option>{outing.config.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
                <div className="organizer-row-actions"><button type="submit" className="button button--forest">Save changes</button><button type="button" className="button button--outline" onClick={() => setEditingId('')}>Cancel</button></div>
              </form> : <><div className={`organizer-avatar organizer-avatar--${side || 'none'}`}>{player.name.slice(0,1).toUpperCase()}</div><span className="organizer-player-name">{player.name}{cloudEnabled && <small className="organizer-pin-status">{pinStatuses.includes(player.id) ? 'PIN ready' : 'Needs PIN'}</small>}</span><button type="button" className="organizer-icon-button" aria-label={`Edit ${player.name}`} onClick={() => beginEdit(player)}>Edit</button><button type="button" className="organizer-icon-button organizer-icon-button--danger" aria-label={`Remove ${player.name}`} onClick={() => deleteGolfer(player)}>Remove</button></>}
            </div>)}
          </div>;
        })}
      </section>}

      {tab === 'matchups' && <section className="organizer-panel" aria-label="Matchup management">
        <div className="organizer-panel-heading"><div><p className="eyebrow">SET THE LINEUP</p><h2>Match assignments</h2><p>Golfers may play in multiple rounds, but only one match per round. Lineups lock as soon as strokes are entered.</p></div></div>
        <div className="organizer-round-tabs" role="tablist" aria-label="Matchup rounds">{outing.config.rounds.map((item) => <button key={item.id} type="button" role="tab" aria-selected={round.id === item.id} className={round.id === item.id ? 'is-selected' : ''} onClick={() => setRoundId(item.id)}><small>ROUND {item.number}</small><strong>{item.shortName}</strong></button>)}</div>
        <div className="organizer-round-intro"><div><strong>{round.name}</strong><span>{round.matchCount} matches · {round.holeStart}–{round.holeEnd} · {formatPoints(round.pointsPerMatch)} pts per match</span></div><span>{activeMatches.filter((m) => getMatchStatus(m).complete).length}/{activeMatches.length} ready</span></div>
        {outing.players.length === 0 && <div className="organizer-empty"><strong>Add golfers first</strong><p>Go to the Golfers tab to create the roster, then return to assign pairings.</p></div>}
        <div className="organizer-match-grid">
          {activeMatches.map((match) => {
            const status = getMatchStatus(match);
            return <article className="organizer-match" key={match.id}>
              <header><strong>Match {String(match.number).padStart(2,'0')}</strong><span className={status.complete ? 'organizer-ready' : ''}>{status.complete ? 'Ready' : `${status.assigned}/${status.required} assigned`}</span></header>
              <div className="organizer-match-sides">{SIDE_IDS.map((side) => <div key={side} className="organizer-match-side"><div className="organizer-match-side-heading"><i className={`competitor-dot competitor-dot--${side}`}/>{teamName(outing, side)}</div>
                {match[side].map((playerId, position) => <label className="organizer-field organizer-match-select" key={`${side}-${position}`}><span>{match[side].length > 1 ? `Partner ${position + 1}` : 'Golfer'}</span><select aria-label={`Match ${match.number} ${teamName(outing, side)} ${position + 1}`} value={playerId} onChange={(e) => updateAssignment(match, side, position, e.target.value)}><option value="">Select golfer</option>{outing.players.filter((p) => p.teamId === side).sort((a,b)=>a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id} disabled={usedInRound.has(p.id) && p.id !== playerId}>{p.name}{usedInRound.has(p.id) && p.id !== playerId ? ' (assigned)' : ''}</option>)}</select></label>)}
              </div>)}</div>
            </article>;
          })}
        </div>
      </section>}

      {tab === 'format' && <section className="organizer-panel" aria-label="Outing format settings">
        <div className="organizer-panel-heading"><div><p className="eyebrow">MAKE IT YOUR OWN</p><h2>Format & points</h2><p>Default: 8 singles, 4 alternate shot, 4 scramble, all worth 1 point. The course holes remain fixed at 1–9, 10–18, and 1–9.</p></div></div>
        <form onSubmit={applyFormat} className="organizer-settings-form">
          <h3>Team names</h3>
          <div className="organizer-two-column">{workingTeamNames.map((team) => <label key={team.id} className="organizer-field"><span>{team.id === 'black' ? 'Black team' : 'White team'}</span><input value={team.name} maxLength={35} onChange={(e)=>setDraftTeamNames(workingTeamNames.map((t)=>t.id===team.id?{...t,name:e.target.value}:t))} /></label>)}</div>
          <h3>Rounds</h3>
          {workingRounds.map((item) => {
            const configRound = outing.config.rounds.find((r) => r.id === item.id);
            return <div className="organizer-settings-round" key={item.id}><div className="organizer-settings-round-title"><strong>{configRound.name}</strong><span>Holes {configRound.holeStart}–{configRound.holeEnd}</span></div><div className="organizer-two-column"><label className="organizer-field"><span>Number of matches</span><input aria-label={`${configRound.name} match count`} type="number" min="1" max="200" step="1" value={item.matchCount} onChange={(e)=>updateRoundField(item.id,'matchCount',e.target.value)} required /></label><label className="organizer-field"><span>Points per match</span><input aria-label={`${configRound.name} points per match`} type="number" min="0.5" max="10" step="0.5" value={item.pointsPerMatch} onChange={(e)=>updateRoundField(item.id,'pointsPerMatch',e.target.value)} required /></label></div></div>;
          })}
          <div className="organizer-total-preview"><span>Preview total points</span><strong>{Number.isFinite(previewTotal) ? formatPoints(previewTotal) : '—'}</strong><span>First to {previewTotal > 0 && Number.isFinite(previewTotal) ? formatPoints(getOutingPointsToWin({ rounds: workingRounds.map((r) => ({ matchCount: Number(r.matchCount) || 0, pointsPerMatch: Number(r.pointsPerMatch) || 0 })) })) : '—'} wins</span></div>
          <button type="submit" className="button button--forest">Save format settings</button>
        </form>
        <div className="organizer-backup"><h3>Backup & transfer</h3><p>Download the complete roster, matchups, hole scores, and results as JSON. {cloudEnabled ? 'Importing a backup replaces the shared outing for EVERYONE. Personal PINs are managed separately and are never exported.' : 'Importing replaces everything on this device. This is not live synchronization.'}</p><div className="organizer-row-actions"><button type="button" className="button button--outline" onClick={exportSetup}>Export setup</button><button type="button" className="button button--outline" onClick={() => fileInputRef.current?.click()}>Import setup</button><input ref={fileInputRef} type="file" accept=".json,application/json" className="organizer-hidden-file" aria-label="Import organizer setup file" onChange={importSetup} /></div><button type="button" className="organizer-reset" onClick={resetSetup}>{cloudEnabled ? 'Reset the shared outing' : 'Reset everything on this device'}</button></div>
      </section>}
    </div>
  );
}

function clearPlayerFromMatches(matches, playerId) {
  return matches.map((match) => ({ ...match,
    black: match.black.map((id) => id === playerId ? '' : id),
    white: match.white.map((id) => id === playerId ? '' : id),
  }));
}
