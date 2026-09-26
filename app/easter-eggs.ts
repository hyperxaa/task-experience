import type { Child, State } from '@/lib/domain';
import { DISCOVERY_IDS, objectiveDiscoveryCandidates } from '@/lib/discoveries';

export type EggSignals = { tabs: number; logo: number; phrases: number; house: number };
export const EGG_IDS = DISCOVERY_IDS;
export const defaultEggSignals: EggSignals = { tabs: 0, logo: 0, phrases: 0, house: 0 };

export function discoveredEggIds(completions: State['completions'], child: Child): Set<string> {
  return new Set(completions.filter(item => item.child === child && !item.discoveryReset && item.taskId.startsWith('egg-')).map(item => item.taskId.slice(4)));
}

export function eggResetEpoch(completions: State['completions'], child: Child): string {
  return completions.filter(item => item.child === child && item.discoveryReset).map(item => item.discoveryReset!.at).sort().at(-1) ?? 'initial';
}

export function eggCandidates(state: State, child: Child, today: string, signals: EggSignals) {
  const ids: string[] = [...objectiveDiscoveryCandidates(state, child, today)];
  if (signals.tabs >= 3) ids.push('explorer-three');
  if (signals.tabs >= 4) ids.push('explorer-all');
  if (signals.logo >= 3) ids.push('logo-tap');
  if (signals.phrases >= 5) ids.push('phrase-switch');
  if (signals.house >= 3) ids.push('house-scout');
  return ids;
}
