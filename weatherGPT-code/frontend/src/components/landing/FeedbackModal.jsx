import { useState, useEffect, useRef } from 'react';
import { X, Send, Star, Mail, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../services/api';

export default function FeedbackModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('General Feedback');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [hpField, setHpField] = useState(''); // Honeypot anti-spam field
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('iamkussumit@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (hpField.trim() !== '') {
      setIsSubmitted(true);
      setTimeout(onClose, 1000);
      return;
    }

    setIsSubmitting(true);

    const feedbackPayload = {
      recipient: 'iamkussumit@gmail.com',
      name: name || 'Anonymous User',
      email: email || 'not-provided@weathergpt.ai',
      category,
      rating,
      message,
      submittedAt: new Date().toISOString()
    };

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || "cff8fb81-d026-4b2d-8332-f04d65930553",
          subject: `WeatherGPT Feedback [${category}] - ${rating}/5 Stars`,
          from_name: name || "WeatherGPT User",
          replyto: email || undefined,
          name: name || "Anonymous User",
          email: email || "not-provided@weathergpt.ai",
          category: category,
          rating: `${rating} / 5 Stars`,
          message: message,
        })
      });
      const data = await res.json();
      if (!data.success) {
        console.warn("Web3Forms response:", data);
      }
    } catch (err) {
      console.warn("Web3Forms submission error:", err);
    }

    try {
      await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackPayload)
      });
    } catch (err) {
      console.warn("Backend feedback notice:", err);
    }

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setName('');
    setEmail('');
    setMessage('');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="relative w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-2xl text-zinc-900"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          aria-label="Close feedback dialog"
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-950 rounded-full hover:bg-zinc-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 bg-zinc-950 text-white rounded-full flex items-center justify-center mx-auto border border-zinc-800 shadow-md">
              <CheckCircle className="w-8 h-8 text-white stroke-[2]" />
            </div>
            <h3 className="text-2xl font-extrabold text-zinc-950">Feedback Sent!</h3>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-sm mx-auto leading-relaxed">
              Your feedback has been sent directly to <span className="font-semibold text-zinc-950">iamkussumit@gmail.com</span> inbox.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                onClick={handleCopyEmail}
                className="w-full sm:w-auto px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-full text-xs font-semibold border border-zinc-200 transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-700" />
                <span>{copied ? 'Copied Email!' : 'Copy Email Address'}</span>
              </button>

              <button
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-6 py-2 bg-zinc-950 hover:bg-black text-white rounded-full text-xs font-bold transition shadow-md cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                <Mail className="w-4 h-4 text-zinc-900" />
                <span>Direct Feedback to Creator</span>
              </div>
              <h3 id="feedback-title" className="text-2xl font-extrabold text-zinc-950 tracking-tight">Share Your Experience</h3>
              <p className="text-xs text-zinc-500">
                Help us improve WeatherGPT. Messages go directly to <span className="text-zinc-950 font-medium">iamkussumit@gmail.com</span>.
              </p>
            </div>

            {/* Honeypot Anti-Spam Hidden Field */}
            <input 
              type="text" 
              name="hp_field" 
              value={hpField}
              onChange={(e) => setHpField(e.target.value)}
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Your Name</label>
                <input 
                  ref={firstInputRef}
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sumit Kushwaha"
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Your Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Feedback Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 transition cursor-pointer font-medium"
                >
                  <option value="General Feedback">General Feedback</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Bug Report">Bug Report</option>
                  <option value="Forecast Accuracy">Forecast Accuracy</option>
                  <option value="Voice & Accessibility">Voice & Accessibility</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Rating</label>
                <div className="flex items-center space-x-1 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} out of 5 stars`}
                      className="p-1 hover:scale-110 transition cursor-pointer"
                    >
                      <Star 
                        className={`w-5 h-5 ${
                          star <= rating 
                            ? 'text-zinc-950 fill-zinc-950' 
                            : 'text-zinc-300 fill-zinc-100'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Your Message <span className="text-zinc-400">*</span></label>
              <textarea 
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think of WeatherGPT or suggest a feature..."
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full py-3 px-4 bg-zinc-950 hover:bg-black text-white font-extrabold rounded-xl transition shadow-md disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer text-xs sm:text-sm"
            >
              <Send className="w-4 h-4 text-white" />
              <span>{isSubmitting ? 'Sending Feedback...' : 'Send Feedback'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

