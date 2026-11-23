import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface IntroVideoModalProps {
  onFinish: () => void;
}

export const IntroVideoModal: React.FC<IntroVideoModalProps> = ({ onFinish }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Attempt to start video automatically with original sound
    video.muted = false;
    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // Browser autoplay policy requires initial muted start:
          // Immediately autoplay muted so video plays automatically with ZERO user clicks
          video.muted = true;
          setIsMuted(true);
          video
            .play()
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              // If video playback is completely blocked by device/network, advance seamlessly to Homepage
              handleComplete();
            });
        });
    }
  }, []);

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleScreenTap = () => {
    // Tapping anywhere on the video seamlessly enables unmuted audio if muted
    if (videoRef.current && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const handleComplete = () => {
    try {
      sessionStorage.setItem('magizh_intro_shown', 'true');
    } catch {}
    onFinish();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden select-none"
      onClick={handleScreenTap}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-black z-0" />

      {/* Video Container - Full responsive screen, preserving strict original aspect ratio without cut/distortion */}
      <div className="relative z-10 w-full h-full flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src="/magizh_intro.mp4"
          autoPlay
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          preload="auto"
          onEnded={handleComplete}
          onError={handleComplete}
          className="w-full h-full object-contain bg-black max-h-screen"
        />

        {/* Minimalist Sound Toggle Pill */}
        {isPlaying && (
          <button
            type="button"
            onClick={handleToggleSound}
            className="absolute top-4 right-4 z-30 p-2 sm:px-3 sm:py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"
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
      </div>
    </div>
  );
};
