import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search, Filter, Plus, ChevronDown, ChevronLeft, ChevronRight, Globe, Loader2, Star, Play, Pause, ArrowUpDown, X, MessageSquare, Tv, BookOpen, Smartphone, User, FolderOpen } from 'lucide-react';
import { ShaderAvatar, ShaderType } from '../ui/ShaderAvatar';
import { useVoices, Voice as ApiVoice } from '@/hooks/useVoices';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import { VoiceFilters } from '@/components/modals/VoiceFilters';
import { useIsMobile } from '../../hooks/useIsMobile';

interface VoiceLibraryProps {
  onNavigate?: (view: string) => void;
  initialTab?: string;
}

// YOUR ORIGINAL CATEGORIES with All button first
const CATEGORIES = [
  { id: '', label: 'All', icon: FolderOpen },
  { id: 'Commentary', label: 'Commentary', icon: MessageSquare },
  { id: 'Documentary', label: 'Documentary', icon: Tv },
  { id: 'Storytelling', label: 'Storytelling', icon: BookOpen },
  { id: 'Short Videos', label: 'Short Videos', icon: Smartphone },
  { id: 'Crime & Suspense', label: 'Crime & Suspense', icon: User },
];

// Voice use case categories
const USE_CASES = [
  {
    id: 'youtube',
    label: 'Best voices for Youtube',
    icon: '📺',
    bgColor: 'bg-gradient-to-br from-violet-100 to-purple-200',
    searchTerm: 'YouTube'
  },
  {
    id: 'shorts',
    label: 'Popular Shorts/Reels Voices',
    icon: '📱',
    bgColor: 'bg-gradient-to-br from-amber-100 to-orange-200',
    searchTerm: 'Short Videos'
  },
  {
    id: 'character',
    label: 'Engaging character voices',
    icon: '🎭',
    bgColor: 'bg-gradient-to-br from-slate-100 to-gray-200',
    searchTerm: 'character'
  },
  {
    id: 'studio',
    label: 'Studio quality commentary voices',
    icon: '🎙️',
    bgColor: 'bg-gradient-to-br from-emerald-100 to-teal-200',
    searchTerm: 'Commentary'
  },
  {
    id: 'sleep',
    label: 'Bring your sleep stories to life',
    icon: '🌙',
    bgColor: 'bg-gradient-to-br from-indigo-100 to-blue-200',
    searchTerm: 'Storytelling'
  },
  {
    id: 'documentary',
    label: 'Epic voices for documentaries',
    icon: '🎬',
    bgColor: 'bg-gradient-to-br from-stone-100 to-stone-200',
    searchTerm: 'Documentary'
  },
  {
    id: 'asmr',
    label: 'Relaxing voices for ASMR',
    icon: '🎧',
    bgColor: 'bg-gradient-to-br from-rose-100 to-pink-200',
    searchTerm: 'calm'
  },
];

// Shader mapping - RESTORED
const getShaderType = (name: string, category: string): ShaderType => {
  const shaders: ShaderType[] = ['neon', 'fluid', 'chrome', 'orb', 'waves', 'midnight'];
  const hash = (name + (category || '')).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return shaders[hash % shaders.length];
};

// Use Case Card Component
const UseCaseCard: React.FC<{
  label: string;
  icon: string;
  bgColor: string;
  onClick: () => void;
  isMobile?: boolean;
}> = ({ label, icon, bgColor, onClick, isMobile }) => {
  return (
    <button
      onClick={onClick}
      className={`${bgColor} rounded-2xl text-left hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col justify-between group shrink-0 ${
        isMobile ? 'p-4 min-w-[160px] h-[100px]' : 'p-5 min-w-[200px] h-[130px]'
      }`}
    >
      <div className={isMobile ? 'text-2xl' : 'text-3xl'}>{icon}</div>
      <div className="flex items-center justify-between">
        <span className={`text-gray-900 font-semibold leading-tight ${
          isMobile ? 'text-xs max-w-[100px]' : 'text-sm max-w-[130px]'
        }`}>
          {label}
        </span>
        <div className={`bg-white/80 rounded-full flex items-center justify-center group-hover:bg-white transition-colors ${
          isMobile ? 'w-6 h-6' : 'w-8 h-8'
        }`}>
          <ChevronRight className={isMobile ? 'w-3 h-3 text-gray-700' : 'w-4 h-4 text-gray-700'} />
        </div>
      </div>
    </button>
  );
};

// Voice Card Component with SHADER AVATAR (for Trending section - grid view)
const VoiceCard: React.FC<{
  voice: ApiVoice;
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: (e: React.MouseEvent) => void;
  onClick: () => void;
}> = ({ voice, isPlaying, isLoading, onPlay, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* SHADER Avatar - RESTORED */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm">
            <ShaderAvatar type={getShaderType(voice.name, voice.category)} />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {voice.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{voice.category}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm">{voice.language === 'English' ? '🇺🇸' : '🌍'}</span>
            <span className="text-xs text-gray-500">{voice.language}</span>
            {voice.tags && voice.tags.length > 1 && (
              <span className="text-xs text-gray-400">+{voice.tags.length - 1}</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={onPlay}
          disabled={isLoading}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
            isLoading
              ? 'bg-amber-50 text-amber-600 border border-amber-200'
              : isPlaying
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              Playing
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Preview
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Voice Row Component (for list view)
const VoiceRow: React.FC<{
  voice: ApiVoice;
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: (e: React.MouseEvent) => void;
  onClick: () => void;
  isMobile?: boolean;
}> = ({ voice, isPlaying, isLoading, onPlay, onClick, isMobile }) => {
  // Get flag emoji based on language
  const getLanguageFlag = (lang: string) => {
    const flags: Record<string, string> = {
      'English': '🇺🇸',
      'Hindi': '🇮🇳',
      'Spanish': '🇪🇸',
      'French': '🇫🇷',
      'German': '🇩🇪',
      'Italian': '🇮🇹',
      'Portuguese': '🇧🇷',
      'Japanese': '🇯🇵',
      'Korean': '🇰🇷',
      'Chinese': '🇨🇳',
      'Russian': '🇷🇺',
      'Arabic': '🇸🇦',
      'Turkish': '🇹🇷',
      'Dutch': '🇳🇱',
      'Polish': '🇵🇱',
    };
    return flags[lang] || '🌍';
  };

  // Format usage count
  const formatUsage = (count?: number) => {
    if (!count) return '-';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  // Mobile compact layout
  if (isMobile) {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm">
            <ShaderAvatar type={getShaderType(voice.name, voice.category)} />
          </div>
        </div>

        {/* Name & Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-sm">
            {voice.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs">{getLanguageFlag(voice.language)}</span>
            <span className="text-xs text-gray-500">{voice.category}</span>
            {voice.accent && voice.accent !== 'Neutral' && (
              <span className="text-xs text-gray-400">• {voice.accent}</span>
            )}
          </div>
        </div>

        {/* Play Button */}
        <button
          onClick={onPlay}
          disabled={isLoading}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
            isLoading
              ? 'bg-amber-100 text-amber-600'
              : isPlaying
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm">
          <ShaderAvatar type={getShaderType(voice.name, voice.category)} />
        </div>
      </div>

      {/* Name & Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {voice.name}
          </h3>
          {voice.gender && (
            <span className="hidden sm:inline-flex text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
              {voice.gender}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate max-w-[300px]">
          {voice.description || voice.descriptive || `${voice.accent || ''} ${voice.category || ''}`.trim() || 'Voice'}
        </p>
      </div>

      {/* Language & Accent */}
      <div className="hidden md:flex items-center gap-2 min-w-[140px]">
        <span className="text-lg">{getLanguageFlag(voice.language)}</span>
        <div className="flex flex-col">
          <span className="text-sm text-gray-700">{voice.language}</span>
          {voice.accent && voice.accent !== 'Neutral' && (
            <span className="text-xs text-gray-400">{voice.accent}</span>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="hidden lg:block min-w-[120px]">
        <span className="inline-flex text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
          {voice.category}
        </span>
      </div>

      {/* Usage Count */}
      <div className="hidden lg:block min-w-[70px] text-right">
        <span className="text-sm text-gray-500 font-medium">{formatUsage(voice.usageCount)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 w-20 justify-center">
        <button
          onClick={onPlay}
          disabled={isLoading}
          className={`p-2.5 rounded-full transition-all ${
            isLoading
              ? 'bg-amber-100 text-amber-600 scale-110'
              : isPlaying
                ? 'bg-blue-100 text-blue-600 scale-110'
                : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

export const VoiceLibrary: React.FC<VoiceLibraryProps> = ({ onNavigate, initialTab }) => {
  const isMobile = useIsMobile();
  const voiceData = useVoices();
  const voices = voiceData.voices || [];
  const isLoading = voiceData.isLoading;
  const error = voiceData.error;

  const { playVoice, currentVoice, isPlaying, isLoadingPreview } = useGlobalAudio();

  const [activeTab, setActiveTab] = useState<'explore' | 'default' | 'latest'>(
    initialTab === 'latest' ? 'latest' : 'explore'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [displayLimit, setDisplayLimit] = useState(24);
  const [sortOption, setSortOption] = useState<'popular' | 'newest' | 'alphabetical'>('popular');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<{ language?: string; accent?: string; gender?: string }>({});
  const useCaseRef = useRef<HTMLDivElement>(null);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isAccentOpen, setIsAccentOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Get unique languages and accents from voices
  const availableLanguages = useMemo(() => {
    const langs = new Set(voices.map(v => v.language).filter(Boolean));
    return Array.from(langs).sort();
  }, [voices]);

  const availableAccents = useMemo(() => {
    const accents = new Set(voices.map(v => v.accent).filter(Boolean));
    return Array.from(accents).sort();
  }, [voices]);

  // Trending voices - top 6 by usage
  const trendingVoices = useMemo(() => {
    return [...voices]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 6);
  }, [voices]);

  // Filter logic
  const filteredVoices = useMemo(() => {
    let result = [...voices];

    if (activeTab === 'latest') {
      // Sort by newest first for latest tab
      result = result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    if (selectedCategory) {
      result = result.filter(v => v.category === selectedCategory);
    }

    // Language filter - exact match or contains
    if (appliedFilters.language) {
      const filterLang = appliedFilters.language.toLowerCase();
      result = result.filter(v => {
        const voiceLang = (v.language || '').toLowerCase();
        return voiceLang === filterLang || voiceLang.includes(filterLang);
      });
    }

    // Accent filter - exact match or contains
    if (appliedFilters.accent) {
      const filterAccent = appliedFilters.accent.toLowerCase();
      result = result.filter(v => {
        const voiceAccent = (v.accent || '').toLowerCase();
        return voiceAccent === filterAccent || voiceAccent.includes(filterAccent);
      });
    }

    // Gender filter - case insensitive match
    if (appliedFilters.gender) {
      const filterGender = appliedFilters.gender.toLowerCase();
      result = result.filter(v => {
        const voiceGender = (v.gender || '').toLowerCase();
        return voiceGender === filterGender;
      });
    }

    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.accent?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Only apply sort option if not on latest tab (latest tab already sorted by newest)
    if (activeTab !== 'latest') {
      result.sort((a, b) => {
        if (sortOption === 'popular') return (b.usageCount || 0) - (a.usageCount || 0);
        if (sortOption === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        if (sortOption === 'alphabetical') return a.name.localeCompare(b.name);
        return 0;
      });
    }

    return result;
  }, [voices, selectedCategory, debouncedSearchQuery, activeTab, sortOption, appliedFilters]);

  const handlePlayVoice = useCallback((voice: ApiVoice, e: React.MouseEvent) => {
    e.stopPropagation();
    playVoice(voice);
  }, [playVoice]);

  const handleApplyFilters = (filters: { language?: string; accent?: string; gender?: string }) => {
    setAppliedFilters(filters);
    setShowFiltersModal(false);
  };

  const handleUseCaseClick = (searchTerm: string) => {
    setSearchQuery(searchTerm);
  };

  const scrollUseCases = (direction: 'left' | 'right') => {
    if (useCaseRef.current) {
      const scrollAmount = 220;
      useCaseRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const displayedVoices = filteredVoices.slice(0, displayLimit);
  const hasActiveFilters = appliedFilters.language || appliedFilters.accent || appliedFilters.gender;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="p-4 bg-red-50 rounded-full mb-4">
          <Globe className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Failed to load voices</h3>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg">Try Again</button>
      </div>
    );
  }

  return (
    <div className={`h-full bg-[#FAFAFA] relative ${isMobile ? 'overflow-y-auto' : 'flex flex-col'}`}>
      {/* Filters Modal */}
      <VoiceFilters
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        onApply={handleApplyFilters}
        initialFilters={appliedFilters}
      />

      {/* Header - Desktop */}
      {!isMobile && (
        <div className="px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-[100] overflow-visible">
          {/* Row 1: Tabs & Actions */}
          <div className="flex items-center justify-between mb-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('explore')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'explore' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Globe className="w-4 h-4" />
                Explore
              </button>
              <button
                onClick={() => setActiveTab('latest')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'latest' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Latest
              </button>
              <button
                onClick={() => setActiveTab('default')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'default' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Default Voices
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigate?.('tts')}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-400 to-cyan-300 flex items-center justify-center">
                  <Plus className="w-3 h-3 text-white" />
                </div>
                Create a Voice
              </button>
            </div>
          </div>

          {/* Row 2: Search & Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search library voices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFiltersModal(true)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-all ${
                hasActiveFilters
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 bg-white'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>

              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                    {[
                      { id: 'popular', label: 'Popularity' },
                      { id: 'newest', label: 'Newest' },
                      { id: 'alphabetical', label: 'Name (A-Z)' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { setSortOption(opt.id as typeof sortOption); setIsSortOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          sortOption === opt.id ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 3: Language/Accent dropdowns + Categories */}
          <div className="flex items-center gap-3 mt-4 flex-wrap pb-1">
            {/* Language Dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => { setIsLanguageOpen(!isLanguageOpen); setIsAccentOpen(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm bg-white hover:bg-gray-50 transition-colors ${
                  appliedFilters.language ? 'border-blue-400 text-blue-600' : 'border-gray-200 text-gray-600'
                }`}
              >
                <Globe className="w-4 h-4" />
                {appliedFilters.language || 'Language'}
                <ChevronDown className={`w-3 h-3 transition-transform ${isLanguageOpen ? 'rotate-180' : ''}`} />
              </button>
              {isLanguageOpen && (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setIsLanguageOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-[9999] py-1 max-h-60 overflow-y-auto">
                    <button
                      onClick={() => { setAppliedFilters(f => ({ ...f, language: undefined })); setIsLanguageOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${!appliedFilters.language ? 'font-medium text-blue-600' : 'text-gray-600'}`}
                    >
                      All Languages
                    </button>
                    {availableLanguages.map(lang => (
                      <button
                        key={lang}
                        onClick={() => { setAppliedFilters(f => ({ ...f, language: lang })); setIsLanguageOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${appliedFilters.language === lang ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-600'}`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Accent Dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => { setIsAccentOpen(!isAccentOpen); setIsLanguageOpen(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm bg-white hover:bg-gray-50 transition-colors ${
                  appliedFilters.accent ? 'border-blue-400 text-blue-600' : 'border-gray-200 text-gray-500'
                }`}
              >
                {appliedFilters.accent || 'Accent'}
                <ChevronDown className={`w-3 h-3 transition-transform ${isAccentOpen ? 'rotate-180' : ''}`} />
              </button>
              {isAccentOpen && (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setIsAccentOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-[9999] py-1 max-h-60 overflow-y-auto">
                    <button
                      onClick={() => { setAppliedFilters(f => ({ ...f, accent: undefined })); setIsAccentOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${!appliedFilters.accent ? 'font-medium text-blue-600' : 'text-gray-600'}`}
                    >
                      All Accents
                    </button>
                    {availableAccents.map(accent => (
                      <button
                        key={accent}
                        onClick={() => { setAppliedFilters(f => ({ ...f, accent: accent })); setIsAccentOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${appliedFilters.accent === accent ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-600'}`}
                      >
                        {accent}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 shrink-0" />
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header - Mobile — clean, spacious, scrolls with content */}
      {isMobile && (
        <div className="bg-white border-b border-gray-200">
          {/* Row 1: Search + Filter button */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search voices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 active:text-gray-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFiltersModal(true)}
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                hasActiveFilters ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 active:bg-gray-200'
              }`}
            >
              <Filter className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Row 2: Tabs — single scrollable row merging tabs + categories */}
          <div className="px-4 pb-3">
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[
                { id: 'explore', label: 'Explore' },
                { id: 'latest', label: 'Latest' },
                { id: 'default', label: 'Default' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-3.5 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {/* Divider dot */}
              <div className="flex items-center px-1 shrink-0">
                <div className="w-1 h-1 rounded-full bg-gray-300" />
              </div>

              {/* Category pills inline */}
              {CATEGORIES.filter(c => c.id !== '').map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Filters — compact removable pills */}
          {(appliedFilters.language || appliedFilters.accent || appliedFilters.gender) && (
            <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
              {appliedFilters.language && (
                <button
                  onClick={() => setAppliedFilters(f => ({ ...f, language: undefined }))}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white rounded-full text-xs font-medium"
                >
                  {appliedFilters.language}
                  <X className="w-3 h-3" />
                </button>
              )}
              {appliedFilters.accent && (
                <button
                  onClick={() => setAppliedFilters(f => ({ ...f, accent: undefined }))}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white rounded-full text-xs font-medium"
                >
                  {appliedFilters.accent}
                  <X className="w-3 h-3" />
                </button>
              )}
              {appliedFilters.gender && (
                <button
                  onClick={() => setAppliedFilters(f => ({ ...f, gender: undefined }))}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white rounded-full text-xs font-medium"
                >
                  {appliedFilters.gender}
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className={`space-y-8 ${isMobile ? 'p-4 pb-32' : 'flex-1 overflow-y-auto p-6'}`}>
        {/* Trending Voices Section - Hide when filters are active */}
        {!searchQuery && !selectedCategory && !hasActiveFilters && activeTab === 'explore' && trendingVoices.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Trending voices</h2>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                trendingVoices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    isPlaying={currentVoice?.id === voice.id && isPlaying}
                    isLoading={currentVoice?.id === voice.id && isLoadingPreview}
                    onPlay={(e) => handlePlayVoice(voice, e)}
                    onClick={() => playVoice(voice)}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {/* Use case cards - Hide when filters are active */}
        {!searchQuery && !selectedCategory && !hasActiveFilters && activeTab === 'explore' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Handpicked for your use case</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => scrollUseCases('left')}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollUseCases('right')}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              ref={useCaseRef}
              className="flex gap-4 overflow-x-auto pb-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {USE_CASES.map(useCase => (
                <UseCaseCard
                  key={useCase.id}
                  label={useCase.label}
                  icon={useCase.icon}
                  bgColor={useCase.bgColor}
                  onClick={() => handleUseCaseClick(useCase.searchTerm)}
                  isMobile={isMobile}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Voices Section - List View */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {searchQuery ? `Search results for "${searchQuery}"` :
               selectedCategory ? `${selectedCategory} voices` :
               activeTab === 'latest' ? 'Latest voices' :
               hasActiveFilters ? 'Filtered voices' : 'All voices'}
            </h2>
            <span className="text-sm text-gray-500">{filteredVoices.length} voices</span>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="hidden md:flex items-center gap-2 w-32">
                    <div className="w-6 h-6 bg-gray-100 rounded" />
                    <div className="h-3 bg-gray-100 rounded w-16" />
                  </div>
                  <div className="hidden lg:block w-24">
                    <div className="h-3 bg-gray-100 rounded w-full" />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full" />
                    <div className="w-8 h-8 bg-gray-100 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedVoices.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-900">No voices found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <>
              {/* List Header - Desktop only */}
              {!isMobile && (
                <div className="hidden md:flex items-center gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 rounded-t-xl border border-gray-200">
                  <div className="w-10 shrink-0" /> {/* Avatar space */}
                  <div className="flex-1">Name</div>
                  <div className="hidden md:block min-w-[140px]">Language</div>
                  <div className="hidden lg:block min-w-[120px]">Category</div>
                  <div className="hidden lg:block min-w-[70px] text-right">Usage</div>
                  <div className="w-20 text-center">Actions</div>
                </div>
              )}

              {/* Voice Rows */}
              <div className={`bg-white overflow-hidden ${
                isMobile
                  ? 'rounded-2xl border border-gray-200'
                  : 'rounded-b-xl md:rounded-t-none rounded-xl border border-gray-200 md:border-t-0'
              }`}>
                {displayedVoices.map((voice) => (
                  <VoiceRow
                    key={voice.id}
                    voice={voice}
                    isPlaying={currentVoice?.id === voice.id && isPlaying}
                    isLoading={currentVoice?.id === voice.id && isLoadingPreview}
                    onPlay={(e) => handlePlayVoice(voice, e)}
                    onClick={() => playVoice(voice)}
                    isMobile={isMobile}
                  />
                ))}
              </div>

              {displayedVoices.length < filteredVoices.length && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setDisplayLimit(prev => prev + 24)}
                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm text-sm"
                  >
                    Load More Voices ({filteredVoices.length - displayedVoices.length} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
