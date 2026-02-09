import React from 'react';
import { Mic, FileAudio, Wand2, Music, ArrowRight, Loader2, Crown, Check, Star, AlertTriangle, Zap } from 'lucide-react';
import { ShaderAvatar, ShaderType } from '../ui/ShaderAvatar';
import { useVoices } from '@/hooks/useVoices';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useIsMobile } from '../../hooks/useIsMobile';
import DecibleLogo from '../DecibleLogo';

interface DashboardProps {
  onNavigate?: (view: string) => void;
}

// Map voice name to shader type
const getShaderType = (name: string, category: string): ShaderType => {
  const shaders: ShaderType[] = ['fluid', 'neon', 'orb', 'chrome', 'waves', 'midnight'];
  const hash = (name + (category || '')).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return shaders[hash % shaders.length];
};

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const isMobile = useIsMobile();
  const { voices, isLoading, error } = useVoices();
  const { playVoice } = useGlobalAudio();
  const { profile } = useUserProfile();
  const isFreePlan = !profile?.plan || profile.plan === 'free';

  // Get first 3 voices for display
  const latestVoices = voices.slice(0, 3).map(voice => ({
    id: voice.id,
    name: voice.name,
    desc: voice.description || `${voice.category || 'General'} - ${voice.accent || ''} ${voice.gender || ''} voice`,
    shader: getShaderType(voice.name, voice.category || ''),
    previewUrl: voice.previewUrl,
    voice, // Keep original voice for playback
  }));

  const handleToolClick = (toolId: string) => {
    if (onNavigate) {
      if (toolId === 'tts') {
        onNavigate('tts');
      } else if (toolId === 'vtt') {
        onNavigate('tts'); // Voice to text - navigate to TTS for now
      }
      // 'voice-changer' and 'music' are coming soon - no action
    }
  };

  const handleVoiceClick = () => {
    // Navigate to voice library with latest tab
    if (onNavigate) {
      onNavigate('library?tab=latest');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-24 md:pb-20">
      {/* Welcome Header */}
      <div className="mb-6 md:mb-8">
        {isMobile ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg">
              <DecibleLogo size={28} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Welcome to</p>
              <h1 className="text-xl font-bold text-gray-900">Decible Studio</h1>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Welcome to Decible</h1>
        )}
      </div>

      {/* Upgrade Banner - Premium minimal dark design */}
      {isFreePlan && (
        <div
          onClick={() => onNavigate?.('subscription')}
          className={`bg-gray-900 text-white rounded-2xl cursor-pointer active:scale-[0.99] transition-all hover:bg-gray-800 ${
            isMobile ? 'p-5 mb-6' : 'p-6 mb-8'
          }`}
        >
          <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between'}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-amber-400 font-semibold">Upgrade Your Plan</span>
              </div>
              <h3 className={`font-bold text-white ${isMobile ? 'text-lg' : 'text-xl'}`}>
                Scale Your Content Creation
              </h3>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>60+ videos/mo</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Premium voices</span>
                </div>
                <div className="hidden md:flex items-center gap-1.5 text-gray-400 text-sm">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>API access</span>
                </div>
              </div>
            </div>
            <div className={isMobile ? 'w-full' : 'shrink-0'}>
              <button className={`flex items-center justify-center gap-2 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors ${
                isMobile ? 'w-full py-3 text-sm' : 'px-6 py-3 text-sm'
              }`}>
                View Plans
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm text-gray-400">Join 4,200+ YouTube creators using Decible</span>
          </div>
        </div>
      )}

      {/* Low Credits Warning — shows for any user when credits < 20% */}
      {(() => {
        const remaining = profile?.remainingCredits ?? 0;
        const total = profile?.totalCredits ?? 1;
        const pct = total > 0 ? (remaining / total) * 100 : 100;
        if (pct > 20 || isFreePlan) return null; // Free plan already sees the upgrade banner

        return (
          <div
            onClick={() => onNavigate?.('subscription')}
            className={`bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/50 rounded-2xl cursor-pointer active:scale-[0.99] transition-all ${
              isMobile ? 'p-4 mb-5' : 'p-5 mb-6'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-red-900 text-sm">Credits Running Low</h4>
                <p className="text-red-700/70 text-xs mt-0.5">
                  {remaining.toLocaleString()} credits remaining — top up or upgrade to keep creating
                </p>
              </div>
              <div className="shrink-0">
                <Zap className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tool Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-12">
        {[
          { id: 'tts', icon: Mic, label: 'Text to Speech', color: 'bg-blue-100 text-blue-600', comingSoon: false },
          { id: 'vtt', icon: FileAudio, label: 'Voice to Text', color: 'bg-green-100 text-green-600', comingSoon: false },
          { id: 'voice-changer', icon: Wand2, label: 'Voice Changer', color: 'bg-purple-100 text-purple-600', comingSoon: true },
          { id: 'music', icon: Music, label: 'Create Music', color: 'bg-orange-100 text-orange-600', comingSoon: true },
        ].map((tool, i) => (
          <div
            key={i}
            onClick={() => !tool.comingSoon && handleToolClick(tool.id)}
            className={`group relative bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-lg transition-all rounded-2xl md:rounded-3xl p-4 md:p-6 h-36 md:h-48 flex flex-col items-center justify-center ${tool.comingSoon ? 'cursor-default opacity-70' : 'cursor-pointer active:scale-95'}`}
          >
            {tool.comingSoon && (
              <div className="absolute top-2 right-2 md:top-3 md:right-3 px-1.5 md:px-2 py-0.5 md:py-1 bg-gray-200 text-gray-600 text-[10px] md:text-xs font-medium rounded-full">
                Soon
              </div>
            )}
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl ${tool.color} flex items-center justify-center mb-3 md:mb-4 transition-transform ${!tool.comingSoon ? 'group-hover:scale-110' : ''}`}>
              <tool.icon className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <span className="font-medium text-gray-900 text-center text-sm md:text-base">{tool.label}</span>
          </div>
        ))}
      </div>

      {/* Latest from library */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Latest from the library</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading voices...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-gray-400">
            Failed to load voices. <button onClick={() => window.location.reload()} className="text-blue-500 underline">Retry</button>
          </div>
        ) : (
          <div className="space-y-4">
            {latestVoices.map((voiceItem, i) => (
              <div
                key={voiceItem.id || i}
                onClick={handleVoiceClick}
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group border border-gray-100 hover:border-gray-200 hover:shadow-sm"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 relative border border-gray-100">
                  <ShaderAvatar type={voiceItem.shader as ShaderType} />
                  <div className="absolute -bottom-0 -right-0 bg-yellow-400 rounded-full p-0.5 border-2 border-white">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    {voiceItem.name}
                  </h3>
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">{voiceItem.desc}</p>
                </div>
                <div className="p-2 group-hover:bg-gray-200 rounded-full transition-all">
                  <ArrowRight className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            ))}
            {latestVoices.length === 0 && !isLoading && (
              <div className="py-8 text-center text-gray-400">
                No voices available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
