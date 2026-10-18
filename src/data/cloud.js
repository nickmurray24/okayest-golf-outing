/**
 * Supabase PostgREST + Realtime protocol, with no extra npm dependency.
 * Only public/publishable keys are read from REACT_APP_ variables.
 * NEVER put service_role or secret keys in a React environment variable.
 */
const baseUrl = (process.env.REACT_APP_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const publicKey = (process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();
export const cloudEnabled = Boolean(baseUrl && publicKey);
const SESSION_KEY = 'okayest-golf-session-v1';

export function getStoredSession() {
  try {
    const data = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
    return data && typeof data.token === 'string' && data.token.length >= 32 ? data : null;
  } catch (_) { return null; }
}
export function storeSession(session) {
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
}

async function rpc(name, params = {}) {
  if (!cloudEnabled) throw new Error('Supabase is not configured. See PHASE_4_SETUP.md.');
  const result = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: publicKey, ...(publicKey.startsWith('eyJ') ? { Authorization: `Bearer ${publicKey}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const text = await result.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
  if (!result.ok) {
    const message = json?.message || `Supabase request failed (${result.status}).`;
    const err = new Error(message);
    err.code = json?.code;
    err.status = result.status;
    throw err;
  }
  return json;
}

export const cloud = {
  read: () => rpc('okayest_read'),
  loginPlayer: (playerId, pin) => rpc('okayest_player_login', { p_player_id: playerId, p_pin: pin }),
  loginOrganizer: (pin) => rpc('okayest_organizer_login', { p_pin: pin }),
  sessionInfo: (token) => rpc('okayest_session_info', { p_token: token }),
  logout: (token) => rpc('okayest_logout', { p_token: token }),
  saveOrganizer: (token, revision, outing) => rpc('okayest_organizer_save', { p_token: token, p_expected_revision: revision, p_state: outing }),
  saveMatch: (token, matchId, revision, match) => rpc('okayest_match_save', {
    p_token: token, p_match_id: matchId, p_expected_match_revision: revision,
    p_holes: match.holes, p_finalized: Boolean(match.finalized),
  }),
  pinStatuses: (token) => rpc('okayest_pin_status', { p_token: token }),
  setPlayerPin: (token, playerId, pin) => rpc('okayest_set_pin', { p_token: token, p_player_id: playerId, p_pin: pin }),
};

/**
 * Realtime Postgres Changes notices contain only a monotonically increasing revision.
 * The full outing is fetched via okayest_read, so private credential tables never stream.
 * A periodic refresh stays active if the socket cannot connect on course Wi-Fi.
 */
export function subscribeToChanges(onChange) {
  if (!cloudEnabled || typeof WebSocket === 'undefined') return () => {};
  let stopped = false;
  let socket;
  let retryTimer;
  let heartbeat;
  let ref = 0;
  const topic = 'realtime:okayest-outing-updates';
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(publicKey)}&vsn=1.0.0`;
  function send(event, target, payload, joinRef = null) {
    if (socket?.readyState !== WebSocket.OPEN) return;
    ref += 1;
    socket.send(JSON.stringify({ topic: target, event, payload, ref: String(ref), join_ref: joinRef }));
  }
  function connect() {
    if (stopped) return;
    try { socket = new WebSocket(wsUrl); } catch (_) { return; }
    socket.onopen = () => {
      send('phx_join', topic, {
        config: { private: false, broadcast: { ack: false, self: false },
          postgres_changes: [{ event: 'UPDATE', schema: 'public', table: 'okayest_updates' }] },
      }, '1');
      heartbeat = window.setInterval(() => send('heartbeat', 'phoenix', {}), 25000);
    };
    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.topic === topic && packet.event === 'postgres_changes') onChange();
      } catch (_) { /* Ignore messages from unsupported protocol extensions. */ }
    };
    socket.onclose = () => {
      window.clearInterval(heartbeat);
      if (!stopped) retryTimer = window.setTimeout(connect, 8000);
    };
    socket.onerror = () => { try { socket.close(); } catch (_) { /* no-op */ } };
  }
  connect();
  return () => {
    stopped = true;
    window.clearTimeout(retryTimer);
    window.clearInterval(heartbeat);
    if (socket) { try { socket.close(); } catch (_) { /* no-op */ } }
  };
}
