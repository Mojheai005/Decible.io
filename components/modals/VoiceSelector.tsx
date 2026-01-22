import React, { useState } from 'react';
import { Search, Play, Check, X } from 'lucide-react';

interface Voice {
  id: string;
  name: string;
  category: string;
  tags: string[];
  gradient: string;
}

interface VoiceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (voice: Voice) => void;
  currentVoiceId: string;
}

const VOICES: Voice[] = [
  { id: 'rachel', name: 'Rachel', category: 'Narrative', tags: ['American', 'Calm'], gradient: 'from-pink-400 to-rose-500' },
  { id: 'drew', name: 'Drew', category: 'News', tags: ['American', 'Deep'], gradient: 'from-blue-500 to-cyan-500' },
  { id: 'clyde', name: 'Clyde', category: 'Deep', tags: ['American', 'Gravelly'], gradient: 'from-amber-500 to-orange-600' },
  { id: 'mimi', name: 'Mimi', category: 'Childish', tags: ['Australian', 'Cute'], gradient: 'from-purple-400 to-pink-400' },
  { id: 'fin', name: 'Fin', category: 'Gaming', tags: ['Irish', 'Energetic'], gradient: 'from-emerald-400 to-green-600' },
];

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ isOpen, onClose, onSelect, currentVoiceId }) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredVoices = VOICES.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">Select a Voice</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search for a voice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredVoices.map((voice) => (
            <div
              key={voice.id}
              onClick={() => { onSelect(voice); onClose(); }}
              className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${
                currentVoiceId === voice.id ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${voice.gradient} flex items-center justify-center text-white shrink-0`}>
                {currentVoiceId === voice.id && <Check className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{voice.name}</span>
                  <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-200 rounded-full">{voice.category}</span>
                </div>
                <div className="text-sm text-gray-500 flex gap-2 mt-0.5">
                  {voice.tags.map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
              <button className="p-2 hover:bg-white rounded-full shadow-sm border border-transparent hover:border-gray-200">
                <Play className="w-4 h-4 text-gray-700 fill-current" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
