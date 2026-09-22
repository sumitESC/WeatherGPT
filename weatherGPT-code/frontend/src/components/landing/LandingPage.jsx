import { useState } from 'react';
import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import MetricsSection from './MetricsSection';
import WhatsAppCard from './WhatsAppCard';
import LandingFooter from './LandingFooter';
import FeedbackModal from './FeedbackModal';

export default function LandingPage({ onLaunchChat, onOpenVoiceMode }) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const whatsappShareUrl = `https://wa.me/9125600020?text=${encodeURIComponent(
    'Hi WeatherGPT! I want to check real-time weather forecasts, early warnings, and agricultural advisories.'
  )}`;

  const linkedinUrl = 'https://www.linkedin.com/in/sumit-kushwaha-5a9339327/';

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-950 selection:text-white flex flex-col relative overflow-x-hidden">
      
      {/* LANDING PAGE SECTIONS */}
      <main className="flex-1 flex flex-col">
        <HeroSection 
          onOpenAssistant={onLaunchChat} 
          onOpenVoice={onOpenVoiceMode}
          whatsappUrl={whatsappShareUrl}
        />

        <FeaturesSection />

        <MetricsSection />

        <WhatsAppCard whatsappUrl={whatsappShareUrl} />
      </main>

      {/* FOOTER */}
      <LandingFooter 
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        whatsappUrl={whatsappShareUrl}
        linkedinUrl={linkedinUrl}
      />

      {/* Feedback Dialog */}
      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />

    </div>
  );
}


