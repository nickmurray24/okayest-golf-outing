import { useState } from 'react';
import './SignInPage.css';

export default function SignInPage({ outing, onSignIn, onCancel, defaultRole = 'player' }) {
  const [role, setRole] = useState(defaultRole);
  const [playerId, setPlayerId] = useState('');
  const [pin, setPin] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (role === 'player' && !playerId) return setError('Select your name first.');
    if (!pin) return setError('Enter your PIN.');
    setPending(true);
    setError('');
    try { await onSignIn(role, playerId, pin); }
    catch (caught) { setError(caught.message); }
    finally { setPending(false); setPin(''); }
  }

  return <div className="page inner-page signin-page">
    <div className="page-intro"><p className="eyebrow">THE CLUBHOUSE</p><h1>Check in<span className="title-period">.</span></h1><p>View scores without signing in, or check in to enter scores for your matches.</p></div>
    <section className="signin-card">
      <div className="signin-switch" role="group" aria-label="Sign-in type">
        <button type="button" className={role === 'player' ? 'is-selected' : ''} onClick={() => { setRole('player'); setError(''); setPin(''); }}>Golfer</button>
        <button type="button" className={role === 'organizer' ? 'is-selected' : ''} onClick={() => { setRole('organizer'); setError(''); setPin(''); }}>Organizer</button>
      </div>
      <form onSubmit={submit}>
        {role === 'player' && <label className="signin-field"><span>Your name</span><select value={playerId} onChange={(e) => setPlayerId(e.target.value)} required><option value="">Select a golfer</option>{outing.players.slice().sort((a,b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <label className="signin-field"><span>{role === 'organizer' ? 'Organizer PIN' : 'Your golfer PIN'}</span><input type="password" autoComplete="off" inputMode={role === 'player' ? 'numeric' : 'text'} value={pin} onChange={(e) => setPin(e.target.value)} placeholder={role === 'player' ? '6-digit PIN' : 'Organizer PIN'} minLength={role === 'player' ? 6 : 8} maxLength={80} required /></label>
        {error && <div className="signin-error" role="alert">{error}</div>}
        <button type="submit" className="button button--forest signin-submit" disabled={pending}>{pending ? 'Checking PIN…' : role === 'organizer' ? 'Open organizer dashboard' : 'Sign in to score'}</button>
      </form>
      <p className="signin-help">{role === 'player' ? 'Ask the organizer for your personal PIN. A golfer can edit only matches they are playing in.' : 'Only the outing organizer should know this PIN. Do not share it with other golfers.'}</p>
      <button type="button" className="signin-cancel" onClick={onCancel}>← Keep browsing scores</button>
    </section>
  </div>;
}
