import React, { useState, useRef, useEffect } from 'react';
import { Play, Download, ChevronRight, Loader2, RotateCcw, Share2, Pause, Globe, Trash2, Volume2, RotateCw, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import { VoiceDropdown } from '../ui/VoiceDropdown';
import { motion, AnimatePresence } from 'framer-motion';
import { ShaderAvatar } from '../ui/ShaderAvatar';
import { useGenerate } from '@/hooks/useGenerate';
import { useVoices } from '@/hooks/useVoices';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useNotifications } from '@/contexts/NotificationContext';
import { validateTTSText, sanitizeText } from '@/lib/validation';

interface TextToSpeechProps {
    onNavigate?: (view: string) => void;
    isMobile?: boolean;
}

interface HistoryItem {
    id: string;
    text: string;
    voiceName: string;
    duration: string;
    timestamp: string;
    audioUrl?: string;
}

// LocalStorage key for history
const HISTORY_STORAGE_KEY = 'tts_history';

// Load history from localStorage
const loadHistory = (): HistoryItem[] => {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

// Save history to localStorage
const saveHistory = (history: HistoryItem[]) => {
    if (typeof window === 'undefined') return;
    try {
        // Keep only last 50 items
        const trimmed = history.slice(0, 50);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
        // Storage might be full
    }
};

// Persist TTS text in sessionStorage so it survives view switches
const TTS_TEXT_KEY = 'tts_draft_text';
const loadDraftText = () => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(TTS_TEXT_KEY) || '';
};

export const TextToSpeech: React.FC<TextToSpeechProps> = ({ onNavigate, isMobile = false }) => {
    const [text, setText] = useState(loadDraftText);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Persist text to sessionStorage on change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(TTS_TEXT_KEY, text);
        }
    }, [text]);

    // Right Sidebar Tabs
    const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
    const [historySearch, setHistorySearch] = useState('');

    // History State - persisted to localStorage
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // Load history on mount
    useEffect(() => {
        setHistory(loadHistory());
    }, []);

    // Save history when it changes
    useEffect(() => {
        if (history.length > 0) {
            saveHistory(history);
        }
    }, [history]);

    // Fetch real voices from API
    const { voices: apiVoices, isLoading: voicesLoading } = useVoices();

    // Get user profile for real credits
    const { profile, isLoading: profileLoading } = useUserProfile();

    // Settings State
    const [currentVoice, setCurrentVoice] = useState<any>(null);

    // Set first voice from API as default
    useEffect(() => {
        if (apiVoices && apiVoices.length > 0 && !currentVoice) {
            const firstVoice = apiVoices[0];
            setCurrentVoice({
                id: firstVoice.id,
                name: firstVoice.name,
                category: firstVoice.category || 'General',
                tags: firstVoice.tags || [firstVoice.accent, firstVoice.gender].filter(Boolean),
                gradient: 'from-purple-400 to-indigo-500',
                shader: 'midnight'
            });
        }
    }, [apiVoices, currentVoice]);

    const [speed, setSpeed] = useState(1.0);
    const [stability, setStability] = useState(50);
    const [similarity, setSimilarity] = useState(75);
    const [style, setStyle] = useState(0);
    const [speakerBoost, setSpeakerBoost] = useState(true);

    // Language Override
    const [langOverride, setLangOverride] = useState(false);
    const [selectedLang, setSelectedLang] = useState('Auto (Recommended)');

    // Player State
    const [currentTrack, setCurrentTrack] = useState<HistoryItem | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(80);

    // Use the real API hook
    const { generate } = useGenerate();

    // Toast notifications
    const { showToast } = useNotifications();

    // Audio element ref for real playback
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Setup audio element listeners
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }

        const audio = audioRef.current;

        const onTimeUpdate = () => {
            if (audio.duration && !isNaN(audio.duration)) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };

        const onLoadedMetadata = () => {
            if (audio.duration && !isNaN(audio.duration)) {
                setDuration(audio.duration);
            }
        };

        const onEnded = () => {
            setIsPlaying(false);
            setProgress(0);
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    // Update volume when it changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume / 100;
        }
    }, [volume]);

    const handleGenerate = async () => {
        // Validate input
        const validation = validateTTSText(text);
        if (!validation.isValid) {
            showToast(validation.error || 'Invalid input', 'error');
            return;
        }

        if (!currentVoice?.id) {
            showToast('Please select a voice first', 'warning');
            return;
        }

        setIsGenerating(true);
        showToast('Generating audio...', 'info', 2000);

        try {
            const result = await generate({
                text: validation.sanitized,
                voiceId: currentVoice.id,
                voiceName: currentVoice.name,
                settings: {
                    stability: stability / 100,
                    similarity: similarity / 100,
                    style: style / 100,
                    speed,
                    useSpeakerBoost: speakerBoost,
                },
            });

            if (result?.success && result.result?.audioUrl) {
                const newItem: HistoryItem = {
                    id: result.taskId || Date.now().toString(),
                    text: validation.sanitized.length > 80 ? validation.sanitized.substring(0, 80) + "..." : validation.sanitized,
                    voiceName: currentVoice.name,
                    duration: "0:05",
                    timestamp: "Just now",
                    audioUrl: result.result.audioUrl,
                };
                setHistory(prev => [newItem, ...prev]);

                // Auto play result
                setCurrentTrack(newItem);
                setIsPlaying(true);
                setProgress(0);

                if (audioRef.current && newItem.audioUrl) {
                    audioRef.current.src = newItem.audioUrl;
                    audioRef.current.play().catch(() => {});
                }

                showToast('Audio generated successfully!', 'success');

                // Trigger profile refetch across all components (sidebar, etc.)
                window.dispatchEvent(new Event('credits-updated'));

                // Contextual upgrade nudge — show when remaining credits get low
                const creditsLeft = (profile?.remainingCredits ?? 50000) - validation.sanitized.length;
                const totalCredits = profile?.totalCredits ?? 1;
                const isOnFreePlan = !profile?.plan || profile.plan === 'free';
                if (creditsLeft > 0 && creditsLeft / totalCredits < 0.25 && isOnFreePlan) {
                  setTimeout(() => {
                    showToast(`${creditsLeft.toLocaleString()} credits left — upgrade for 30x more!`, 'warning', 5000);
                  }, 3000);
                }
            } else {
                showToast('Generation failed. Please try again.', 'error');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Generation failed. Please try again.';
            showToast(msg, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleReset = () => {
        setSpeed(1.0);
        setStability(50);
        setSimilarity(75);
        setStyle(0);
        setSpeakerBoost(true);
        setLangOverride(false);
    };

    const handlePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
        }
    };

    const handleSeek = (newProgress: number) => {
        if (!audioRef.current || !duration) return;
        const newTime = (newProgress / 100) * duration;
        audioRef.current.currentTime = newTime;
        setProgress(newProgress);
    };

    const handleSkip = (seconds: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    };

    const handleHistoryItemClick = (item: HistoryItem) => {
        setCurrentTrack(item);
        setProgress(0);
        setIsPlaying(true);

        if (audioRef.current && item.audioUrl) {
            audioRef.current.src = item.audioUrl;
            audioRef.current.play().catch(() => {});
        }

        // Close the bottom sheet on mobile so the mini player is visible
        if (isMobile) {
            setShowMobileSettings(false);
        }
    };

    const handleDownloadItem = async (item: HistoryItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!item.audioUrl) {
            showToast('No audio available for download', 'error');
            return;
        }

        try {
            showToast('Starting download...', 'info', 2000);
            const response = await fetch(item.audioUrl);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${item.voiceName.replace(/\s+/g, '-').toLowerCase()}-audio.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Download complete!', 'success');
        } catch {
            try {
                const link = document.createElement('a');
                link.href = item.audioUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('Opening audio — long-press to save', 'info', 4000);
            } catch {
                showToast('Download failed. Please try again.', 'error');
            }
        }
    };

    const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setHistory(prev => prev.filter(h => h.id !== id));
        if (currentTrack?.id === id) {
            setCurrentTrack(null);
            setIsPlaying(false);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        }
    };

    const handleShare = () => {
        if (currentTrack?.audioUrl) {
            navigator.clipboard.writeText(currentTrack.audioUrl);
            showToast('Audio URL copied to clipboard!', 'success');
        }
    };

    const handleDownload = async () => {
        if (!currentTrack?.audioUrl) return;

        try {
            showToast('Starting download...', 'info', 2000);
            const response = await fetch(currentTrack.audioUrl);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentTrack.voiceName.replace(/\s+/g, '-').toLowerCase()}-audio.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Download complete!', 'success');
        } catch {
            try {
                const link = document.createElement('a');
                link.href = currentTrack.audioUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('Opening audio — use long-press or right-click to save', 'info', 4000);
            } catch {
                showToast('Download failed. Please try again.', 'error');
            }
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate credits display
    const creditsRemaining = profile?.remainingCredits ?? 50000;
    const formattedCredits = creditsRemaining.toLocaleString();

    // Settings Panel Content - rendered as function call (NOT <Component />) to avoid remount on parent re-render
    const settingsContent = () => (
        <div className={`space-y-6 ${isMobile ? 'p-4' : 'p-8 space-y-8'}`}>
            {/* Voice Selector */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Voice</label>
                    {voicesLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                </div>
                <VoiceDropdown
                    currentVoiceId={currentVoice?.id || ''}
                    currentVoice={currentVoice}
                    onSelect={setCurrentVoice}
                    onNavigateToLibrary={() => onNavigate?.('library')}
                />
            </div>

            {/* Model Selector (Static) */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Model</label>
                <div className={`w-full border border-gray-200 rounded-2xl flex items-center justify-between hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all bg-white group ${isMobile ? 'p-3' : 'p-3.5'}`}>
                    <div className="flex items-center gap-3">
                        <div className="px-2 py-1 rounded bg-gray-100 border border-gray-200 text-[10px] font-bold group-hover:bg-gray-200 transition-colors">V2</div>
                        <span className="text-sm font-semibold text-gray-900">Decible Multilingual V1</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
            </div>

            {/* Settings Sliders */}
            <div className={`space-y-5 ${isMobile ? '' : 'pt-2'}`}>
                <Slider
                    label="Speed"
                    value={speed}
                    onChange={setSpeed}
                    min={0.7}
                    max={1.2}
                    step={0.01}
                    leftLabel="Slower"
                    rightLabel="Faster"
                    valueFormatter={(val) => `${val.toFixed(2)}x`}
                />

                <Slider
                    label="Stability"
                    value={stability}
                    onChange={setStability}
                    min={0}
                    max={100}
                    step={0.1}
                    leftLabel="More variable"
                    rightLabel="More stable"
                />

                <Slider
                    label="Similarity"
                    value={similarity}
                    onChange={setSimilarity}
                    min={0}
                    max={100}
                    step={0.1}
                    leftLabel="Low"
                    rightLabel="High"
                />

                <Slider
                    label="Style Exaggeration"
                    value={style}
                    onChange={setStyle}
                    min={0}
                    max={100}
                    step={0.1}
                    leftLabel="None"
                    rightLabel="Exaggerated"
                />
            </div>

            {/* Speech Pronunciation Section */}
            <div className="pt-4 border-t border-gray-100">
                <Toggle
                    label="Speech Pronunciation"
                    checked={langOverride}
                    onChange={setLangOverride}
                />

                <AnimatePresence>
                    {langOverride && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="relative mt-3">
                                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    value={selectedLang}
                                    onChange={(e) => setSelectedLang(e.target.value)}
                                    className={`w-full pl-10 pr-4 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-1 focus:ring-black/20 text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors cursor-pointer ${isMobile ? 'py-3.5' : 'py-3'}`}
                                >
                                    <option>Auto (Recommended)</option>
                                    <option>English</option>
                                    <option>Hindi</option>
                                    <option>Spanish</option>
                                    <option>French</option>
                                    <option>German</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className={`pt-4 border-t border-gray-100 ${isMobile ? 'pb-8' : 'pb-24'}`}>
                <Toggle
                    label="Speaker boost"
                    checked={speakerBoost}
                    onChange={setSpeakerBoost}
                />
                <div className="flex justify-center mt-6">
                    <button
                        onClick={handleReset}
                        className={`flex items-center gap-2 rounded-lg text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-50 transition-all ${isMobile ? 'px-4 py-3' : 'px-4 py-2'}`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset to defaults
                    </button>
                </div>
            </div>
        </div>
    );

    // Filter history by search query
    const filteredHistory = historySearch.trim()
        ? history.filter(item =>
            item.text.toLowerCase().includes(historySearch.toLowerCase()) ||
            item.voiceName.toLowerCase().includes(historySearch.toLowerCase())
        )
        : history;

    // History Panel Content - rendered as function call (NOT <Component />) to avoid remount on parent re-render
    const historyContent = () => (
        <div className="flex flex-col h-full">
            <div className={`border-b border-gray-100 sticky top-0 bg-white z-10 ${isMobile ? 'p-3' : 'p-4'}`}>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search history..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className={`w-full pl-3 pr-4 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 transition-colors ${isMobile ? 'py-3' : 'py-2'}`}
                    />
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto space-y-2 ${isMobile ? 'p-3' : 'p-4 space-y-3'}`}>
                {filteredHistory.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        <p className="font-medium">{historySearch ? 'No matches found' : 'No history yet'}</p>
                        <p className="text-sm mt-1">{historySearch ? 'Try a different search term' : 'Generated audio will appear here'}</p>
                    </div>
                ) : (
                    filteredHistory.map((item) => (
                        <div
                            key={item.id}
                            className={`group flex flex-col gap-2 rounded-xl cursor-pointer transition-all border ${isMobile ? 'p-3' : 'p-3'} ${currentTrack?.id === item.id ? 'bg-gray-50 border-gray-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-gray-50/50 active:bg-gray-50'}`}
                            onClick={() => handleHistoryItemClick(item)}
                        >
                            <div className="flex items-start gap-2">
                                {/* Play indicator for active track */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${currentTrack?.id === item.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    {currentTrack?.id === item.id && isPlaying ? (
                                        <Pause className="w-3.5 h-3.5 fill-current" />
                                    ) : (
                                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-800 leading-relaxed font-medium line-clamp-2">
                                        {item.text}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                        <span className="font-semibold text-gray-600">{item.voiceName}</span>
                                        <span className="text-gray-300">·</span>
                                        <span>{item.timestamp}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-1 -mt-1">
                                {item.audioUrl && (
                                    <button
                                        onClick={(e) => handleDownloadItem(item, e)}
                                        className="p-2 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                                        title="Download"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                                    className="p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-full bg-white overflow-hidden relative">
            <div className="flex-1 flex w-full h-full">
                {/* Main Content Area (Editor) */}
                <div className={`flex-1 flex flex-col relative min-w-0 bg-[#F9FAFB] ${isMobile ? '' : ''}`}>
                    {/* Scrollable Canvas */}
                    <div className={`flex-1 overflow-y-auto relative scroll-smooth ${isMobile ? 'p-4 pb-40' : 'p-6 pb-48'}`}>
                        <div className="max-w-6xl mx-auto flex flex-col h-full">
                            {/* Paper Editor Card */}
                            <div
                                className={`bg-white shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100 flex-1 relative group focus-within:ring-1 focus-within:ring-black/5 focus-within:border-gray-300 transition-all cursor-text flex flex-col ${isMobile ? 'rounded-2xl p-4 min-h-[300px]' : 'rounded-3xl p-10 min-h-[500px]'}`}
                                onClick={() => textareaRef.current?.focus()}
                            >
                                <textarea
                                    ref={textareaRef}
                                    className={`w-full flex-1 leading-relaxed resize-none focus:outline-none font-light placeholder:text-gray-300 bg-transparent text-gray-900 selection:bg-gray-100 ${isMobile ? 'text-lg' : 'text-2xl'}`}
                                    placeholder="Start typing here or paste any text..."
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    spellCheck={false}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Floating Generate Button - Mobile Optimized */}
                    <div className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-auto transition-all duration-500 ${isMobile ? (currentTrack ? 'bottom-24' : 'bottom-4') : (currentTrack ? 'bottom-32' : 'bottom-12')}`}>
                        <div className={`bg-white/95 backdrop-blur-xl rounded-full border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-2 transition-transform ${isMobile ? 'p-1 px-1.5' : 'p-1.5 px-2 hover:scale-[1.01]'}`}>
                            {/* Settings Toggle - Mobile Only */}
                            {isMobile && (
                                <button
                                    onClick={() => setShowMobileSettings(true)}
                                    className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
                                >
                                    <SlidersHorizontal className="w-5 h-5" />
                                </button>
                            )}

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={!text.trim() || isGenerating}
                                className={`flex items-center justify-center rounded-full font-bold transition-all duration-300 ${isMobile ? 'px-6 py-3 text-sm' : 'px-8 py-2.5 text-sm'} ${!text.trim()
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-black text-white hover:bg-gray-800 shadow-md active:scale-95'
                                }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        {isMobile ? 'Wait...' : 'Generating...'}
                                    </>
                                ) : (
                                    <span>Generate</span>
                                )}
                            </button>

                            {/* Char Count */}
                            <div className={`flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-50 rounded-full ${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
                                {text.length.toLocaleString()} / 5,000
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Settings/History Sidebar - Desktop Only */}
                {!isMobile && (
                    <div className="w-[440px] bg-white border-l border-gray-100 flex flex-col shrink-0 z-20 shadow-[-4px_0_20px_rgba(0,0,0,0.01)]">
                        {/* Sidebar Tabs */}
                        <div className="flex items-center border-b border-gray-100 px-8 pt-6 bg-white sticky top-0 z-10">
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={`pb-4 text-sm font-bold mr-8 transition-colors border-b-2 ${activeTab === 'settings' ? 'text-black border-black' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                            >
                                Settings
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`pb-4 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'history' ? 'text-black border-black' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                            >
                                History
                                {history.length > 0 && (
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{history.length}</span>
                                )}
                            </button>
                        </div>

                    {/* CONTENT AREA */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                        {activeTab === 'settings' && settingsContent()}
                        {activeTab === 'history' && historyContent()}
                    </div>
                </div>
                )}
            </div>

            {/* Mobile Bottom Sheet for Settings/History */}
            <AnimatePresence>
                {isMobile && showMobileSettings && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-[60]"
                            onClick={() => setShowMobileSettings(false)}
                        />
                        {/* Bottom Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[60] flex flex-col shadow-2xl"
                            style={{ maxHeight: '90vh' }}
                        >
                            {/* Handle + Close */}
                            <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
                                <div className="w-8" />
                                <div className="w-10 h-1 bg-gray-300 rounded-full" />
                                <button
                                    onClick={() => setShowMobileSettings(false)}
                                    className="w-8 h-8 flex items-center justify-center text-gray-400 active:bg-gray-100 rounded-full"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Tabs */}
                            <div className="flex items-center border-b border-gray-100 px-4 shrink-0">
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`flex-1 pb-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'settings' ? 'text-black border-black' : 'text-gray-400 border-transparent'}`}
                                >
                                    Settings
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`flex-1 pb-3 text-sm font-bold transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'history' ? 'text-black border-black' : 'text-gray-400 border-transparent'}`}
                                >
                                    History
                                    {history.length > 0 && (
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{history.length}</span>
                                    )}
                                </button>
                            </div>
                            {/* Content — scrollable */}
                            <div className="flex-1 overflow-y-auto overscroll-contain pb-8" style={{ minHeight: 0 }}>
                                {activeTab === 'settings' && settingsContent()}
                                {activeTab === 'history' && historyContent()}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* MOBILE MINI PLAYER - Shows generated audio controls on mobile */}
            {isMobile && (
                <AnimatePresence>
                    {currentTrack && (
                        <motion.div
                            initial={{ y: 80 }}
                            animate={{ y: 0 }}
                            exit={{ y: 80 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
                        >
                            {/* Progress bar */}
                            <div
                                className="w-full h-1 bg-gray-100 cursor-pointer"
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const pct = (e.clientX - rect.left) / rect.width;
                                    handleSeek(pct * 100);
                                }}
                            >
                                <div className="h-full bg-gray-900 rounded-r-full" style={{ width: `${progress}%` }} />
                            </div>

                            <div className="flex items-center gap-3 px-4 py-3">
                                {/* Track info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-gray-900 truncate">{currentTrack.text}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                        <span className="font-medium">{currentTrack.voiceName}</span>
                                        <span className="text-gray-300">·</span>
                                        <span className="font-mono">{formatTime((progress / 100) * duration)} / {formatTime(duration)}</span>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handlePlayPause}
                                        className="w-11 h-11 rounded-full bg-gray-900 text-white flex items-center justify-center active:scale-95 transition-transform"
                                    >
                                        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="w-10 h-10 flex items-center justify-center text-gray-500 active:bg-gray-100 rounded-xl"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCurrentTrack(null);
                                            setIsPlaying(false);
                                            if (audioRef.current) {
                                                audioRef.current.pause();
                                                audioRef.current.src = '';
                                            }
                                        }}
                                        className="w-10 h-10 flex items-center justify-center text-gray-400 active:bg-red-50 rounded-xl"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* FULL WIDTH STICKY MEDIA PLAYER - Desktop Only */}
            {!isMobile && (
                <AnimatePresence>
                    {currentTrack && (
                        <motion.div
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            exit={{ y: 100 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="absolute bottom-0 left-0 right-0 h-[84px] bg-white border-t border-gray-200 z-50 flex items-center shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"
                        >
                            <div className="w-full max-w-[1920px] mx-auto px-8 flex items-center justify-between gap-8">
                                {/* 1. Track Info (Left) */}
                                <div className="flex items-center gap-4 w-[280px] min-w-0">
                                    <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 border border-gray-100 shadow-sm ring-2 ring-white">
                                        <ShaderAvatar type="midnight" />
                                    </div>
                                    <div className="min-w-0 flex flex-col justify-center">
                                        <div className="font-bold text-sm text-gray-900 truncate">{currentTrack.text}</div>
                                        <div className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                                            {currentTrack.voiceName}
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            {currentTrack.timestamp}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Controls & Scrubber (Center) */}
                                <div className="flex-1 max-w-2xl flex flex-col items-center justify-center gap-1.5">
                                    {/* Playback Controls Row */}
                                    <div className="flex items-center gap-6">
                                        <button
                                            className="text-gray-400 hover:text-black transition-colors"
                                            onClick={() => handleSkip(-10)}
                                            title="-10s"
                                        >
                                            <div className="relative group">
                                                <RotateCcw className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                                                <span className="absolute -top-1 -right-2 text-[8px] font-bold">10</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={handlePlayPause}
                                            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/20"
                                        >
                                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                        </button>

                                        <button
                                            className="text-gray-400 hover:text-black transition-colors"
                                            onClick={() => handleSkip(10)}
                                            title="+10s"
                                        >
                                            <div className="relative group">
                                                <RotateCw className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                                                <span className="absolute -top-1 -right-2 text-[8px] font-bold">10</span>
                                            </div>
                                        </button>
                                    </div>

                                    {/* Scrubber Bar Row */}
                                    <div className="w-full flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-gray-400 w-8 text-right font-mono">
                                            {formatTime((progress / 100) * duration)}
                                        </span>
                                        <div className="flex-1 relative h-4 flex items-center group cursor-pointer">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={progress}
                                                onChange={(e) => handleSeek(Number(e.target.value))}
                                                className="absolute w-full h-full opacity-0 z-20 cursor-pointer"
                                            />
                                            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden relative">
                                                <motion.div
                                                    className="h-full bg-gray-900 rounded-full"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <motion.div
                                                className="absolute w-3 h-3 bg-black rounded-full shadow-md pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                style={{ left: `${progress}%`, marginLeft: '-6px' }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 w-8 font-mono">{formatTime(duration)}</span>
                                    </div>
                                </div>

                                {/* 3. Actions (Right) */}
                                <div className="flex items-center justify-end gap-1 w-[280px]">
                                    {/* Volume Control */}
                                    <div className="flex items-center gap-3 pr-6 border-r border-gray-100 mr-4 group">
                                        <Volume2 className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                                        <div className="w-20 h-4 relative flex items-center cursor-pointer">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={volume}
                                                onChange={(e) => setVolume(Number(e.target.value))}
                                                className="absolute w-full h-full opacity-0 z-10 cursor-pointer"
                                            />
                                            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-gray-300 group-hover:bg-gray-500 transition-colors rounded-full" style={{ width: `${volume}%` }}></div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleShare}
                                        className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-lg transition-all"
                                        title="Share"
                                    >
                                        <Share2 className="w-4.5 h-4.5" />
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-lg transition-all"
                                        title="Download"
                                    >
                                        <Download className="w-4.5 h-4.5" />
                                    </button>
                                    <button
                                        className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-lg transition-all ml-2"
                                        onClick={() => {
                                            setCurrentTrack(null);
                                            setIsPlaying(false);
                                            if (audioRef.current) {
                                                audioRef.current.pause();
                                                audioRef.current.src = '';
                                            }
                                        }}
                                        title="Close Player"
                                    >
                                        <ChevronDown className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};
