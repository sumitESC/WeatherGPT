import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Map as MapIcon, BarChart2, MapPin, Loader2, Brain, Search, CalendarDays, X } from "lucide-react";
import { useGetCities } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { data: cities, isLoading } = useGetCities();
  const [cityFilter, setCityFilter] = useState("");

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/map", label: "Heat Map", icon: MapIcon },
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/history", label: "Historical Data", icon: CalendarDays },
    { href: "/forecast", label: "16-Day Forecast", icon: CalendarDays },
    { href: "/advisor", label: "AI Advisor", icon: Brain },
  ];

  const filteredCities = Array.isArray(cities)
    ? cities.filter((c) => c.name.toLowerCase().includes(cityFilter.toLowerCase()))
    : [];

  const sidebarContent = (
    <>
      <div className="p-6 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <img 
            src={`${import.meta.env.BASE_URL}images/logo-mark.png`} 
            alt="WeatherGPT Logo" 
            className="w-8 h-8 object-contain"
          />
          <span className="font-display font-bold text-xl tracking-tight text-foreground">Weather<span className="text-primary">GPT</span></span>
        </div>
        {/* Close button — only visible on mobile */}
        <button 
          onClick={onClose}
          className="md:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar">
        
        {/* Main Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Overview</p>
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href === "/dashboard" && (location === "/" || location === "/dashboard"));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group font-medium relative overflow-hidden",
                  isActive 
                    ? "bg-primary/15 text-primary font-bold shadow-sm border border-primary/20" 
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_10px_#3b82f6]" />
                )}
                <item.icon className={cn("w-5 h-5 transition-transform duration-200 group-hover:scale-110", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* City Quick Links */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Monitored Cities</p>
          
          {/* City Search Filter */}
          <div className="relative px-1 mb-2">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Filter cities..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 text-foreground text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : filteredCities.length > 0 ? (
            filteredCities.map((city) => {
              const cityHref = `/city/${city.id}`;
              const isActive = location === cityHref;
              return (
                <Link 
                  key={city.id} 
                  href={cityHref}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group text-sm",
                    isActive 
                      ? "bg-secondary/80 text-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <MapPin className={cn("w-4 h-4", isActive ? "text-primary" : "opacity-50")} />
                  {city.name}
                </Link>
              );
            })
          ) : (
            cityFilter.trim() && (
              <p className="px-3 py-2 text-xs text-muted-foreground/60 italic">No cities match "{cityFilter}"</p>
            )
          )}
        </div>
      </div>
      
      <div className="p-4 border-t border-border/50 text-xs text-center text-muted-foreground/60">
        UP Urban Heat Intelligence<br/>v1.0.0
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <aside className="w-64 bg-card border-r border-border/50 h-screen flex-col fixed left-0 top-0 z-40 hidden md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={onClose}
          />
          {/* Sidebar panel */}
          <aside className="w-72 bg-card border-r border-border/50 h-screen flex flex-col fixed left-0 top-0 z-50 md:hidden animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
