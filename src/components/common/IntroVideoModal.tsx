import React, { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, RefreshCw, ShoppingBag } from 'lucide-react';

interface IntroVideoModalProps {
  onFinish: () => void;
}

export const IntroVideoModal: React.FC<IntroVideoModalProps> = ({ onFinish }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Attempt to start video with original sound
    video.muted = false;
    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setNeedsUserInteraction(false);
        })
        .catch(() => {
          // Browser requires user gesture for unmuted audio: display Royal Play prompt
          setNeedsUserInteraction(true);
        });
    }
  }, []);

  const handleStartPlayWithSound = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = false;
      setIsMuted(false);
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setNeedsUserInteraction(false);
        })
        .catch((err) => {
          console.warn('[IntroVideo] Play error:', err);
          // If still blocked, fallback to muted autoplay
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().then(() => {
              setIsPlaying(true);
              setNeedsUserInteraction(false);
            }).catch(() => setVideoError(true));
          }
        });
    }
  };

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleComplete = () => {
    try {
      sessionStorage.setItem('magizh_intro_shown', 'true');
    } catch {}
    onFinish();
  };

  const handleRetryVideo = () => {
    setVideoError(false);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => setNeedsUserInteraction(true));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden select-none"
      onClick={() => {
        if (needsUserInteraction) handleStartPlayWithSound();
      }}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-black z-0" />

      {/* Video Container - Full responsive screen, maintaining strict aspect ratio */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {!videoError ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              src="/magizh_intro.mp4"
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              preload="auto"
              onEnded={handleComplete}
              onError={() => setVideoError(true)}
              className="w-full h-full object-contain bg-black max-h-screen"
            />

            {/* Sound Toggle (Only Sound Control - Zero Bypass or Close buttons) */}
            {isPlaying && (
              <button
                type="button"
                onClick={handleToggleSound}
                className="absolute top-4 right-4 z-30 p-2 sm:px-3 sm:py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 shadow-lg"
                aria-label="Sound Toggle"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] text-amber-200 font-bold">Unmute Audio</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-[11px] text-emerald-200 font-bold">Audio On</span>
                  </>
                )}
              </button>
            )}

            {/* Tap to Play with Sound Overlay (Browser Autoplay Policy fallback) */}
            {needsUserInteraction && (
              <div className="absolute inset-0 z-40 bg-black/85 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                <img
                  src="/magizh_logo.jpg"
                  alt="Magizh Logo"
                  className="w-24 h-24 sm:w-32 sm:h-32 object-contain mb-4 rounded-2xl shadow-xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={handleStartPlayWithSound}
                  className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-full font-black text-sm sm:text-base shadow-2xl border border-emerald-400/40 flex items-center gap-2 transform active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>வீடியோவைத் தொடங்க கிளிக் செய்யவும் / Play</span>
                </button>
                <p className="text-xs text-cream-300 mt-3 font-medium">
                  மகிழ் குழுமத்தின் அறிமுக வீடியோவை முழுமையாகக் கண்டு மகிழுங்கள்
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Safe Brand Fallback Screen if network video cannot load */
          <div className="text-center p-6 max-w-md w-full space-y-4 animate-in fade-in">
            <img
              src="/magizh_logo.jpg"
              alt="Magizh Logo"
              className="w-28 h-28 mx-auto object-contain rounded-2xl shadow-2xl"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">MAGIZH SHOPPING</h2>
              <p className="text-xs text-amber-300 font-medium">பாரம்பரிய சுவை &bull; இயற்கை நலம் &bull; B5 நாணய வெகுமதி</p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRetryVideo}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Video / மீண்டும் முயற்சிக்கவும்</span>
              </button>
              <button
                type="button"
                onClick={handleComplete}
                className="w-full sm:w-auto px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-neutral-700 shadow-lg"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <span>Continue to Store / கடைக்குச் செல்லவும்</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
