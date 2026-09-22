import { cn, getHeatZoneColor } from "@/lib/utils";
import { AlertTriangle, ThermometerSun, Leaf, Flame } from "lucide-react";

interface HeatZoneBadgeProps {
  zone: string;
  className?: string;
  showIcon?: boolean;
}

export function HeatZoneBadge({ zone, className, showIcon = true }: HeatZoneBadgeProps) {
  const normalizedZone = zone?.toLowerCase() || 'unknown';
  
  const Icon = {
    cool: Leaf,
    moderate: ThermometerSun,
    high: Flame,
    extreme: AlertTriangle,
  }[normalizedZone] || ThermometerSun;

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
      getHeatZoneColor(normalizedZone),
      className
    )}>
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {normalizedZone}
    </div>
  );
}
