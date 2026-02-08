import React, { useState, useRef } from 'react';
import { Play, Pause, Check, Plus, Volume2 } from 'lucide-react';
import { ShaderAvatar, ShaderType } from './ShaderAvatar';
import { MiniWaveform } from './AudioWaveform';

interface VoicePreviewCardProps {
  id: string;
  name: string;
  category?: string;
  language?: string;
  tags?: string[];
  previewUrl?: string;
  isSaved?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onSave?: () => void;
  onPlay?: () => void;
  compact?: boolean;
}

// Map voice name to shader type
const getShaderType = (name: string, category: string = ''): ShaderType => {
  const shaders: ShaderType[] = ['neon', 'fluid', 'chrome', 'orb', 'waves', 'midnight'];
  const hash = (name + category).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return shaders[hash % shaders.length];
};

export const VoicePreviewCard: React.FC<VoicePreviewCardProps> = ({
  id,
  name,
  category = 'General',
  language = 'English',
  tags = [],
  previewUrl,
  isSaved = false,
  isSelected = false,
  onSelect,
  onSave,
  onPlay,
  compact = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPreview = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!previewUrl) {
      onPlay?.();
      return;
    }

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);

    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
      audioRef.current.addEventListener('error', () => {
        setIsLoading(false);
        setIsPlaying(false);
      });
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Audio play failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave?.();
  };

  if (compact) {
    // Compact card for mobile lists
    return (
      <div
        onClick={onSelect}
        className={`flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98] ${
          isSelected
            ? 'bg-gray-100 border-2 border-gray-900'
            : 'bg-white border border-gray-200 active:bg-gray-50'
        }`}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm">
            <ShaderAvatar type={getShaderType(name, category)} />
          </div>
          {isSaved && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate text-sm">{name}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{category}</span>
            {isPlaying && (
              <MiniWaveform isPlaying={isPlaying} className="text-gray-900" />
            )}
          </div>
        </div>

        {/* Play Button */}
        <button
          onClick={handlePlayPreview}
          disabled={isLoading}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
            isPlaying
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>
    );
  }

  // Full card for desktop/grid views
  return (
    <div
      onClick={onSelect}
      className={`group bg-white rounded-2xl border p-4 transition-all cursor-pointer ${
        isSelected
          ? 'border-gray-900 shadow-lg ring-2 ring-gray-900/10'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md active:scale-[0.98]'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar with Play Overlay */}
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm">
            <ShaderAvatar type={getShaderType(name, category)} />
          </div>

          {/* Play overlay on hover */}
          <button
            onClick={handlePlayPreview}
            disabled={isLoading}
            className={`absolute inset-0 flex items-center justify-center rounded-xl transition-all ${
              isPlaying
                ? 'bg-black/60'
                : 'bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100'
            }`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 text-white fill-current" />
            ) : (
              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
            )}
          </button>

          {isSaved && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                {name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{category}</p>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              className={`p-1.5 rounded-lg transition-all ${
                isSaved
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Tags & Language */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-sm">{language === 'English' ? '🇺🇸' : '🌍'}</span>
            <span className="text-xs text-gray-500">{language}</span>
            {tags.slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Waveform when playing */}
          {isPlaying && (
            <div className="mt-3 flex items-center gap-2">
              <MiniWaveform isPlaying={isPlaying} className="text-gray-900" />
              <span className="text-[10px] text-gray-400 font-medium">Playing preview...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoicePreviewCard;
