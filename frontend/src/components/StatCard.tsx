import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositiveGood?: boolean;
  };
  className?: string;
  delay?: number;
}

export function StatCard({ title, value, subtitle, icon, trend, className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "bg-card border border-border/50 rounded-2xl p-6 relative overflow-hidden group",
        "shadow-lg shadow-black/20 hover:shadow-xl hover:border-primary/30 transition-all duration-300",
        className
      )}
    >
      <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full pointer-events-none" />
      
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-medium text-muted-foreground tracking-wide text-sm">{title}</h3>
        <div className="p-2.5 bg-secondary/50 rounded-xl text-primary ring-1 ring-white/5 shadow-inner">
          {icon}
        </div>
      </div>
      
      <div className="flex flex-col gap-1">
        <div className="text-3xl font-display font-bold text-foreground">
          {value}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
        
        {trend && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded-md",
              trend.value > 0 
                ? (trend.isPositiveGood ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400") 
                : (trend.isPositiveGood ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400")
            )}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
