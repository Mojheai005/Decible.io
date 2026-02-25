import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Play, Pause, Check, ChevronDown, Compass } from 'lucide-react';
import { ShaderAvatar, ShaderType } from './ShaderAvatar';
import { useVoices } from '@/hooks/useVoices';

interface Voice {
  id: string;
  name: string;
  category: string;
  tags: string[];
  previewUrl?: string;
  accent?: string;
  gender?: string;
}

interface VoiceDropdownProps {
  onSelect: (voice: Voice) => void;
  currentVoiceId: string;
  currentVoice: Voice | null;
  onNavigateToLibrary?: () => void;
}

const getShaderForVoice = (name: string): ShaderType => {
  const shaders: ShaderType[] = ['fluid', 'neon', 'chrome', 'orb', 'waves', 'midnight'];
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return shaders[hash % shaders.length];
};

type GenderFilter = 'all' | 'male' | 'female';

export const VoiceDropdown: React.FC<VoiceDropdownProps> = ({
  onSelect,
  currentVoiceId,
  currentVoice,
  onNavigateToLibrary
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { voices: apiVoices, isLoading } = useVoices();

  // Transform API voices to Voice type
  const allVoices: Voice[] = useMemo(() => {
    if (!apiVoices || apiVoices.length === 0) return [];
    return apiVoices.map((v: any) => ({
      id: v.id,
      name: v.name,
      category: v.category || 'General',
      tags: v.tags || [v.accent, v.gender].filter(Boolean),
      previewUrl: v.previewUrl,
      accent: v.accent,
      gender: v.gender,
    }));
  }, [apiVoices]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter voices by search + gender
  const filteredVoices = useMemo(() => {
    let filtered = allVoices;

    if (genderFilter !== 'all') {
      filtered = filtered.filter(v =>
        v.gender?.toLowerCase() === genderFilter
      );
    }

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(searchLower) ||
        v.category.toLowerCase().includes(searchLower) ||
        v.accent?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allVoices, debouncedSearch, genderFilter]);

  // Current display voice
  const displayVoice = useMemo(() => {
    if (currentVoiceId) {
      const found = allVoices.find(v => v.id === currentVoiceId);
      if (found) return found;
    }
    return null;
  }, [allVoices, currentVoiceId]);

  // Play preview
  const handlePlayPreview = useCallback((voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!voice.previewUrl) return;

    if (playingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setIsLoadingAudio(true);
    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;

    audio.oncanplaythrough = () => {
      setIsLoadingAudio(false);
      audio.play().catch(() => {
        setPlayingVoiceId(null);
        setIsLoadingAudio(false);
      });
    };
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => {
      setPlayingVoiceId(null);
      setIsLoadingAudio(false);
    };
    audio.load();
    setPlayingVoiceId(voice.id);
  }, [playingVoiceId]);

  // Select handler
  const handleSelect = useCallback((voice: Voice) => {
    onSelect(voice);
    setIsOpen(false);
  }, [onSelect]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Stop audio when dropdown closes
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setPlayingVoiceId(null);
    }
  }, [isOpen]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Reset filters when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setGenderFilter('all');
    }
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 border rounded-xl transition-all bg-white ${
          isOpen ? 'border-gray-400 shadow-sm' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm ring-2 ring-white">
            {displayVoice ? (
              <ShaderAvatar type={getShaderForVoice(displayVoice.name)} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
            )}
          </div>
          <div className="text-left">
            <div className="font-semibold text-gray-900 text-sm">
              {displayVoice?.name || 'Select a Voice'}
            </div>
            <div className="text-xs text-gray-500">
              {displayVoice ? `${displayVoice.category} • ${displayVoice.accent || displayVoice.gender || 'Voice'}` : 'Choose from our voice library'}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[99998]" onClick={() => setIsOpen(false)} />

          <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-[99999] overflow-hidden">
            {/* Header with search + filter */}
            <div className="p-3 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search voices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 focus:bg-white"
                />
              </div>
              {/* Gender filter tabs */}
              <div className="flex gap-1">
                {(['all', 'male', 'female'] as GenderFilter[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      genderFilter === g
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g === 'all' ? 'All' : g === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400 self-center">
                  {filteredVoices.length} voices
                </span>
              </div>
            </div>

            {/* Voice List */}
            <div className="max-h-[320px] overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-gray-400">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-sm">Loading voices...</span>
                </div>
              ) : filteredVoices.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Compass className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">No voices found</p>
                  <p className="text-xs text-gray-500 mt-1">Try a different search or filter</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredVoices.map((voice) => {
                    const isSelected = currentVoiceId === voice.id;
                    const isPlaying = playingVoiceId === voice.id;

                    return (
                      <div
                        key={voice.id}
                        onClick={() => handleSelect(voice)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Shader Avatar */}
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-full overflow-hidden shadow-sm ${isSelected ? 'ring-2 ring-blue-400' : ''}`}>
                            <ShaderAvatar type={getShaderForVoice(voice.name)} />
                          </div>
                          {isSelected && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 block truncate">{voice.name}</span>
                          <span className="text-xs text-gray-500 block truncate">
                            {voice.category} • {voice.accent || voice.tags[0] || 'Voice'}
                          </span>
                        </div>

                        {/* Play Button */}
                        <button
                          onClick={(e) => handlePlayPreview(voice, e)}
                          disabled={!voice.previewUrl || isLoadingAudio}
                          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                            isPlaying
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          } ${!voice.previewUrl ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          {isPlaying ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5 ml-0.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Browse Library Button */}
            <div className="p-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToLibrary?.();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <Compass className="w-4 h-4" />
                Browse Voice Library
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
