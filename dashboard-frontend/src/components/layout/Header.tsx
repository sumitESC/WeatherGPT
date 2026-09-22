import { useState, useRef, useEffect } from "react";
import { useRefreshWeatherData, useGetCities } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { 
  RefreshCw, Bell, Search, Menu, MapPin, Cpu, Flame, CloudRain, 
  AlertTriangle, CheckCheck, X, ExternalLink, Radio, ShieldCheck 
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDataSource } from "@/context/DataSourceContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { fetchLiveUpdates } from "@/lib/renderApi";

interface NotificationItem {
  id: string;
  type: "heat" | "rain" | "exhaust" | "system";
  title: string;
  description: string;
  time: string;
  cityId?: number;
  read: boolean;
}

export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: cities } = useGetCities();
  const { dataSource } = useDataSource();

  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Live Emergency Climate Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Fetch real-time live climate notifications from backend API /api/v1/live-update
  useEffect(() => {
    let isMounted = true;
    async function loadLiveAlerts() {
      try {
        const liveRes = await fetchLiveUpdates();
        if (isMounted && liveRes && Array.isArray(liveRes.alerts) && liveRes.alerts.length > 0) {
          // Deduplicate alerts by city so notifications show distinct cities
          const cityMap = new Map<string, any>();
          for (const a of liveRes.alerts) {
            const cityKey = (a.city || "").toLowerCase();
            if (!cityMap.has(cityKey)) {
              cityMap.set(cityKey, a);
            }
          }
          const uniqueAlerts = Array.from(cityMap.values());

          // Climate Seriousness Index Calculation
          const calculateCSI = (a: any) => {
            const sev = (a.severity || "").toUpperCase();
            let sevBonus = 0;
            if (sev === "RED") sevBonus = 50;
            else if (sev === "ORANGE") sevBonus = 30;
            else if (sev === "YELLOW") sevBonus = 15;

            const metricText = a.metric || a.message || "";
            const tempMatch = metricText.match(/(\d+\.?\d*)°C/);
            const scoreMatch = metricText.match(/(\d+\.?\d*)\s*Heat Risk/i);
            const tempVal = tempMatch ? parseFloat(tempMatch[1]) : 32;
            const scoreVal = scoreMatch ? parseFloat(scoreMatch[1]) : 50;

            return (scoreVal * 1.5) + (tempVal * 1.2) + sevBonus;
          };

          // Sort by Climate Seriousness Index descending
          const sortedAlerts = uniqueAlerts.sort((a: any, b: any) => calculateCSI(b) - calculateCSI(a));
          const displayAlerts = sortedAlerts.slice(0, 10);

          const mappedNotifs: NotificationItem[] = displayAlerts.map((a: any, idx: number) => {
            const cityMatch = Array.isArray(cities) ? cities.find(c => c.name.toLowerCase() === (a.city || "").toLowerCase()) : null;
            let type: "heat" | "rain" | "exhaust" | "system" = "heat";
            let iconStr = "🔥";
            
            if (a.alert_type === "RAIN") {
              type = "rain";
              iconStr = "🌧️";
            } else if (a.alert_type === "WIND" || a.alert_type === "HUMIDITY") {
              type = "exhaust";
              iconStr = "⚠️";
            } else if (a.alert_type === "CORRIDOR") {
              type = "system";
              iconStr = "📡";
            }

            return {
              id: a.id || `live-${idx}`,
              type,
              title: `${iconStr} ${a.title || a.alert_type + ' Alert — ' + a.city}`,
              description: a.message || a.metric || "Live monitoring update active.",
              time: a.date || "Just now",
              cityId: cityMatch ? cityMatch.id : 1,
              read: false
            };
          });
          setNotifications(mappedNotifs);
        }
      } catch (err) {
        console.warn("Header live alerts fetch warning:", err);
      }
    }

    loadLiveAlerts();
    const interval = setInterval(loadLiveAlerts, 60000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [cities]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Cache cities for API routing interceptor
  useEffect(() => {
    if (cities && Array.isArray(cities)) {
      localStorage.setItem('heatzone_cities', JSON.stringify(cities));
    }
  }, [cities]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredCities = searchQuery.trim()
    ? (Array.isArray(cities) ? cities : []).filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelect = (cityId: number) => {
    setSearchQuery("");
    setIsOpen(false);
    navigate(`/city/${cityId}`);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast({
      title: "Notifications Cleared",
      description: "All climate alerts have been marked as read.",
    });
  };

  const handleNotifClick = (notif: NotificationItem) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setIsNotifOpen(false);
    if (notif.cityId) {
      navigate(`/city/${notif.cityId}`);
    } else {
      navigate("/advisor");
    }
  };

  const refreshMutation = useRefreshWeatherData({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['/api/datasets/overview'] });
        queryClient.invalidateQueries({ queryKey: ['/api/heatzone'] });
        queryClient.invalidateQueries({ queryKey: ['/api/weather'] });
        queryClient.invalidateQueries({ queryKey: ['/api/forecast'] });
        
        toast({
          title: "Synchronization Complete",
          description: `Weather and forecast data aligned for ${data.citiesUpdated} cities. Datasets recorded.`,
        });
      },
      onError: (error: any) => {
        console.error("Manual sync error:", error);
        toast({
          title: "Sync Failed",
          description: "Could not synchronize weather data. Please check connection.",
          variant: "destructive",
        });
      }
    }
  });

  return (
    <header className="h-20 bg-background/80 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 ml-0 md:ml-64">
      <div className="flex items-center gap-4">
        <button onClick={onToggleSidebar} className="md:hidden p-2 text-muted-foreground hover:text-foreground">
          <Menu className="w-6 h-6" />
        </button>
        <div className="hidden sm:block relative" ref={searchRef}>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
          <input 
            type="text" 
            placeholder="Search cities, regions..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => { if (searchQuery.trim()) setIsOpen(true); }}
            className="bg-secondary/50 border border-border/50 text-foreground text-sm rounded-full pl-9 pr-4 py-2 w-64 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
          />
          {isOpen && filteredCities.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-2xl shadow-black/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Results</p>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredCities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleSelect(city.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/70 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span>{city.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {isOpen && searchQuery.trim() && filteredCities.length === 0 && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-2xl shadow-black/30 z-50 p-4 text-center text-sm text-muted-foreground">
              No cities found for "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Time</p>
          <p className="text-sm font-semibold text-foreground">{format(new Date(), 'MMM dd, yyyy • HH:mm')}</p>
        </div>

        <div className="h-8 w-px bg-border/50 hidden sm:block"></div>

        <button 
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-sm font-semibold rounded-full border border-border/50 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none group"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin text-primary' : 'text-muted-foreground group-hover:text-primary transition-colors'}`} />
          <span className="hidden sm:inline">{refreshMutation.isPending ? 'Syncing...' : 'Sync Data'}</span>
        </button>
        
        {/* PyTorch ML Engine Active Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary">
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">PyTorch ML Active</span>
        </div>

        <ThemeToggle />

        {/* ─── REAL-TIME NOTIFICATION BELL POPOVER ─── */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 relative text-muted-foreground hover:text-foreground transition-colors bg-secondary/30 rounded-full hover:bg-secondary active:scale-95"
            title="Climate Alerts & Notifications"
          >
            <Bell className="w-5 h-5 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white shadow-md ring-2 ring-background animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute right-0 mt-3 w-80 sm:w-96 bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
              >
                {/* Popover Header */}
                <div className="p-4 border-b border-border/50 flex items-center justify-between bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-sm text-foreground">Climate Alerts</h3>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-extrabold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                        {unreadCount} NEW
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Read All
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-border/30 custom-scrollbar">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`p-4 transition-colors cursor-pointer flex items-start gap-3.5 hover:bg-secondary/60 ${!n.read ? 'bg-primary/5' : ''}`}
                    >
                      <div className="p-2 rounded-xl bg-card border border-border/60 shadow-sm shrink-0 mt-0.5">
                        {n.type === "heat" && <Flame className="w-4 h-4 text-red-500" />}
                        {n.type === "rain" && <CloudRain className="w-4 h-4 text-blue-400" />}
                        {n.type === "exhaust" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        {n.type === "system" && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className={`text-xs font-bold truncate ${!n.read ? 'text-foreground font-extrabold' : 'text-muted-foreground'}`}>
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-muted-foreground shrink-0">{n.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {n.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Popover Footer */}
                <div className="p-3 border-t border-border/50 bg-secondary/20 text-center">
                  <button 
                    onClick={() => { setIsNotifOpen(false); navigate("/advisor"); }}
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open AI Climate Advisor <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
