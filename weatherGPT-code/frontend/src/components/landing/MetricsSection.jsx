export default function MetricsSection() {
  const stats = [
    { value: "< 400ms", label: "End-to-End Latency", subtext: "Optimized async network pipeline" },
    { value: "300+ t/s", label: "Groq LLM Throughput", subtext: "Groq LLaMA-3 120B LPPU execution" },
    { value: "26 Years", label: "ERA5 Climate Dataset", subtext: "2000–2026 historical atmospheric backfill" },
    { value: "500M+", label: "WhatsApp Reach", subtext: "Zero-install WhatsApp assistant" }
  ];

  return (
    <section className="py-12 sm:py-16 px-3 sm:px-8 bg-zinc-50 border-y border-zinc-200">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-center">
          {stats.map((st, idx) => (
            <div key={idx} className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-1.5">
              <div className="text-2xl sm:text-4xl font-black text-zinc-950 tracking-tight">
                {st.value}
              </div>
              <div className="text-xs sm:text-sm font-bold text-zinc-800">
                {st.label}
              </div>
              <div className="text-[10px] sm:text-[11px] text-zinc-500 font-medium leading-snug">
                {st.subtext}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

