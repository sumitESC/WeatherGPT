import laptopMockup from '../../assets/real_laptop_mockup.png';
import phoneMockup from '../../assets/real_smartphone_mockup.png';

export default function DeviceShowcase() {
  return (
    <section className="py-12 sm:py-20 px-3.5 sm:px-8 bg-zinc-950/80 border-y border-zinc-900 relative text-white">
      <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300">
            <span>Product Preview</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            WeatherGPT Interface Across All Devices
          </h2>
          <p className="text-xs sm:text-base text-zinc-400">
            Featuring our central voice orb visualizer, 4 quick-action starter cards, and bottom search bar designed for effortless interaction.
          </p>
        </div>

        {/* Photorealistic 3D Mockup Display Grid */}
        <div className="relative flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 pt-4">
          
          {/* LAPTOP MOCKUP */}
          <div className="w-full lg:w-3/5 group relative transform hover:-translate-y-1 transition duration-500">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <img 
                src={laptopMockup} 
                alt="Photorealistic Laptop Studio Mockup with WeatherGPT UI" 
                className="w-full h-auto object-cover rounded-2xl transition-transform duration-700 group-hover:scale-[1.02]" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>
            <div className="text-center mt-3 text-xs font-medium text-zinc-400">
              Desktop Workspace &mdash; Clean White Interface
            </div>
          </div>

          {/* SMARTPHONE VOICE ASSISTANT MOCKUP */}
          <div className="w-64 sm:w-72 lg:w-2/5 shrink-0 group relative transform hover:-translate-y-1 transition duration-500 self-center lg:self-end">
            <div className="relative overflow-hidden rounded-[2.5rem] p-2 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black border border-zinc-800 shadow-2xl ring-1 ring-white/10">
              {/* Dynamic Camera Island Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-20 flex items-center justify-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-zinc-900 border border-zinc-800" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              </div>
              <img 
                src={phoneMockup} 
                alt="WeatherGPT Voice Mode Screenshot on Smartphone" 
                className="w-full h-auto object-cover rounded-[2.1rem] transition-transform duration-700 group-hover:scale-[1.02]" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none rounded-[2.5rem]" />
            </div>
            <div className="text-center mt-3 text-xs font-semibold text-zinc-300 flex items-center justify-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Mobile Voice Assistant &mdash; Real Interface Preview</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

