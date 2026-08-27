export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export type DraftPlayer = {
  key: string;
  name: string;
  position: Position;
  proTeam: string;
  bye: number;
  projectedPoints: number;
  adp: number;
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

export const TEAM_COUNT = 12;
export const DRAFT_SLOT = 10;
export const TOTAL_ROUNDS = 15;

const slots: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1 };
const flexShares: Partial<Record<Position, number>> = { RB: .45, WR: .45, TE: .1 };

export const DEMO_PLAYERS: DraftPlayer[] = [
  { key: 'rb-hale', name: 'Marcus Hale', position: 'RB', proTeam: 'ATL', bye: 5, projectedPoints: 255, adp: 10, tier: 1, floor: .84, ceiling: .92, risk: .16 },
  { key: 'wr-cross', name: 'Devin Cross', position: 'WR', proTeam: 'SEA', bye: 8, projectedPoints: 244, adp: 12, tier: 1, floor: .82, ceiling: .9, risk: .18 },
  { key: 'rb-cole', name: 'Jalen Cole', position: 'RB', proTeam: 'BUF', bye: 7, projectedPoints: 238, adp: 16, tier: 2, floor: .76, ceiling: .86, risk: .24 },
  { key: 'wr-reed', name: 'Isaiah Reed', position: 'WR', proTeam: 'CIN', bye: 10, projectedPoints: 232, adp: 18, tier: 2, floor: .78, ceiling: .83, risk: .21 },
  { key: 'te-banks', name: 'Theo Banks', position: 'TE', proTeam: 'KC', bye: 6, projectedPoints: 201, adp: 22, tier: 1, floor: .81, ceiling: .88, risk: .17 },
  { key: 'wr-stone', name: 'Caleb Stone', position: 'WR', proTeam: 'DET', bye: 8, projectedPoints: 221, adp: 24, tier: 2, floor: .73, ceiling: .87, risk: .25 },
  { key: 'rb-ford', name: 'Nico Ford', position: 'RB', proTeam: 'MIA', bye: 12, projectedPoints: 220, adp: 25, tier: 2, floor: .67, ceiling: .91, risk: .32 },
  { key: 'qb-wells', name: 'Cameron Wells', position: 'QB', proTeam: 'BAL', bye: 7, projectedPoints: 346, adp: 27, tier: 1, floor: .82, ceiling: .91, risk: .16 },
  { key: 'wr-price', name: 'Malik Price', position: 'WR', proTeam: 'PHI', bye: 9, projectedPoints: 214, adp: 30, tier: 3, floor: .72, ceiling: .82, risk: .25 },
  { key: 'rb-west', name: 'Andre West', position: 'RB', proTeam: 'GB', bye: 5, projectedPoints: 207, adp: 34, tier: 3, floor: .7, ceiling: .83, risk: .27 },
  { key: 'qb-voss', name: 'Eli Voss', position: 'QB', proTeam: 'HOU', bye: 6, projectedPoints: 329, adp: 39, tier: 2, floor: .78, ceiling: .84, risk: .19 },
  { key: 'te-shaw', name: 'Roman Shaw', position: 'TE', proTeam: 'SF', bye: 14, projectedPoints: 177, adp: 43, tier: 2, floor: .72, ceiling: .85, risk: .24 },
  { key: 'wr-hayes', name: 'Jordan Hayes', position: 'WR', proTeam: 'LAR', bye: 8, projectedPoints: 198, adp: 47, tier: 3, floor: .68, ceiling: .86, risk: .3 },
  { key: 'rb-young', name: 'Trey Young', position: 'RB', proTeam: 'CHI', bye: 11, projectedPoints: 192, adp: 51, tier: 4, floor: .64, ceiling: .88, risk: .34 },
  { key: 'wr-king', name: 'Darius King', position: 'WR', proTeam: 'DAL', bye: 10, projectedPoints: 190, adp: 56, tier: 4, floor: .61, ceiling: .9, risk: .37 },
  { key: 'qb-nash', name: 'Owen Nash', position: 'QB', proTeam: 'LAC', bye: 12, projectedPoints: 308, adp: 62, tier: 3, floor: .74, ceiling: .79, risk: .2 },
  { key: 'te-moss', name: 'Grant Moss', position: 'TE', proTeam: 'ARI', bye: 11, projectedPoints: 158, adp: 70, tier: 3, floor: .63, ceiling: .82, risk: .3 },
  { key: 'rb-lane', name: 'Kendrick Lane', position: 'RB', proTeam: 'NYJ', bye: 9, projectedPoints: 176, adp: 78, tier: 5, floor: .52, ceiling: .93, risk: .43 },
  { key: 'wr-rivers', name: 'Jayce Rivers', position: 'WR', proTeam: 'JAX', bye: 8, projectedPoints: 174, adp: 84, tier: 5, floor: .54, ceiling: .91, risk: .42 },
  { key: 'qb-knox', name: 'Miles Knox', position: 'QB', proTeam: 'MIN', bye: 6, projectedPoints: 292, adp: 91, tier: 4, floor: .67, ceiling: .82, risk: .29 },
  { key: 'te-pierce', name: 'Avery Pierce', position: 'TE', proTeam: 'IND', bye: 10, projectedPoints: 143, adp: 105, tier: 4, floor: .51, ceiling: .88, risk: .4 },
  { key: 'k-demo', name: 'Demo Kicker', position: 'K', proTeam: 'DAL', bye: 10, projectedPoints: 151, adp: 170, tier: 1, floor: .76, ceiling: .72, risk: .12 },
  { key: 'def-demo', name: 'Demo Defense', position: 'DEF', proTeam: 'PIT', bye: 5, projectedPoints: 145, adp: 168, tier: 1, floor: .7, ceiling: .78, risk: .2 },
];

export const newDraftState = (): DraftState => ({ currentPick: 15, roster: [], history: [] });

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function draftRound(pick: number) {
  return Math.ceil(pick / TEAM_COUNT);
}

export function agentPickInRound(round: number) {
  return round % 2 === 1
    ? (round - 1) * TEAM_COUNT + DRAFT_SLOT
    : round * TEAM_COUNT - DRAFT_SLOT + 1;
}

export function nextAgentPick(currentPick: number) {
  for (let round = draftRound(currentPick); round <= TOTAL_ROUNDS; round += 1) {
    const pick = agentPickInRound(round);
    if (pick >= currentPick) return pick;
  }
  return null;
}

function positionCounts(keys: string[]) {
  return keys.reduce<Record<Position, number>>((counts, key) => {
    const player = DEMO_PLAYERS.find((candidate) => candidate.key === key);
    if (player) counts[player.position] += 1;
    return counts;
  }, { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 });
}

function replacementPoints(position: Position, available: DraftPlayer[], state: DraftState) {
  const pool = available.filter((player) => player.position === position).sort((a, b) => b.projectedPoints - a.projectedPoints);
  if (!pool.length) return 0;
  const starterShare = (slots[position] ?? 0) + (slots.FLEX ?? 0) * (flexShares[position] ?? 0);
  const alreadyDrafted = state.history.filter((item) => DEMO_PLAYERS.find((player) => player.key === item.playerKey)?.position === position).length;
  const outstandingDemand = Math.max(1, Math.ceil(starterShare * TEAM_COUNT) - alreadyDrafted);
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

export function rankBoard(state: DraftState): RankedPlayer[] {
  const drafted = new Set(state.history.map((item) => item.playerKey));
  const available = DEMO_PLAYERS.filter((player) => !drafted.has(player.key));
  const round = draftRound(state.currentPick);
  const nextPick = nextAgentPick(state.currentPick) ?? state.currentPick;
  const roster = positionCounts(state.roster);
  const eligible = available.filter((player) => !(['K', 'DEF'].includes(player.position) && round < TOTAL_ROUNDS - 1));

  return eligible.map<RankedPlayer>((player) => {
    const sameTier = eligible.filter((candidate) => candidate.position === player.position && candidate.tier === player.tier).length;
    const sameBye = state.roster.filter((key) => {
      const rostered = DEMO_PLAYERS.find((candidate) => candidate.key === key);
      return rostered?.position === player.position && rostered.bye === player.bye;
    }).length;
    const components: ScoreComponents = {
      replacement: clamp((player.projectedPoints - replacementPoints(player.position, eligible, state)) / 80 * 100),
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
    if (player.position === 'TE' && roster.TE >= 1 && round < 9) score -= 12;
    if (player.tier === 1 && ['QB', 'TE'].includes(player.position)) score += 4;

    const labels: Array<[string, number]> = [
      ['replacement-level advantage', components.replacement],
      ['roster fit', components.rosterFit],
      ['tier scarcity', components.scarcity],
      ['ADP value', components.adpValue],
      ['next-pick pressure', components.survival],
      ['upside', components.upside],
    ];
    const strongest = labels.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label]) => label);
    return { ...player, score: Math.round(clamp(score) * 10) / 10, components, rationale: `Best available value, led by ${strongest.join(', ')}.` };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function confidence(board: RankedPlayer[]) {
  const margin = board[0] && board[1] ? board[0].score - board[1].score : 10;
  return Math.round(Math.min(95, Math.max(58, 72 + margin)));
}
