'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  confidence,
  DEMO_PLAYERS,
  draftRound,
  DraftState,
  newDraftState,
  nextAgentPick,
  rankBoard,
} from './lib/draft';

type Team = 'family' | 'friends';
type View = 'draft' | 'roster' | 'lineups' | 'waivers' | 'audit';

const teamDetails = {
  family: { label: 'Family League', shortLabel: 'Family', logo: '/agent-of-chaos-family.webp', format: 'Demo · 12-team half-PPR' },
  friends: { label: 'Friends League', shortLabel: 'Friends', logo: '/agent-of-chaos-friends.webp', format: 'Demo · 12-team half-PPR' },
};

const navItems: Array<{ view: View; icon: string; label: string }> = [
  { view: 'draft', icon: 'D', label: 'Draft room' },
  { view: 'roster', icon: 'R', label: 'Roster' },
  { view: 'lineups', icon: 'L', label: 'Lineups' },
  { view: 'waivers', icon: 'W', label: 'Waivers' },
  { view: 'audit', icon: 'A', label: 'Audit log' },
];

const initialDrafts: Record<Team, DraftState> = { family: newDraftState(), friends: newDraftState() };

export default function Home() {
  const [team, setTeam] = useState<Team>('family');
  const [view, setView] = useState<View>('draft');
  const [drafts, setDrafts] = useState(initialDrafts);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [seconds, setSeconds] = useState(77);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  const activeTeam = teamDetails[team];
  const draft = drafts[team];
  const board = useMemo(() => rankBoard(draft), [draft]);
  const recommendation = board[0];
  const nextPick = nextAgentPick(draft.currentPick);
  const onClock = nextPick === draft.currentPick;
  const currentRound = draftRound(draft.currentPick);
  const roster = draft.roster.map((key) => DEMO_PLAYERS.find((player) => player.key === key)).filter(Boolean);
  const availablePlayers = DEMO_PLAYERS.filter((player) => !draft.history.some((item) => item.playerKey === player.key));

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('agent-of-chaos-draft-state');
        if (saved) setDrafts(JSON.parse(saved));
      } catch {
        setNotice('Saved draft state could not be loaded. Starting with the demo board.');
      } finally {
        setLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem('agent-of-chaos-draft-state', JSON.stringify(drafts));
  }, [drafts, loaded]);

  useEffect(() => {
    if (!onClock) return;
    let timer: number | undefined;
    const reset = window.setTimeout(() => {
      setSeconds(90);
      timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    }, 0);
    return () => {
      window.clearTimeout(reset);
      if (timer) window.clearInterval(timer);
    };
  }, [team, onClock, draft.currentPick]);

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

  function recordLeaguePick() {
    const normalized = query.trim().toLowerCase();
    const exact = availablePlayers.find((player) => player.name.toLowerCase() === normalized);
    const partial = availablePlayers.filter((player) => player.name.toLowerCase().includes(normalized));
    const selected = exact ?? (partial.length === 1 ? partial[0] : undefined);
    if (!selected) {
      setNotice(normalized ? 'Choose one available player from the suggestions.' : 'Enter the player who was drafted.');
      return;
    }
    applyPick(selected.key, 'league');
  }

  function undoLastPick() {
    const last = draft.history.at(-1);
    if (!last) return;
    setDrafts((current) => ({
      ...current,
      [team]: {
        currentPick: last.pick,
        roster: last.manager === 'agent' ? current[team].roster.filter((key) => key !== last.playerKey) : current[team].roster,
        history: current[team].history.slice(0, -1),
      },
    }));
    setNotice('Last pick undone.');
  }

  function resetDraft() {
    if (!window.confirm(`Reset the ${activeTeam.label} demo draft?`)) return;
    setDrafts((current) => ({ ...current, [team]: newDraftState() }));
    setNotice('Demo draft reset.');
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
          <div className="connection-pill"><span className="pulse-dot" />Bridge mode</div>
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
          <div className="sidebar-foot"><span className="status-light" /><div><strong>Decision engine ready</strong><span>Yahoo actions are manual</span></div></div>
        </aside>

        {view === 'draft' && (
          <section className="draft-room">
            <div className="room-heading">
              <div><p className="eyebrow accent-text">Live draft companion</p><h2>{onClock ? 'Make the next move.' : 'Read the room.'}</h2><p>Every pick reshapes the board. Agent of Chaos recalculates instantly.</p></div>
              <div className={`pick-clock ${onClock ? 'live' : ''}`}><span>{onClock ? 'On the clock' : 'Next Agent pick'}</span><strong>{onClock ? clockText : `#${nextPick ?? '—'}`}</strong></div>
            </div>

            <div className="demo-banner"><span>Demo player board</span><p>Interactions and scoring are live. Current NFL data will replace these fictional players in the data-connection phase.</p><button type="button" onClick={resetDraft}>Reset demo</button></div>

            <div className="draft-grid">
              <div className="primary-column">
                <section className={`record-pick-panel ${onClock ? 'waiting' : ''}`}>
                  <div><span className="step-number">01</span><div><h3>{onClock ? 'Agent of Chaos is picking' : 'Record the latest league pick'}</h3><p>{onClock ? 'Confirm the recommendation below.' : 'Tell the brain who just left the board.'}</p></div></div>
                  <div className="pick-input-row">
                    <label className="sr-only" htmlFor="drafted-player">Player just drafted</label>
                    <input id="drafted-player" list="available-players" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && recordLeaguePick()} placeholder={onClock ? 'Waiting for Agent pick…' : 'Search a player name…'} disabled={onClock} />
                    <datalist id="available-players">{availablePlayers.map((player) => <option key={player.key} value={player.name}>{player.position} · {player.proTeam}</option>)}</datalist>
                    <button type="button" onClick={recordLeaguePick} disabled={onClock}>Record pick</button>
                  </div>
                </section>

                {recommendation && (
                  <section className="recommendation-card">
                    <div className="recommendation-topline"><div className="recommendation-label"><span className="chaos-spark">✦</span>Agent recommendation</div><span className="confidence">{confidence(board)}% confidence</span></div>
                    <div className="player-hero">
                      <div><span className="position-chip">{recommendation.position} · {recommendation.proTeam} · Tier {recommendation.tier}</span><h3>{recommendation.name}</h3><p>{recommendation.rationale}</p></div>
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
                  <ol>{board.slice(1, showBoard ? 12 : 4).map((player, index) => <li key={player.key}><span className="alt-rank">{String(index + 2).padStart(2, '0')}</span><div><strong>{player.name}</strong><span>{player.position} · {player.proTeam} · Tier {player.tier}</span></div><b>{player.score.toFixed(1)}</b></li>)}</ol>
                </section>
                <section className="insight-card"><span className="insight-kicker">Board intelligence</span><p><strong>{positionRun} {recommendation?.position}s</strong> appear in the current top ten.</p><div className="run-meter"><span style={{ width: `${Math.max(20, positionRun * 10)}%` }} /></div><small>{recommendation?.position} pressure · {positionRun >= 4 ? 'High' : positionRun >= 2 ? 'Moderate' : 'Low'}</small></section>
                <div className="draft-controls"><button type="button" onClick={undoLastPick} disabled={!draft.history.length}>Undo last pick</button><span>{draft.history.length} picks recorded</span></div>
              </aside>
            </div>
          </section>
        )}

        {view === 'roster' && <RosterView roster={roster} teamName={activeTeam.label} />}
        {view === 'audit' && <AuditView draft={draft} />}
        {(view === 'lineups' || view === 'waivers') && <ComingSoonView view={view} />}
      </div>
    </main>
  );
}

function RosterView({ roster, teamName }: { roster: Array<(typeof DEMO_PLAYERS)[number] | undefined>; teamName: string }) {
  return <section className="module-page"><p className="eyebrow accent-text">{teamName}</p><h2>Drafted roster</h2><p className="module-subtitle">Agent selections appear here immediately and stay isolated from the other league.</p><div className="roster-grid">{roster.length ? roster.map((player, index) => player && <article className="roster-player" key={player.key}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{player.name}</b><small>{player.position} · {player.proTeam} · Bye {player.bye}</small></div><strong>{player.projectedPoints}</strong></article>) : <div className="empty-state"><span>R</span><h3>No picks yet</h3><p>Confirm an Agent recommendation in the Draft Room to start building this roster.</p></div>}</div></section>;
}

function AuditView({ draft }: { draft: DraftState }) {
  return <section className="module-page"><p className="eyebrow accent-text">Decision history</p><h2>Audit log</h2><p className="module-subtitle">Every recorded action is saved on this device for a clear draft-day record.</p><div className="audit-list">{draft.history.length ? [...draft.history].reverse().map((item) => { const player = DEMO_PLAYERS.find((candidate) => candidate.key === item.playerKey); return <article key={`${item.pick}-${item.playerKey}`}><span>Pick {item.pick}</span><div><b>{player?.name}</b><small>{player?.position} · {item.manager === 'agent' ? 'Agent of Chaos' : 'League manager'}</small></div><em>{item.manager === 'agent' ? 'Agent pick' : 'Board update'}</em></article>; }) : <div className="empty-state"><span>A</span><h3>No decisions recorded</h3><p>The log will populate as the draft progresses.</p></div>}</div></section>;
}

function ComingSoonView({ view }: { view: 'lineups' | 'waivers' }) {
  const isLineups = view === 'lineups';
  return <section className="module-page"><p className="eyebrow accent-text">Season command</p><h2>{isLineups ? 'Lineup optimizer' : 'Waiver room'}</h2><p className="module-subtitle">This module is staged for the league-data connection phase.</p><div className="coming-card"><span>{isLineups ? 'L' : 'W'}</span><div><h3>{isLineups ? 'Strongest legal lineup, every week' : 'FAAB discipline meets upside hunting'}</h3><p>{isLineups ? 'Once rosters and schedules are connected, the agent will account for injuries, matchups, game times, floor, upside, and late-swap flexibility.' : 'The agent will rank available players, recommend drops, calculate bids, and preserve separate budgets for both leagues.'}</p></div><b>Ready for data</b></div></section>;
}
