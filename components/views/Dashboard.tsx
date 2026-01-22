import React from 'react';
import { Mic, FileAudio, Wand2, Music, ArrowRight, Loader2 } from 'lucide-react';
import { ShaderAvatar, ShaderType } from '../ui/ShaderAvatar';
import { useVoices } from '@/hooks/useVoices';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';

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
  const { voices, isLoading, error } = useVoices();
  const { playVoice } = useGlobalAudio();

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
    <div className="p-8 max-w-7xl mx-auto pb-20">
      {/* Header Banner - Removed Talk to AI button */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Good evening</h1>
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {[
          { id: 'tts', icon: Mic, label: 'Text to Speech', color: 'bg-blue-100 text-blue-600', comingSoon: false },
          { id: 'vtt', icon: FileAudio, label: 'Voice to Text', color: 'bg-green-100 text-green-600', comingSoon: false },
          { id: 'voice-changer', icon: Wand2, label: 'Voice Changer', color: 'bg-purple-100 text-purple-600', comingSoon: true },
          { id: 'music', icon: Music, label: 'Create Music', color: 'bg-orange-100 text-orange-600', comingSoon: true },
        ].map((tool, i) => (
          <div
            key={i}
            onClick={() => !tool.comingSoon && handleToolClick(tool.id)}
            className={`group relative bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-lg transition-all rounded-3xl p-6 h-48 flex flex-col items-center justify-center ${tool.comingSoon ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
          >
            {tool.comingSoon && (
              <div className="absolute top-3 right-3 px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">
                Coming Soon
              </div>
            )}
            <div className={`w-14 h-14 rounded-2xl ${tool.color} flex items-center justify-center mb-4 transition-transform ${!tool.comingSoon ? 'group-hover:scale-110' : ''}`}>
              <tool.icon className="w-7 h-7" />
            </div>
            <span className="font-medium text-gray-900 text-center">{tool.label}</span>
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
