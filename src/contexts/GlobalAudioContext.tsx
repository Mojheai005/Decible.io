import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { Voice } from '@/hooks/useVoices';

interface AudioContextType {
    currentVoice: Voice | null;
    isPlaying: boolean;
    isLoadingPreview: boolean;
    playVoice: (voice: Voice) => void;
    pauseVoice: () => void;
    togglePlay: () => void;
    clearVoice: () => void;
    audioRef: React.RefObject<HTMLAudioElement>;
    duration: number;
    currentTime: number;
    seek: (time: number) => void;
    volume: number;
    setVolume: (volume: number) => void;
    isMuted: boolean;
    toggleMute: () => void;
}

// Cache for generated preview URLs
const previewCache = new Map<string, string>();

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentVoice, setCurrentVoice] = useState<Voice | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolumeState] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playVoice = async (voice: Voice) => {
        if (currentVoice?.id === voice.id) {
            togglePlay();
            return;
        }

        // New voice
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        setCurrentTime(0);
        setDuration(0);

        // Check if voice has previewUrl or if we have it cached
        let previewUrl = voice.previewUrl || previewCache.get(voice.id);

        if (!previewUrl) {
            // Generate preview on-demand
            setIsLoadingPreview(true);
            setCurrentVoice({ ...voice, previewUrl: '' }); // Set voice immediately to show loading state

            try {
                const response = await fetch(`/api/voices/preview?voice_id=${voice.id}`);
                if (response.ok) {
                    const data = await response.json();
                    previewUrl = data.previewUrl;
                    if (previewUrl) {
                        previewCache.set(voice.id, previewUrl);
                    }
                }
            } catch (error) {
                console.error('Failed to generate preview:', error);
            }

            setIsLoadingPreview(false);

            if (!previewUrl) {
                console.error('No preview URL available for voice:', voice.id);
                return;
            }
        }

        // Update voice with preview URL and play
        setCurrentVoice({ ...voice, previewUrl });
        setIsPlaying(true);
    };

    const pauseVoice = () => {
        setIsPlaying(false);
        audioRef.current?.pause();
    };

    const togglePlay = () => {
        if (isPlaying) {
            pauseVoice();
        } else {
            setIsPlaying(true);
            audioRef.current?.play();
        }
    };

    const clearVoice = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current.currentTime = 0;
        }
        setCurrentVoice(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
    };

    const seek = (time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const setVolume = (newVolume: number) => {
        setVolumeState(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
        if (newVolume > 0 && isMuted) {
            setIsMuted(false);
            if (audioRef.current) {
                audioRef.current.muted = false;
            }
        }
    };

    const toggleMute = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        if (audioRef.current) {
            audioRef.current.muted = newMuted;
        }
    };

    return (
        <AudioContext.Provider value={{
            currentVoice,
            isPlaying,
            isLoadingPreview,
            playVoice,
            pauseVoice,
            togglePlay,
            clearVoice,
            audioRef,
            duration,
            currentTime,
            seek,
            volume,
            setVolume,
            isMuted,
            toggleMute
        }}>
            <GlobalAudioLogic
                currentVoice={currentVoice}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                setDuration={setDuration}
                setCurrentTime={setCurrentTime}
                audioRef={audioRef}
                volume={volume}
                isMuted={isMuted}
            />
            {children}
        </AudioContext.Provider>
    );
};

// Separated logic to keep Provider clean
const GlobalAudioLogic = ({
    currentVoice,
    isPlaying,
    setIsPlaying,
    setDuration,
    setCurrentTime,
    audioRef,
    volume,
    isMuted
}: {
    currentVoice: Voice | null;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    setDuration: (duration: number) => void;
    setCurrentTime: (time: number) => void;
    audioRef: React.MutableRefObject<HTMLAudioElement | null>;
    volume: number;
    isMuted: boolean;
}) => {

    // React to voice change
    React.useEffect(() => {
        if (currentVoice && currentVoice.previewUrl) {
            if (!audioRef.current) {
                audioRef.current = new Audio();
            }
            audioRef.current.src = currentVoice.previewUrl;
            audioRef.current.volume = volume;
            audioRef.current.muted = isMuted;
            audioRef.current.load();

            const attemptPlay = async () => {
                try {
                    await audioRef.current?.play();
                    setIsPlaying(true);
                } catch (err) {
                    console.error("Playback failed", err);
                    setIsPlaying(false);
                }
            };

            if (isPlaying) {
                attemptPlay();
            }
        }
    }, [currentVoice]);

    // Setup listeners
    React.useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => {
            if (audio.duration && !isNaN(audio.duration)) {
                setDuration(audio.duration);
            }
        };
        const onEnded = () => setIsPlaying(false);
        const onCanPlay = () => updateDuration();

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('durationchange', updateDuration);
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('durationchange', updateDuration);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('ended', onEnded);
        };
    }, [audioRef.current]);

    // React to play/pause toggle from state
    React.useEffect(() => {
        if (!audioRef.current) return;
        if (isPlaying && audioRef.current.paused) {
            audioRef.current.play().catch(e => console.error(e));
        } else if (!isPlaying && !audioRef.current.paused) {
            audioRef.current.pause();
        }
    }, [isPlaying]);

    return null;
}

export const useGlobalAudio = () => {
    const context = useContext(AudioContext);
    if (context === undefined) {
        throw new Error('useGlobalAudio must be used within an AudioProvider');
    }
    return context;
};
