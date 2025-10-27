'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MicrophoneIcon, StopIcon, PlayIcon } from '@heroicons/react/24/outline';

interface VoiceRecordingProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export default function VoiceRecording({ onRecordingComplete, onCancel }: VoiceRecordingProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const MAX_DURATION = 30; // 30 seconds max

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const stopRecording = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          if (newTime >= MAX_DURATION) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, stopRecording]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setElapsedTime(0);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const playRecording = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.play();
      setIsPlaying(true);
    }
  };

  const stopPlayback = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleSend = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (audioBlob) {
      onRecordingComplete(audioBlob, elapsedTime);
    }
  };

  const handleRetry = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAudioBlob(null);
    setElapsedTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    onCancel();
  };

  return (
    <div className="space-y-4">
      {/* Recording Status */}
      {!audioBlob && (
        <div className="flex flex-col items-center space-y-4">
          {!isRecording ? (
            <>
              <button
                onClick={startRecording}
                className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <MicrophoneIcon className="h-10 w-10" />
              </button>
              <p className="text-sm text-gray-600">Tap to start recording (max 30s)</p>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-4">
                <button
                  onClick={stopRecording}
                  className="flex items-center justify-center w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <StopIcon className="h-10 w-10" />
                </button>
              </div>
              <div className="text-center">
                <p className="text-2xl font-mono text-blue-600">{formatTime(elapsedTime)}</p>
                <p className="text-sm text-gray-500">Recording...</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Playback Controls */}
      {audioBlob && (
        <div className="flex flex-col items-center space-y-4">
          {!isPlaying ? (
            <button
              onClick={playRecording}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              <PlayIcon className="h-10 w-10 ml-1" />
            </button>
          ) : (
            <button
              onClick={stopPlayback}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-colors"
            >
              <StopIcon className="h-10 w-10" />
            </button>
          )}
          <p className="text-sm text-gray-600">Duration: {formatTime(elapsedTime)}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={audioBlob ? handleRetry : handleCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {audioBlob ? 'Re-record' : 'Cancel'}
        </button>
        {audioBlob && (
          <button
            onClick={handleSend}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}

