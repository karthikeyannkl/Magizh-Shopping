import React, { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, X, Sparkles, ChevronRight } from 'lucide-react';

interface IntroVideoModalProps {
  onFinish: () => void;
}

export const IntroVideoModal: React.FC<IntroVideoModalProps> = ({ onFinish }) => {
  const [secondsLeft, setSecondsLeft] = useState(7);
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 7-second countdown timer with auto-finish
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Hard fallback timeout: close in 8 seconds under any circumstance
    const timeout = setTimeout(() => {
      handleComplete();
    }, 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const handleComplete = () => {
    try {
      sessionStorage.setItem('magizh_intro_shown', 'true');
    } catch {}
    onFinish();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden animate-in fade-in duration-500 select-none">
      {/* Background Ambience / Shimmer Glow */}
      <div className="absolute inset-0 z-0 bg-radial from-amber-900/40 via-black to-black" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-magizh-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Skip Button Top Right */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = !isMuted;
              setIsMuted(!isMuted);
            }
          }}
          className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5"
          aria-label="Toggle Sound"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-gray-300" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
          <span className="hidden sm:inline text-[11px]">{isMuted ? 'Muted' : 'Sound On'}</span>
        </button>

        <button
          type="button"
          onClick={handleComplete}
          className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs shadow-lg backdrop-blur-md border border-amber-400/40 transition-all flex items-center gap-1 group"
        >
          <span>Skip ({secondsLeft}s)</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Main Content: Video with Graceful Royal Logo Fallback */}
      <div className="relative z-10 max-w-2xl w-full mx-4 text-center space-y-6">
        {!videoError ? (
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-500/30 bg-black aspect-video max-h-[70vh] mx-auto flex items-center justify-center">
            <video
              ref={videoRef}
              src="/videos/magizh-intro.mp4"
              autoPlay
              playsInline
              muted={isMuted}
              onError={() => setVideoError(true)}
              onEnded={handleComplete}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          /* Royal Brand Reveal Animation Fallback */
          <div className="p-8 sm:p-12 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-darkbrown-950 via-black to-black shadow-2xl space-y-6 animate-in zoom-in-95 duration-700">
            {/* Animated Royal Emblem */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-500 animate-spin duration-3000 opacity-70 blur-md" />
              <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-magizh-900 via-magizh-800 to-black border-2 border-amber-400/80 flex items-center justify-center shadow-2xl">
                <span className="text-4xl sm:text-5xl font-black bg-gradient-to-b from-amber-200 via-amber-400 to-yellow-600 bg-clip-text text-transparent">
                  M
                </span>
              </div>
            </div>

            {/* Brand Title with Gold Sheen */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>MAGIZH GROUPS PRESENTATION</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                MAGIZH SHOPPING
              </h1>
              <p className="text-sm sm:text-base font-bold text-amber-200 font-sans">
                பாரம்பரிய சுவை &bull; இயற்கை நலம் &bull; B5 நாணய வெகுமதி
              </p>
              <p className="text-xs text-cream-200 max-w-md mx-auto leading-relaxed pt-1">
                Authentic Native Millets, Cold-Pressed Wood Oils, Stone-Pounded Podis &amp; Seamless Partner Store Rewards.
              </p>
            </div>

            {/* Enter Store Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleComplete}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-darkbrown-950 font-black text-sm rounded-2xl shadow-xl transition-all hover:scale-105"
              >
                Enter Magizh Shopping &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar Indicator */}
        <div className="w-48 sm:w-64 h-1.5 bg-white/20 rounded-full mx-auto overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-1000 ease-linear"
            style={{ width: `${((7 - secondsLeft) / 7) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
