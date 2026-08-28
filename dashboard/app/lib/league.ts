export type Team = 'family' | 'friends';

export type ScoringRule = {
  key: string;
  label: string;
  value: number;
  unit: 'point' | 'per_yard' | 'bonus';
  display: string;
};

export type LeagueProfile = {
  leagueName: string;
  leagueId: string;
  imported: boolean;
  summary: string;
  teamCount: number;
  draft: {
    type: string;
    time: string;
    secondsPerPick: number;
    keeper: boolean;
    keeperDeadline: string;
    draftPickTrades: boolean;
  };
  roster: { slots: string[]; bench: number; injuredReserve: number };
  waivers: { type: string; processing: string; periodDays: number; injuredToIr: boolean };
  trades: { deadline: string; review: string; rejectDays: number; maximum: string };
  playoffs: { teams: number; weeks: number[]; tiebreaker: string; reseeding: boolean };
  settings: Array<{ label: string; value: string }>;
  scoring: { offense: ScoringRule[]; kicking: ScoringRule[]; defense: ScoringRule[] };
};

export type BridgePlayer = {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
  projection: number;
  status: 'Active' | 'Questionable' | 'Out' | 'IR';
};

export type BridgeTeamState = { roster: BridgePlayer[]; waivers: BridgePlayer[] };

const offense: ScoringRule[] = [
  { key: 'passingYards', label: 'Passing yards', value: 0.04, unit: 'per_yard', display: '1 pt / 25 yd' },
  { key: 'passingTouchdowns', label: 'Passing touchdowns', value: 4, unit: 'point', display: '4 pts' },
  { key: 'interceptions', label: 'Interceptions', value: -2, unit: 'point', display: '-2 pts' },
  { key: 'rushingYards', label: 'Rushing yards', value: 0.1, unit: 'per_yard', display: '1 pt / 10 yd' },
  { key: 'rushingTouchdowns', label: 'Rushing touchdowns', value: 6, unit: 'point', display: '6 pts' },
  { key: 'receptions', label: 'Receptions', value: 1, unit: 'point', display: '1 pt (full PPR)' },
  { key: 'receivingYards', label: 'Receiving yards', value: 0.1, unit: 'per_yard', display: '1 pt / 10 yd' },
  { key: 'receivingTouchdowns', label: 'Receiving touchdowns', value: 6, unit: 'point', display: '6 pts' },
  { key: 'returnTouchdowns', label: 'Return touchdowns', value: 6, unit: 'point', display: '6 pts' },
  { key: 'twoPointConversions', label: '2-point conversions', value: 2, unit: 'point', display: '2 pts' },
  { key: 'fumblesLost', label: 'Fumbles lost', value: -2, unit: 'point', display: '-2 pts' },
  { key: 'offensiveFumbleReturnTouchdowns', label: 'Offensive fumble return TD', value: 6, unit: 'point', display: '6 pts' },
  { key: 'passing40Touchdowns', label: '40+ yard passing TD', value: 2, unit: 'bonus', display: '+2 bonus' },
  { key: 'rushing40Touchdowns', label: '40+ yard rushing TD', value: 2, unit: 'bonus', display: '+2 bonus' },
  { key: 'receiving40Touchdowns', label: '40+ yard receiving TD', value: 2, unit: 'bonus', display: '+2 bonus' },
];

const kicking: ScoringRule[] = [
  { key: 'fieldGoals0To19', label: 'Field goals 0–19 yards', value: 3, unit: 'point', display: '3 pts' },
  { key: 'fieldGoals20To29', label: 'Field goals 20–29 yards', value: 3, unit: 'point', display: '3 pts' },
  { key: 'fieldGoals30To39', label: 'Field goals 30–39 yards', value: 3, unit: 'point', display: '3 pts' },
  { key: 'fieldGoals40To49', label: 'Field goals 40–49 yards', value: 4, unit: 'point', display: '4 pts' },
  { key: 'fieldGoals50Plus', label: 'Field goals 50+ yards', value: 5, unit: 'point', display: '5 pts' },
  { key: 'extraPointsMade', label: 'Point after attempt made', value: 1, unit: 'point', display: '1 pt' },
];

const defense: ScoringRule[] = [
  { key: 'sacks', label: 'Sacks', value: 1, unit: 'point', display: '1 pt' },
  { key: 'defensiveInterceptions', label: 'Interceptions', value: 2, unit: 'point', display: '2 pts' },
  { key: 'fumbleRecoveries', label: 'Fumble recoveries', value: 2, unit: 'point', display: '2 pts' },
  { key: 'defensiveTouchdowns', label: 'Touchdowns', value: 6, unit: 'point', display: '6 pts' },
  { key: 'safeties', label: 'Safeties', value: 2, unit: 'point', display: '2 pts' },
  { key: 'blockedKicks', label: 'Blocked kicks', value: 2, unit: 'point', display: '2 pts' },
  { key: 'kickReturnTouchdowns', label: 'Kick/punt return TD', value: 6, unit: 'point', display: '6 pts' },
  { key: 'pointsAllowed0', label: 'Points allowed: 0', value: 10, unit: 'point', display: '10 pts' },
  { key: 'pointsAllowed1To6', label: 'Points allowed: 1–6', value: 7, unit: 'point', display: '7 pts' },
  { key: 'pointsAllowed7To13', label: 'Points allowed: 7–13', value: 4, unit: 'point', display: '4 pts' },
  { key: 'pointsAllowed14To20', label: 'Points allowed: 14–20', value: 1, unit: 'point', display: '1 pt' },
  { key: 'pointsAllowed21To27', label: 'Points allowed: 21–27', value: 0, unit: 'point', display: '0 pts' },
  { key: 'pointsAllowed28To34', label: 'Points allowed: 28–34', value: -1, unit: 'point', display: '-1 pt' },
  { key: 'pointsAllowed35Plus', label: 'Points allowed: 35+', value: -4, unit: 'point', display: '-4 pts' },
  { key: 'extraPointReturns', label: 'Extra point returned', value: 2, unit: 'point', display: '2 pts' },
];

export const FAMILY_PROFILE: LeagueProfile = {
  leagueName: 'Mac 5 Fantasy Football',
  leagueId: '186731',
  imported: true,
  summary: '12-team · Full PPR · Keeper · Head-to-head',
  teamCount: 12,
  draft: {
    type: 'Live Standard Draft',
    time: 'Tue Sep 8, 2026 · 7:30 PM EDT',
    secondsPerPick: 60,
    keeper: true,
    keeperDeadline: 'Tue Sep 8, 2026 · 3:00 AM EDT',
    draftPickTrades: true,
  },
  roster: { slots: ['QB', 'WR', 'WR', 'RB', 'RB', 'TE', 'W/R/T', 'K', 'DEF'], bench: 6, injuredReserve: 2 },
  waivers: { type: 'Continual rolling list', processing: 'Game Time – Tuesday', periodDays: 1, injuredToIr: true },
  trades: { deadline: 'November 28, 2026', review: 'League votes', rejectDays: 1, maximum: 'No maximum' },
  playoffs: { teams: 6, weeks: [15, 16, 17], tiebreaker: 'Higher seed wins', reseeding: true },
  settings: [
    { label: 'Scoring', value: 'Head-to-head · Week 1 start' },
    { label: 'Acquisitions', value: 'No season or weekly maximum' },
    { label: 'Trades', value: 'No maximum · draft picks allowed' },
    { label: 'Can’t-cut list', value: 'Yahoo Sports' },
    { label: 'Post-draft players', value: 'Follow waiver rules' },
    { label: 'Divisions', value: 'None' },
    { label: 'Median / second opponent', value: 'Disabled' },
    { label: 'Bench locking', value: 'Disabled' },
    { label: 'Postponed-game IR', value: 'Enabled' },
    { label: 'League visibility', value: 'Private' },
    { label: 'Invite permissions', value: 'All managers can invite' },
  ],
  scoring: { offense, kicking, defense },
};

export const FRIENDS_PROFILE: LeagueProfile = {
  leagueName: 'Friends League', leagueId: '', imported: false,
  summary: 'Waiting for league settings', teamCount: 12,
  draft: { type: 'Not imported', time: 'Not imported', secondsPerPick: 60, keeper: false, keeperDeadline: 'Not imported', draftPickTrades: false },
  roster: { slots: ['QB', 'WR', 'WR', 'RB', 'RB', 'TE', 'W/R/T', 'K', 'DEF'], bench: 6, injuredReserve: 2 },
  waivers: { type: 'Not imported', processing: 'Not imported', periodDays: 1, injuredToIr: false },
  trades: { deadline: 'Not imported', review: 'Not imported', rejectDays: 1, maximum: 'Not imported' },
  playoffs: { teams: 0, weeks: [], tiebreaker: 'Not imported', reseeding: false },
  settings: [], scoring: { offense: [], kicking: [], defense: [] },
};

export const DEFAULT_PROFILES: Record<Team, LeagueProfile> = { family: FAMILY_PROFILE, friends: FRIENDS_PROFILE };

export function calculateFantasyPoints(stats: Record<string, number>, profile: LeagueProfile) {
  return [...profile.scoring.offense, ...profile.scoring.kicking, ...profile.scoring.defense]
    .reduce((total, rule) => total + (stats[rule.key] ?? 0) * rule.value, 0);
}
