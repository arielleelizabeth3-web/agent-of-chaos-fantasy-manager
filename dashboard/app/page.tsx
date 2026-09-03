'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  confidence,
  DEFAULT_DRAFT_SLOT,
  DRAFT_PLAYERS,
  draftRound,
  DraftState,
  newDraftState,
  nextAgentPick,
  normalizePlayerName,
  rankBoard,
} from './lib/draft';
import { DRAFT_BOARD_SOURCE, DRAFT_BOARD_UPDATED } from './data/draft-board';
import {
  BridgePlayer,
  BridgeTeamState,
  calculateFantasyPoints,
  DEFAULT_PROFILES,
  LeagueProfile,
  Team,
} from './lib/league';

type View = 'draft' | 'roster' | 'lineups' | 'waivers' | 'league' | 'audit' | 'settings';
type SyncStatus = 'loading' | 'saving' | 'synced' | 'local' | 'error';

type TeamSettings = {
  leagueId: string;
  yahooTeamKey: string;
  lineupReview: boolean;
  waiverWatch: boolean;
  weeklyReport: boolean;
};

type YahooStatus = {
  configured: boolean;
  connected: boolean;
  callbackUrl: string;
  accessMode: string;
};

type StatePayload = { drafts?: Record<Team, DraftState>; user?: { displayName?: string; email?: string } };
type SettingsPayload = { settings?: Record<Team, TeamSettings> };
type LeaguePayload = { profiles?: Record<Team, LeagueProfile> };
type BridgePayload = { bridge?: Record<Team, BridgeTeamState> };

const teamDetails = {
  family: { shortLabel: 'Family', logo: '/agent-of-chaos-family.webp' },
  friends: { shortLabel: 'Friends', logo: '/agent-of-chaos-friends.webp' },
};

const navItems: Array<{ view: View; icon: string; label: string }> = [
  { view: 'draft', icon: 'D', label: 'Draft room' },
  { view: 'roster', icon: 'R', label: 'Roster' },
  { view: 'lineups', icon: 'L', label: 'Lineups' },
  { view: 'waivers', icon: 'W', label: 'Waivers' },
  { view: 'league', icon: 'P', label: 'League profile' },
  { view: 'audit', icon: 'A', label: 'Audit log' },
  { view: 'settings', icon: 'S', label: 'Production setup' },
];

const initialDrafts: Record<Team, DraftState> = { family: newDraftState(), friends: newDraftState() };
const initialSettings: Record<Team, TeamSettings> = {
  family: { leagueId: '186731', yahooTeamKey: '', lineupReview: true, waiverWatch: true, weeklyReport: true },
  friends: { leagueId: '662011', yahooTeamKey: '', lineupReview: true, waiverWatch: true, weeklyReport: true },
};
const initialBridge: Record<Team, BridgeTeamState> = {
  family: { roster: [], waivers: [] }, friends: { roster: [], waivers: [] },
};

export default function Home() {
  const [team, setTeam] = useState<Team>('friends');
  const [view, setView] = useState<View>('draft');
  const [drafts, setDrafts] = useState(initialDrafts);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [seconds, setSeconds] = useState(77);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [syncText, setSyncText] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [settings, setSettings] = useState(initialSettings);
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [bridge, setBridge] = useState(initialBridge);
  const [yahooStatus, setYahooStatus] = useState<YahooStatus | null>(null);
  const [userName, setUserName] = useState('Private manager');

  const branding = teamDetails[team];
  const profile = profiles[team];
  const activeTeam = { ...branding, label: profile.leagueName, format: profile.summary };
  const draft = drafts[team];
  const board = useMemo(() => rankBoard(draft, {
    receptionsPerReception: ruleValue(profile, 'receptions'),
    longTouchdownBonus: ruleValue(profile, 'receiving40Touchdowns'),
    interceptionPenalty: ruleValue(profile, 'interceptions'),
  }), [draft, profile]);
  const recommendation = board[0];
  const configuredRounds = draft.totalRounds ?? profile.roster.slots.length + profile.roster.bench;
  const configuredTeams = draft.teamCount ?? profile.teamCount;
  const configuredSlot = draft.draftSlot ?? DEFAULT_DRAFT_SLOT;
  const nextPick = nextAgentPick(draft.currentPick, configuredSlot, configuredRounds, configuredTeams);
  const onClock = nextPick === draft.currentPick;
  const currentRound = draftRound(draft.currentPick, configuredTeams);
  const roster = draft.roster.map((key) => DRAFT_PLAYERS.find((player) => player.key === key)).filter(Boolean);
  const availablePlayers = DRAFT_PLAYERS.filter((player) => !draft.history.some((item) => item.playerKey === player.key));

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch('/api/state', { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error('State service unavailable');
        return response.json() as Promise<StatePayload>;
      }),
      fetch('/api/settings', { signal: controller.signal }).then((response) => response.json() as Promise<SettingsPayload>),
      fetch('/api/yahoo/status', { signal: controller.signal }).then((response) => response.json() as Promise<YahooStatus>),
      fetch('/api/league', { signal: controller.signal }).then((response) => response.json() as Promise<LeaguePayload>),
      fetch('/api/bridge', { signal: controller.signal }).then((response) => response.json() as Promise<BridgePayload>),
    ]).then(([stateData, settingsData, yahooData, leagueData, bridgeData]) => {
      const nextProfiles = leagueData.profiles ?? DEFAULT_PROFILES;
      const nextDrafts = stateData.drafts ?? initialDrafts;
      setDrafts({
        family: hydrateDraftState(nextDrafts.family, nextProfiles.family),
        friends: hydrateDraftState(nextDrafts.friends, nextProfiles.friends),
      });
      setSettings(settingsData.settings ?? initialSettings);
      setYahooStatus(yahooData);
      setProfiles(nextProfiles);
      setBridge(bridgeData.bridge ?? initialBridge);
      setUserName(stateData.user?.displayName ?? stateData.user?.email ?? 'Private manager');
      setSyncStatus('synced');
    }).catch(() => {
      try {
        const saved = localStorage.getItem('agent-of-chaos-draft-state');
        if (saved) {
          const localDrafts = JSON.parse(saved) as Record<Team, DraftState>;
          setDrafts({
            family: hydrateDraftState(localDrafts.family, DEFAULT_PROFILES.family),
            friends: hydrateDraftState(localDrafts.friends, DEFAULT_PROFILES.friends),
          });
        }
      } catch { /* Keep safe demo defaults. */ }
      setSyncStatus('local');
      setCloudSyncEnabled(false);
      setNotice('Cloud sync is unavailable in this preview. A local backup is active.');
    }).finally(() => setLoaded(true));

    const connection = new URLSearchParams(window.location.search).get('connection');
    const connectionNotice = window.setTimeout(() => {
      if (connection === 'connected') setNotice('Yahoo account connected securely.');
      if (connection === 'needs-credentials') setNotice('Yahoo credentials still need to be added to production.');
      if (connection && !['connected', 'needs-credentials'].includes(connection)) setNotice('Yahoo connection was not completed. Try again from Production Setup.');
    }, 0);
    return () => { controller.abort(); window.clearTimeout(connectionNotice); };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('agent-of-chaos-draft-state', JSON.stringify(drafts));
    if (!cloudSyncEnabled) return;
    const timer = window.setTimeout(() => {
      setSyncStatus('saving');
      void Promise.all((['family', 'friends'] as Team[]).map((draftTeam) => fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: draftTeam, draft: drafts[draftTeam] }),
      }).then((response) => { if (!response.ok) throw new Error('Save failed'); })))
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [drafts, loaded, cloudSyncEnabled]);

  useEffect(() => {
    if (!loaded || !cloudSyncEnabled) return;
    const timer = window.setTimeout(() => {
      void fetch('/api/bridge', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, state: bridge[team] }),
      }).catch(() => setSyncStatus('error'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [bridge, team, loaded, cloudSyncEnabled]);

  useEffect(() => {
    if (!onClock) return;
    let timer: number | undefined;
    const reset = window.setTimeout(() => {
      setSeconds(profile.draft.secondsPerPick);
      timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    }, 0);
    return () => {
      window.clearTimeout(reset);
      if (timer) window.clearInterval(timer);
    };
  }, [team, onClock, draft.currentPick, profile.draft.secondsPerPick]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function applyPick(playerKey: string, manager: 'agent' | 'league') {
    setDrafts((current) => {
      const state = current[team];
      if (state.history.some((item) => item.playerKey === playerKey)) return current;
      return {
        ...current,
        [team]: {
          ...state,
          currentPick: state.currentPick + 1,
          roster: manager === 'agent' ? [...state.roster, playerKey] : state.roster,
          history: [...state.history, { playerKey, pick: state.currentPick, manager }],
        },
      };
    });
    setQuery('');
    setShowBreakdown(false);
    setNotice(manager === 'agent' ? 'Agent pick added to the roster.' : 'League pick recorded. Board recalculated.');
  }

  function selectedPlayer(value: string) {
    const normalized = normalizePlayerName(value);
    const exact = availablePlayers.find((player) => normalizePlayerName(player.name) === normalized);
    const partial = availablePlayers.filter((player) => normalizePlayerName(player.name).includes(normalized) || normalized.includes(normalizePlayerName(player.name)));
    return exact ?? (partial.length === 1 ? partial[0] : undefined);
  }

  function recordPick(manager: 'agent' | 'league') {
    const selected = selectedPlayer(query);
    if (!selected) {
      setNotice(query.trim() ? 'Choose one available player from the suggestions.' : 'Enter the player who was drafted.');
      return;
    }
    applyPick(selected.key, manager);
  }

  function syncMissedPicks() {
    const alreadyDrafted = new Set(draft.history.map((item) => item.playerKey));
    const matched = syncText.split(/\r?\n/).map((line) => line.replace(/^\s*#?\d+[.)-]?\s*/, '').trim())
      .map((line) => selectedPlayer(line)).filter((player): player is (typeof DRAFT_PLAYERS)[number] => Boolean(player))
      .filter((player, index, all) => !alreadyDrafted.has(player.key) && all.findIndex((candidate) => candidate.key === player.key) === index);
    if (!matched.length) {
      setNotice('No new player names were matched. Paste one drafted player per line.');
      return;
    }
    setDrafts((current) => {
      const state = current[team];
      let pick = state.currentPick;
      const additions = matched.map((player) => ({ playerKey: player.key, pick: pick++, manager: 'league' as const }));
      return { ...current, [team]: { ...state, currentPick: pick, history: [...state.history, ...additions] } };
    });
    setSyncText('');
    setShowSync(false);
    setNotice(`${matched.length} missed picks synced. Board recalculated.`);
  }

  function undoLastPick() {
    const last = draft.history.at(-1);
    if (!last) return;
    setDrafts((current) => ({
      ...current,
      [team]: {
        ...current[team],
        currentPick: last.pick,
        roster: last.manager === 'agent' ? current[team].roster.filter((key) => key !== last.playerKey) : current[team].roster,
        history: current[team].history.slice(0, -1),
      },
    }));
    setNotice('Last pick undone.');
  }

  function resetDraft() {
    if (!window.confirm(`Clear every recorded ${activeTeam.label} draft pick and start at pick 1?`)) return;
    setDrafts((current) => ({ ...current, [team]: newDraftState(configuredSlot, profile.roster.slots.length + profile.roster.bench) }));
    setNotice('Live draft board cleared and ready at pick 1.');
  }

  function configureDraft(patch: Partial<DraftState>) {
    setDrafts((current) => ({ ...current, [team]: { ...current[team], ...patch } }));
  }

  function updateTeamSettings(patch: Partial<TeamSettings>) {
    setSettings((current) => ({ ...current, [team]: { ...current[team], ...patch } }));
  }

  async function saveTeamSettings() {
    setNotice('Saving production settings…');
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, settings: settings[team] }),
      });
      if (!response.ok) throw new Error('Save failed');
      setNotice(`${activeTeam.label} settings saved securely.`);
    } catch {
      setNotice('Settings could not be saved. Try again after cloud sync is available.');
    }
  }

  function updateBridge(next: BridgeTeamState) {
    setBridge((current) => ({ ...current, [team]: next }));
    setSyncStatus(cloudSyncEnabled ? 'saving' : 'local');
  }

  const clockText = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const positionRun = board.slice(0, 10).filter((player) => player.position === recommendation?.position).length;

  return (
    <main className={`app-shell theme-${team}`}>
      {notice && <div className="toast" role="status">{notice}</div>}
      <header className="topbar">
        <div className="brand-lockup">
          <Image src={activeTeam.logo} alt="" width={52} height={52} className="brand-mark" unoptimized />
          <div><p className="eyebrow">Fantasy command center</p><h1>Agent of Chaos</h1></div>
        </div>
        <div className="topbar-actions">
          <div className={`connection-pill sync-${syncStatus}`}><span className="pulse-dot" />{syncLabel(syncStatus)}</div>
          <button className="team-switcher" type="button" onClick={() => setTeam(team === 'family' ? 'friends' : 'family')}>
            <span>{activeTeam.shortLabel}</span><span aria-hidden="true">⇄</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="team-card">
            <div className="team-card-glow" />
            <Image src={activeTeam.logo} alt={`${activeTeam.label} Agent of Chaos logo`} width={57} height={57} unoptimized />
            <div><strong>{activeTeam.label}</strong><span>{activeTeam.format}</span></div>
          </div>
          <nav aria-label="Manager sections">
            {navItems.map((item) => (
              <button key={item.view} className={`nav-item ${view === item.view ? 'active' : ''}`} type="button" onClick={() => setView(item.view)}>
                <span className="nav-icon">{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot"><span className="status-light" /><div><strong>Decision engine ready</strong><span>{userName} · Yahoo read-only</span></div></div>
        </aside>

        {view === 'draft' && (
          <section className="draft-room">
            <div className="room-heading">
              <div><p className="eyebrow accent-text">Live draft companion</p><h2>{onClock ? 'Make the next move.' : 'Read the room.'}</h2><p>Every pick reshapes the board. Agent of Chaos recalculates instantly.</p></div>
              <div className={`pick-clock ${onClock ? 'live' : ''}`}><span>{onClock ? 'On the clock' : 'Next Agent pick'}</span><strong>{onClock ? clockText : `#${nextPick ?? '—'}`}</strong></div>
            </div>

            <div className="draft-night-banner"><span className="live-indicator" /> <strong>Browser bridge ready</strong><p>Share the Yahoo draft tab with Codex tonight. I’ll read picks directly and keep this board synchronized.</p></div>

            <div className="draft-setup-bar">
              <label>Agent draft slot<select value={configuredSlot} onChange={(event) => configureDraft({ draftSlot: Number(event.target.value) })}>{Array.from({ length: configuredTeams }, (_, index) => <option key={index + 1} value={index + 1}>#{index + 1}</option>)}</select></label>
              <label>Current overall pick<input type="number" min="1" max={configuredTeams * configuredRounds} value={draft.currentPick} onChange={(event) => configureDraft({ currentPick: Math.max(1, Math.min(configuredTeams * configuredRounds, Number(event.target.value) || 1)) })} /></label>
              <div><span>Format</span><strong>{configuredTeams} teams · {configuredRounds} rounds · {profile.draft.secondsPerPick}s</strong></div>
              <button type="button" onClick={resetDraft}>{draft.history.length ? 'Clear & restart' : 'Start at pick 1'}</button>
            </div>

            <div className="demo-banner"><span>Live 2026 board</span><p>{DRAFT_PLAYERS.length} real players · {DRAFT_BOARD_SOURCE} · refreshed {DRAFT_BOARD_UPDATED}. {profile.leagueName} scoring and roster construction are active.</p><button type="button" onClick={() => setShowSync((value) => !value)}>{showSync ? 'Close recovery' : 'Missed picks?'}</button></div>

            <div className="draft-grid">
              <div className="primary-column">
                {showSync && <section className="batch-sync-panel"><div><span className="step-number">Recovery</span><h3>Catch up missed opponent picks</h3><p>Paste one player name per line. Agent selections should still be recorded separately.</p></div><textarea value={syncText} onChange={(event) => setSyncText(event.target.value)} rows={4} placeholder={'Josh Allen\nPuka Nacua\nBreece Hall'} /><div><button type="button" className="primary-action" onClick={syncMissedPicks}>Sync names</button><button type="button" className="secondary-action" onClick={() => { setShowSync(false); setSyncText(''); }}>Cancel</button></div></section>}

                <section className={`record-pick-panel ${onClock ? 'waiting' : ''}`}>
                  <div><span className="step-number">01</span><div><h3>{onClock ? 'Agent of Chaos is on the clock' : 'Record the latest Yahoo pick'}</h3><p>{onClock ? 'Use the recommendation below—or record the player actually selected.' : 'Mark each player off as Yahoo announces the pick.'}</p></div></div>
                  <div className="pick-input-row">
                    <label className="sr-only" htmlFor="drafted-player">Player just drafted</label>
                    <input id="drafted-player" list="available-players" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && recordPick(onClock ? 'agent' : 'league')} placeholder="Search any available player…" />
                    <datalist id="available-players">{availablePlayers.map((player) => <option key={player.key} value={player.name}>{player.position} · {player.proTeam} · PPR #{player.adp}</option>)}</datalist>
                    <button type="button" onClick={() => recordPick('league')}>Taken</button>
                    <button type="button" className="agent-pick-button" onClick={() => recordPick('agent')}>Agent pick</button>
                  </div>
                </section>

                {recommendation && (
                  <section className="recommendation-card">
                    <div className="recommendation-topline"><div className="recommendation-label"><span className="chaos-spark">✦</span>Agent recommendation</div><span className="confidence">{confidence(board)}% confidence</span></div>
                    <div className="player-hero">
                      <div><span className="position-chip">{recommendation.position} · {recommendation.proTeam} · Tier {recommendation.tier} · PPR #{recommendation.adp}{recommendation.yahooRank ? ` · Yahoo #${recommendation.yahooRank}` : ''}</span><h3>{recommendation.name}</h3><p>{recommendation.rationale}</p></div>
                      <div className="chaos-score"><span>Chaos score</span><strong>{recommendation.score.toFixed(1)}</strong></div>
                    </div>
                    <div className="metrics-grid">
                      <div><span>Replacement value</span><strong>{Math.round(recommendation.components.replacement)}</strong></div>
                      <div><span>Roster fit</span><strong>{Math.round(recommendation.components.rosterFit)}</strong></div>
                      <div><span>Tier scarcity</span><strong>{Math.round(recommendation.components.scarcity)}</strong></div>
                      <div><span>Upside</span><strong>{Math.round(recommendation.components.upside)}</strong></div>
                    </div>
                    {showBreakdown && <div className="breakdown"><div><span>ADP value</span><strong>{Math.round(recommendation.components.adpValue)}</strong></div><div><span>Next-pick pressure</span><strong>{Math.round(recommendation.components.survival)}</strong></div><div><span>Safety</span><strong>{Math.round(recommendation.components.safety)}</strong></div><div><span>Bye fit</span><strong>{Math.round(recommendation.components.byeFit)}</strong></div></div>}
                    <div className="recommendation-actions">
                      <button type="button" className="primary-action" disabled={!onClock} onClick={() => applyPick(recommendation.key, 'agent')}>{onClock ? `Draft ${recommendation.name}` : 'Available at next Agent pick'}</button>
                      <button type="button" className="secondary-action" onClick={() => setShowBreakdown((value) => !value)}>{showBreakdown ? 'Hide breakdown' : 'View full breakdown'}</button>
                    </div>
                  </section>
                )}
              </div>

              <aside className="intel-column">
                <section className="round-card"><div><span>Round</span><strong>{String(currentRound).padStart(2, '0')}</strong></div><div><span>Current pick</span><strong>{draft.currentPick}</strong></div><div><span>Next pick</span><strong>{nextPick ?? '—'}</strong></div></section>
                <section className="alternatives-card">
                  <div className="section-title-row"><div><span className="eyebrow">Contingency board</span><h3>Next best options</h3></div><button type="button" onClick={() => setShowBoard((value) => !value)} aria-label="Toggle complete rankings">{showBoard ? '×' : '↗'}</button></div>
                  <ol>{board.slice(1, showBoard ? 18 : 4).map((player, index) => <li key={player.key}><span className="alt-rank">{String(index + 2).padStart(2, '0')}</span><div><strong>{player.name}</strong><span>{player.position} · {player.proTeam} · PPR #{player.adp}{player.yahooRank ? ` · Y! ${player.yahooRank}` : ''}</span></div><b>{player.score.toFixed(1)}</b></li>)}</ol>
                </section>
                <section className="insight-card"><span className="insight-kicker">Board intelligence</span><p><strong>{positionRun} {recommendation?.position}s</strong> appear in the current top ten.</p><div className="run-meter"><span style={{ width: `${Math.max(20, positionRun * 10)}%` }} /></div><small>{recommendation?.position} pressure · {positionRun >= 4 ? 'High' : positionRun >= 2 ? 'Moderate' : 'Low'}</small></section>
                <div className="draft-controls"><button type="button" onClick={undoLastPick} disabled={!draft.history.length}>Undo last pick</button><span>{draft.history.length} picks recorded</span></div>
              </aside>
            </div>
          </section>
        )}

        {view === 'roster' && <RosterView roster={roster} teamName={activeTeam.label} />}
        {view === 'lineups' && <LineupView profile={profile} state={bridge[team]} onChange={updateBridge} />}
        {view === 'waivers' && <WaiverView state={bridge[team]} onChange={updateBridge} />}
        {view === 'league' && <LeagueProfileView profile={profile} />}
        {view === 'audit' && <AuditView draft={draft} />}
        {view === 'settings' && <SettingsView teamName={activeTeam.label} values={settings[team]} yahoo={yahooStatus} onChange={updateTeamSettings} onSave={saveTeamSettings} />}
      </div>
      <nav className="mobile-nav" aria-label="Manager sections">
        {navItems.map((item) => <button key={item.view} type="button" className={view === item.view ? 'active' : ''} onClick={() => setView(item.view)}><span>{item.icon}</span>{item.label}</button>)}
      </nav>
    </main>
  );
}

function RosterView({ roster, teamName }: { roster: Array<(typeof DRAFT_PLAYERS)[number] | undefined>; teamName: string }) {
  return <section className="module-page"><p className="eyebrow accent-text">{teamName}</p><h2>Drafted roster</h2><p className="module-subtitle">Agent selections appear here immediately and stay isolated from the other league.</p><div className="roster-grid">{roster.length ? roster.map((player, index) => player && <article className="roster-player" key={player.key}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{player.name}</b><small>{player.position} · {player.proTeam} · Bye {player.bye}</small></div><strong>PPR #{player.adp}</strong></article>) : <div className="empty-state"><span>R</span><h3>No picks yet</h3><p>Confirm an Agent recommendation in the Draft Room to start building this roster.</p></div>}</div></section>;
}

function AuditView({ draft }: { draft: DraftState }) {
  return <section className="module-page"><p className="eyebrow accent-text">Decision history</p><h2>Audit log</h2><p className="module-subtitle">Every recorded action is saved to your private command center and available across devices.</p><div className="audit-list">{draft.history.length ? [...draft.history].reverse().map((item) => { const player = DRAFT_PLAYERS.find((candidate) => candidate.key === item.playerKey); return <article key={`${item.pick}-${item.playerKey}`}><span>Pick {item.pick}</span><div><b>{player?.name}</b><small>{player?.position} · {item.manager === 'agent' ? 'Agent of Chaos' : 'League manager'}</small></div><em>{item.manager === 'agent' ? 'Agent pick' : 'Board update'}</em></article>; }) : <div className="empty-state"><span>A</span><h3>No decisions recorded</h3><p>The log will populate as the draft progresses.</p></div>}</div></section>;
}

function SettingsView({ teamName, values, yahoo, onChange, onSave }: {
  teamName: string;
  values: TeamSettings;
  yahoo: YahooStatus | null;
  onChange: (patch: Partial<TeamSettings>) => void;
  onSave: () => void;
}) {
  const callback = yahoo?.callbackUrl ?? 'Available after the production service starts';
  return <section className="module-page settings-page">
    <p className="eyebrow accent-text">Production foundation</p><h2>Connect {teamName}</h2>
    <p className="module-subtitle">Private cloud sync is active. Finish the league identifiers and Yahoo connection when access is approved.</p>
    <div className="setup-grid">
      <article className="setup-card connection-setup">
        <div className="setup-card-heading"><span className={yahoo?.connected ? 'setup-status ready' : 'setup-status'}>{yahoo?.connected ? 'Connected' : yahoo?.configured ? 'Ready to connect' : 'Needs credentials'}</span><h3>Yahoo Fantasy</h3><p>OAuth credentials stay on the server. They are never stored in your browser or source code.</p></div>
        <label>Production callback URL<input value={callback} readOnly /></label>
        <div className="setup-actions"><button type="button" className="primary-action" disabled={!yahoo?.configured || Boolean(yahoo?.connected)} onClick={() => { window.location.href = '/api/yahoo/connect'; }}>{yahoo?.connected ? 'Yahoo connected' : 'Connect Yahoo account'}</button><button type="button" className="secondary-action" onClick={() => navigator.clipboard?.writeText(callback)}>Copy callback</button></div>
        <small className="legal-note">Fantasy data provided by <a href="https://sports.yahoo.com/fantasy/" target="_blank" rel="noreferrer">Yahoo Fantasy</a>. Current API access is read-only; roster changes remain in Bridge Mode.</small>
      </article>
      <article className="setup-card">
        <div className="setup-card-heading"><span className="setup-status ready">Cloud saved</span><h3>League mapping</h3><p>These values tell Agent of Chaos which league and team belong to this identity.</p></div>
        <label>Yahoo league ID<input value={values.leagueId} onChange={(event) => onChange({ leagueId: event.target.value })} placeholder="Example: 123456" /></label>
        <label>Yahoo team key<input value={values.yahooTeamKey} onChange={(event) => onChange({ yahooTeamKey: event.target.value })} placeholder="Example: 449.l.123456.t.10" /></label>
        <button type="button" className="primary-action" onClick={onSave}>Save league settings</button>
      </article>
      <article className="setup-card automation-card">
        <div className="setup-card-heading"><span className="setup-status staged">Dry-run policy</span><h3>Automation guardrails</h3><p>Choose what the agent should monitor. Execution stays review-only until Yahoo write access exists.</p></div>
        <Toggle label="Daily lineup review" detail="Check injuries, byes, matchups, and locked players." checked={values.lineupReview} onChange={(checked) => onChange({ lineupReview: checked })} />
        <Toggle label="Waiver watch" detail="Rank adds, drops, and suggested FAAB bids." checked={values.waiverWatch} onChange={(checked) => onChange({ waiverWatch: checked })} />
        <Toggle label="Weekly decision report" detail="Keep an auditable summary for each league." checked={values.weeklyReport} onChange={(checked) => onChange({ weeklyReport: checked })} />
        <button type="button" className="primary-action" onClick={onSave}>Save automation policy</button>
      </article>
      <article className="setup-card install-card"><div className="setup-card-heading"><span className="setup-status ready">Phone ready</span><h3>Add to your home screen</h3><p>Open the published app in Safari or Chrome, use the Share menu, and choose Add to Home Screen. It will launch like a standalone app.</p></div><div className="install-preview"><Image src="/agent-of-chaos-family.webp" alt="Agent of Chaos app icon" width={64} height={64} unoptimized /><div><strong>Agent of Chaos</strong><span>Private fantasy command center</span></div></div></article>
    </div>
  </section>;
}

function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-row"><div><strong>{label}</strong><span>{detail}</span></div><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function syncLabel(status: SyncStatus) {
  if (status === 'saving') return 'Saving…';
  if (status === 'synced') return 'Cloud synced';
  if (status === 'local') return 'Local preview';
  if (status === 'error') return 'Sync needs attention';
  return 'Connecting…';
}

function hydrateDraftState(state: DraftState | undefined, profile: LeagueProfile) {
  const totalRounds = profile.roster.slots.length + profile.roster.bench;
  if (!state) return newDraftState(DEFAULT_DRAFT_SLOT, totalRounds);
  const knownHistory = state.history.filter((item) => DRAFT_PLAYERS.some((player) => player.key === item.playerKey));
  const hasLegacyBoard = knownHistory.length !== state.history.length;
  if (hasLegacyBoard) return newDraftState(state.draftSlot ?? DEFAULT_DRAFT_SLOT, totalRounds);
  return {
    ...state,
    currentPick: state.draftSlot === undefined && !state.history.length ? 1 : state.currentPick,
    draftSlot: state.draftSlot ?? DEFAULT_DRAFT_SLOT,
    teamCount: state.teamCount ?? profile.teamCount,
    totalRounds: state.totalRounds ?? totalRounds,
  };
}

function LineupView({ profile, state, onChange }: { profile: LeagueProfile; state: BridgeTeamState; onChange: (state: BridgeTeamState) => void }) {
  const starters = optimizeLineup(state.roster);
  const sorted = [...state.roster].sort((a, b) => Number(starters.has(b.id)) - Number(starters.has(a.id)) || b.projection - a.projection);
  return <section className="module-page bridge-page">
    <p className="eyebrow accent-text">Bridge mode · cloud saved</p><h2>Lineup optimizer</h2>
    <p className="module-subtitle">Enter Yahoo’s weekly projections and availability. The app fills the strongest legal {profile.roster.slots.join(' · ')} lineup without needing API access.</p>
    <PlayerEditor title="Add a roster player" action="Add player" onAdd={(player) => onChange({ ...state, roster: [...state.roster, player] })} />
    <div className="bridge-list">
      {sorted.length ? sorted.map((player) => <article key={player.id} className={`bridge-player ${starters.has(player.id) ? 'starter' : ''}`}>
        <span className="lineup-badge">{starters.has(player.id) ? 'START' : 'BENCH'}</span><div><b>{player.name}</b><small>{player.position} · {player.status}</small></div><strong>{player.projection.toFixed(1)}</strong>
        <button type="button" aria-label={`Remove ${player.name}`} onClick={() => onChange({ ...state, roster: state.roster.filter((item) => item.id !== player.id) })}>×</button>
      </article>) : <div className="empty-state"><span>L</span><h3>Add your Yahoo roster</h3><p>The optimizer will identify starters as soon as players and weekly projections are entered.</p></div>}
    </div>
  </section>;
}

function WaiverView({ state, onChange }: { state: BridgeTeamState; onChange: (state: BridgeTeamState) => void }) {
  const decisions = state.waivers.map((candidate) => {
    const samePosition = state.roster.filter((player) => player.position === candidate.position && player.status !== 'IR').sort((a, b) => a.projection - b.projection);
    const drop = samePosition[0];
    return { candidate, drop, delta: candidate.projection - (drop?.projection ?? 0) };
  }).sort((a, b) => b.delta - a.delta);
  function claim(candidate: BridgePlayer, drop?: BridgePlayer) {
    onChange({ roster: [...state.roster.filter((player) => player.id !== drop?.id), candidate], waivers: state.waivers.filter((player) => player.id !== candidate.id) });
  }
  return <section className="module-page bridge-page">
    <p className="eyebrow accent-text">Bridge mode · decision queue</p><h2>Waiver room</h2>
    <p className="module-subtitle">Add available players with Yahoo’s weekly projections. Agent of Chaos compares each one with the weakest rostered player at the same position.</p>
    <PlayerEditor title="Add a waiver candidate" action="Add candidate" onAdd={(player) => onChange({ ...state, waivers: [...state.waivers, player] })} />
    <div className="waiver-grid">
      {decisions.length ? decisions.map(({ candidate, drop, delta }, index) => <article className="waiver-card" key={candidate.id}>
        <div className="waiver-rank">#{index + 1}</div><div className="waiver-copy"><span>{candidate.position} · {candidate.status}</span><h3>{candidate.name}</h3><p>{drop ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} projected points versus ${drop.name}.` : 'No same-position player is currently on the roster.'}</p></div>
        <div className={`waiver-delta ${delta > 0 ? 'positive' : ''}`}><strong>{candidate.projection.toFixed(1)}</strong><span>projected</span></div>
        <div className="waiver-actions"><button type="button" className="primary-action" onClick={() => claim(candidate, drop)}>{drop ? `Claim · drop ${drop.name}` : 'Add to roster'}</button><button type="button" className="secondary-action" onClick={() => onChange({ ...state, waivers: state.waivers.filter((player) => player.id !== candidate.id) })}>Remove</button></div>
      </article>) : <div className="empty-state"><span>W</span><h3>No waiver candidates</h3><p>Add the players you are considering and the comparison queue will rank them.</p></div>}
    </div>
  </section>;
}

function PlayerEditor({ title, action, onAdd }: { title: string; action: string; onAdd: (player: BridgePlayer) => void }) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<BridgePlayer['position']>('RB');
  const [projection, setProjection] = useState('');
  const [status, setStatus] = useState<BridgePlayer['status']>('Active');
  function submit() {
    const points = Number(projection);
    if (!name.trim() || !Number.isFinite(points) || points < 0) return;
    onAdd({ id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${name}`, name: name.trim(), position, projection: points, status });
    setName(''); setProjection(''); setStatus('Active');
  }
  return <article className="player-editor"><div><span className="eyebrow">Manual Yahoo entry</span><h3>{title}</h3></div><label>Player name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Player name" /></label><label>Position<select value={position} onChange={(event) => setPosition(event.target.value as BridgePlayer['position'])}>{['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Projection<input type="number" min="0" step="0.1" value={projection} onChange={(event) => setProjection(event.target.value)} placeholder="14.8" /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as BridgePlayer['status'])}>{['Active', 'Questionable', 'Out', 'IR'].map((value) => <option key={value}>{value}</option>)}</select></label><button type="button" className="primary-action" onClick={submit}>{action}</button></article>;
}

function LeagueProfileView({ profile }: { profile: LeagueProfile }) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const calculatorRules = profile.scoring.offense.filter((rule) => ['passingYards', 'passingTouchdowns', 'interceptions', 'rushingYards', 'rushingTouchdowns', 'receptions', 'receivingYards', 'receivingTouchdowns', 'passing40Touchdowns', 'rushing40Touchdowns', 'receiving40Touchdowns', 'fumblesLost'].includes(rule.key));
  const total = calculateFantasyPoints(stats, profile);
  if (!profile.imported) return <section className="module-page"><p className="eyebrow accent-text">League intelligence</p><h2>League profile</h2><div className="empty-state"><span>P</span><h3>Settings not imported yet</h3><p>Send screenshots of this league’s Yahoo Scoring & Settings page and Agent of Chaos will build its second rule-aware profile.</p></div></section>;
  return <section className="module-page profile-page">
    <p className="eyebrow accent-text">Yahoo settings imported</p><h2>{profile.leagueName}</h2><p className="module-subtitle">League {profile.leagueId} · {profile.summary}. These rules now drive draft and weekly decisions.</p>
    <div className="profile-hero-grid">
      <article className="profile-summary"><span className="setup-status ready">Profile active</span><h3>League format</h3><div className="profile-facts"><div><span>Draft</span><strong>{profile.draft.time}</strong><small>{profile.draft.type} · {profile.draft.secondsPerPick} sec/pick</small></div><div><span>Roster</span><strong>{profile.roster.slots.join(' · ')}</strong><small>{profile.roster.bench} bench · {profile.roster.injuredReserve} IR</small></div><div><span>Waivers</span><strong>{profile.waivers.type}</strong><small>{profile.waivers.processing} · {profile.waivers.periodDays} day</small></div><div><span>Playoffs</span><strong>{profile.playoffs.teams} teams · Weeks {profile.playoffs.weeks.join(', ')}</strong><small>{profile.playoffs.tiebreaker} · reseeding {profile.playoffs.reseeding ? 'on' : 'off'}</small></div></div></article>
      <article className="score-calculator"><div><span className="eyebrow">Scoring lab</span><h3>Fantasy point calculator</h3><p>Enter a player stat line to verify Yahoo scoring.</p></div><div className="calculator-total"><span>Total</span><strong>{total.toFixed(2)}</strong><small>fantasy points</small></div><div className="calculator-grid">{calculatorRules.map((rule) => <label key={rule.key}>{rule.label}<input type="number" min="0" value={stats[rule.key] ?? ''} onChange={(event) => setStats((current) => ({ ...current, [rule.key]: Number(event.target.value) || 0 }))} /></label>)}</div></article>
    </div>
    <div className="rules-grid">
      <RuleTable title="Offense" rules={profile.scoring.offense} />
      <RuleTable title="Kickers" rules={profile.scoring.kicking} />
      <RuleTable title="Defense / special teams" rules={profile.scoring.defense} />
      <article className="rule-card"><div className="rule-card-title"><span>League operations</span><strong>{profile.settings.length} imported rules</strong></div><div className="rule-list">{profile.settings.map((setting) => <div key={setting.label}><span>{setting.label}</span><strong>{setting.value}</strong></div>)}<div><span>Trade deadline</span><strong>{profile.trades.deadline}</strong></div><div><span>Trade review</span><strong>{profile.trades.review} · {profile.trades.rejectDays} day</strong></div></div></article>
    </div>
  </section>;
}

function RuleTable({ title, rules }: { title: string; rules: LeagueProfile['scoring']['offense'] }) {
  return <article className="rule-card"><div className="rule-card-title"><span>{title}</span><strong>{rules.length} rules</strong></div><div className="rule-list">{rules.map((rule) => <div key={rule.key}><span>{rule.label}</span><strong>{rule.display}</strong></div>)}</div></article>;
}

function optimizeLineup(players: BridgePlayer[]) {
  const eligible = players.filter((player) => !['Out', 'IR'].includes(player.status)).sort((a, b) => b.projection - a.projection);
  const starters = new Set<string>();
  const take = (position: BridgePlayer['position'], count: number) => eligible.filter((player) => player.position === position && !starters.has(player.id)).slice(0, count).forEach((player) => starters.add(player.id));
  take('QB', 1); take('RB', 2); take('WR', 2); take('TE', 1); take('K', 1); take('DEF', 1);
  const flex = eligible.filter((player) => ['RB', 'WR', 'TE'].includes(player.position) && !starters.has(player.id))[0];
  if (flex) starters.add(flex.id);
  return starters;
}

function ruleValue(profile: LeagueProfile, key: string) {
  return [...profile.scoring.offense, ...profile.scoring.kicking, ...profile.scoring.defense].find((rule) => rule.key === key)?.value ?? 0;
}

