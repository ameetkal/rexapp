'use client';

import { useState, useRef } from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/outline';

interface VoicePlayerProps {
  url: string;
  duration: number;
}

export default function VoicePlayer({ url, duration }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling to parent (thing modal)
    
    if (!audioRef.current) {
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        console.error('Error playing audio');
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }

    setIsPlaying(!isPlaying);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className="flex items-center space-x-3 p-3 bg-gray-100 rounded-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={playAudio}
        className="flex-shrink-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
      >
        {isPlaying ? (
          <PauseIcon className="h-5 w-5" />
        ) : (
          <PlayIcon className="h-5 w-5 ml-0.5" />
        )}
      </button>

      {/* Progress Bar */}
      <div className="flex-1">
        <div className="relative h-2 bg-gray-300 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-blue-600 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Time Display */}
      <div className="flex-shrink-0 text-sm text-gray-600 font-mono">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
}

