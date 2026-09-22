import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatHeatScore(score: number): string {
  return score.toFixed(1);
}

export function getHeatZoneColor(zone: string): string {
  switch (zone?.toLowerCase()) {
    case 'cool': return 'text-green-700 bg-green-700/10 border-green-700/20';
    case 'moderate': return 'text-lime-400 bg-lime-400/10 border-lime-400/20';
    case 'high': return 'text-heat-high bg-heat-high/10 border-heat-high/20';
    case 'extreme': return 'text-heat-extreme bg-heat-extreme/10 border-heat-extreme/20';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}

export function getHeatZoneHex(zone: string): string {
  switch (zone?.toLowerCase()) {
    case 'cool': return '#15803d'; // green-700
    case 'moderate': return '#a3e635'; // lime-400
    case 'high': return '#f97316';
    case 'extreme': return '#ef4444';
    default: return '#64748b';
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'low': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}
