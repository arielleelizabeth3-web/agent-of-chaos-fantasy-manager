import { CURRENT_DRAFT_BOARD } from '../data/draft-board';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export type DraftPlayer = {
  key: string;
  name: string;
  position: Position;
  proTeam: string;
  bye: number;
  projectedPoints: number;
  adp: number;
  yahooRank: number;
  tier: number;
  floor: number;
  ceiling: number;
  risk: number;
};

export type DraftHistoryItem = {
  playerKey: string;
  pick: number;
  manager: 'agent' | 'league';
};

export type DraftState = {
  currentPick: number;
  roster: string[];
  history: DraftHistoryItem[];
  draftSlot?: number;
  teamCount?: number;
  totalRounds?: number;
};

export type ScoreComponents = {
  replacement: number;
  rosterFit: number;
  scarcity: number;
  adpValue: number;
  survival: number;
  upside: number;
  safety: number;
  byeFit: number;
};

export type RankedPlayer = DraftPlayer & {
  score: number;
  components: ScoreComponents;
  rationale: string;
};

export type DraftLeagueConfig = {
  receptionsPerReception: number;
  longTouchdownBonus: number;
  interceptionPenalty: number;
};

export const DEFAULT_TEAM_COUNT = 12;
export const DEFAULT_DRAFT_SLOT = 10;
export const DEFAULT_TOTAL_ROUNDS = 16;

const slots: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1 };
const flexShares: Partial<Record<Position, number>> = { RB: .45, WR: .45, TE: .1 };

export function normalizePlayerName(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[’']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|defense|dst|d\/st)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const projectionBase: Record<Position, number> = { QB: 360, RB: 305, WR: 300, TE: 235, K: 155, DEF: 150 };
const projectionDrop: Record<Position, number> = { QB: 5.2, RB: 4.1, WR: 3.7, TE: 5.2, K: 2.1, DEF: 2.1 };

export const DRAFT_PLAYERS: DraftPlayer[] = CURRENT_DRAFT_BOARD.map((entry, index) => {
  const positionRank = CURRENT_DRAFT_BOARD.slice(0, index + 1).filter((player) => player.position === entry.position).length;
  const rankShape = Math.min(1, entry.rank / 220);
  return {
    key: entry.position.toLowerCase() + '-' + normalizePlayerName(entry.name),
    name: entry.name,
    position: entry.position,
    proTeam: entry.proTeam,
    bye: entry.bye,
    projectedPoints: Math.round(Math.max(70, projectionBase[entry.position] - (positionRank - 1) * projectionDrop[entry.position])),
    adp: entry.rank,
    yahooRank: entry.yahooRank,
    tier: Math.max(1, Math.ceil(positionRank / (['RB', 'WR'].includes(entry.position) ? 6 : 4))),
    floor: Math.max(.42, .88 - rankShape * .34),
    ceiling: Math.max(.68, .97 - rankShape * .2),
    risk: Math.min(.58, .12 + rankShape * .38),
  };
});

export const newDraftState = (draftSlot = DEFAULT_DRAFT_SLOT, totalRounds = DEFAULT_TOTAL_ROUNDS): DraftState => ({
  currentPick: 1,
  roster: [],
  history: [],
  draftSlot,
  teamCount: DEFAULT_TEAM_COUNT,
  totalRounds,
});

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function draftRound(pick: number, teamCount = DEFAULT_TEAM_COUNT) {
  return Math.ceil(pick / teamCount);
}

export function agentPickInRound(round: number, draftSlot = DEFAULT_DRAFT_SLOT, teamCount = DEFAULT_TEAM_COUNT) {
  return round % 2 === 1
    ? (round - 1) * teamCount + draftSlot
    : round * teamCount - draftSlot + 1;
}

export function nextAgentPick(currentPick: number, draftSlot = DEFAULT_DRAFT_SLOT, totalRounds = DEFAULT_TOTAL_ROUNDS, teamCount = DEFAULT_TEAM_COUNT) {
  for (let round = draftRound(currentPick, teamCount); round <= totalRounds; round += 1) {
    const pick = agentPickInRound(round, draftSlot, teamCount);
    if (pick >= currentPick) return pick;
  }
  return null;
}

function positionCounts(keys: string[]) {
  return keys.reduce<Record<Position, number>>((counts, key) => {
    const player = DRAFT_PLAYERS.find((candidate) => candidate.key === key);
    if (player) counts[player.position] += 1;
    return counts;
  }, { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 });
}

function replacementPoints(position: Position, available: DraftPlayer[], state: DraftState, teamCount: number) {
  const pool = available.filter((player) => player.position === position).sort((a, b) => b.projectedPoints - a.projectedPoints);
  if (!pool.length) return 0;
  const starterShare = (slots[position] ?? 0) + (slots.FLEX ?? 0) * (flexShares[position] ?? 0);
  const alreadyDrafted = state.history.filter((item) => DRAFT_PLAYERS.find((player) => player.key === item.playerKey)?.position === position).length;
  const outstandingDemand = Math.max(1, Math.ceil(starterShare * teamCount) - alreadyDrafted);
  return pool[Math.min(pool.length - 1, outstandingDemand - 1)].projectedPoints;
}

function rosterFit(position: Position, roster: Record<Position, number>) {
  const exact = slots[position] ?? 0;
  if (roster[position] < exact) return 95;
  if (['RB', 'WR', 'TE'].includes(position)) {
    const flexPlayers = roster.RB + roster.WR + roster.TE;
    if (flexPlayers < slots.RB + slots.WR + slots.TE + slots.FLEX) return 82;
  }
  return position === 'QB' || position === 'TE' ? 48 : 55;
}

function phaseWeights(round: number) {
  if (round <= 5) return { replacement: .35, rosterFit: .15, scarcity: .13, adpValue: .08, survival: .12, upside: .09, safety: .06, byeFit: .02 };
  if (round <= 10) return { replacement: .27, rosterFit: .2, scarcity: .12, adpValue: .1, survival: .12, upside: .1, safety: .06, byeFit: .03 };
  return { replacement: .16, rosterFit: .18, scarcity: .08, adpValue: .08, survival: .08, upside: .3, safety: .06, byeFit: .06 };
}

export function rankBoard(state: DraftState, league?: DraftLeagueConfig): RankedPlayer[] {
  const drafted = new Set(state.history.map((item) => item.playerKey));
  const available = DRAFT_PLAYERS.filter((player) => !drafted.has(player.key));
  const teamCount = state.teamCount ?? DEFAULT_TEAM_COUNT;
  const totalRounds = state.totalRounds ?? DEFAULT_TOTAL_ROUNDS;
  const draftSlot = state.draftSlot ?? DEFAULT_DRAFT_SLOT;
  const round = draftRound(state.currentPick, teamCount);
  const nextPick = nextAgentPick(state.currentPick, draftSlot, totalRounds, teamCount) ?? state.currentPick;
  const roster = positionCounts(state.roster);
  const eligible = available.filter((player) => !(['K', 'DEF'].includes(player.position) && round < totalRounds - 1));

  return eligible.map<RankedPlayer>((player) => {
    const sameTier = eligible.filter((candidate) => candidate.position === player.position && candidate.tier === player.tier).length;
    const sameBye = state.roster.filter((key) => {
      const rostered = DRAFT_PLAYERS.find((candidate) => candidate.key === key);
      return rostered?.position === player.position && rostered.bye === player.bye;
    }).length;
    const components: ScoreComponents = {
      replacement: clamp((player.projectedPoints - replacementPoints(player.position, eligible, state, teamCount)) / 80 * 100),
      rosterFit: rosterFit(player.position, roster),
      scarcity: sameTier === 1 ? 92 : sameTier === 2 ? 72 : sameTier <= 4 ? 55 : 38,
      adpValue: clamp(50 + (state.currentPick - player.adp) * 3.5),
      survival: clamp(50 + (nextPick - player.adp) * 3.5),
      upside: player.ceiling * 100,
      safety: ((1 - player.risk) * .65 + player.floor * .35) * 100,
      byeFit: Math.max(25, 100 - sameBye * 20),
    };
    const weights = phaseWeights(round);
    let score = Object.entries(weights).reduce((total, [key, weight]) => total + components[key as keyof ScoreComponents] * weight, 0);
    if (player.position === 'QB' && roster.QB >= 1 && round < 9) score -= 18;
    if (player.position === 'QB' && roster.QB >= 2) score -= 45;
    if (player.position === 'TE' && roster.TE >= 1 && round < 9) score -= 12;
    if (player.position === 'TE' && roster.TE >= 2) score -= 32;
    if (player.position === 'K' && roster.K >= 1) score -= 70;
    if (player.position === 'DEF' && roster.DEF >= 1) score -= 70;
    if (player.tier === 1 && ['QB', 'TE'].includes(player.position)) score += 4;
    if (league?.receptionsPerReception === 1) {
      if (player.position === 'WR') score += 3.5;
      if (player.position === 'TE') score += 2.5;
      if (player.position === 'RB') score += 1.5;
    }
    if ((league?.longTouchdownBonus ?? 0) > 0) score += player.ceiling * 2.5;
    if (player.position === 'QB' && (league?.interceptionPenalty ?? 0) <= -2) score -= player.risk * 4;
    const yahooValue = player.yahooRank > 0 ? player.yahooRank - player.adp : 0;
    if (yahooValue >= 15) score += Math.min(7, yahooValue * .12);

    const labels: Array<[string, number]> = [
      ['replacement-level advantage', components.replacement],
      ['roster fit', components.rosterFit],
      ['tier scarcity', components.scarcity],
      ['ADP value', components.adpValue],
      ['next-pick pressure', components.survival],
      ['upside', components.upside],
    ];
    const strongest = labels.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label]) => label);
    const scoringNote = league?.receptionsPerReception === 1
      ? league.longTouchdownBonus > 0
        ? ' Full-PPR and 40+ yard bonuses are included.'
        : ' Full-PPR scoring is included.'
      : (league?.longTouchdownBonus ?? 0) > 0
        ? ' 40+ yard touchdown bonuses are included.'
        : '';
    const roomNote = yahooValue >= 20 ? ` Yahoo currently buries him ${yahooValue} spots below this PPR board.` : '';
    return { ...player, score: Math.round(clamp(score) * 10) / 10, components, rationale: `Best available value, led by ${strongest.join(', ')}.${scoringNote}${roomNote}` };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function confidence(board: RankedPlayer[]) {
  const margin = board[0] && board[1] ? board[0].score - board[1].score : 10;
  return Math.round(Math.min(95, Math.max(58, 72 + margin)));
}

