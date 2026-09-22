import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { WiDaySunny, WiNightClear } from "react-icons/wi";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-full bg-secondary/30 text-muted-foreground w-9 h-9" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 relative rounded-full bg-secondary/30 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-300 group"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="relative w-5 h-5 overflow-hidden">
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            isDark
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 rotate-90 scale-50"
          }`}
        >
          <WiNightClear className="w-5 h-5 text-indigo-300 group-hover:text-indigo-200" />
        </div>
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            isDark
              ? "opacity-0 -rotate-90 scale-50"
              : "opacity-100 rotate-0 scale-100"
          }`}
        >
          <WiDaySunny className="w-6 h-6 text-amber-400 group-hover:text-amber-300" />
        </div>
      </div>
    </button>
  );
}
