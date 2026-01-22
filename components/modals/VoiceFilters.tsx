import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface VoiceFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: { language?: string; accent?: string; gender?: string }) => void;
  initialFilters?: { language?: string; accent?: string; gender?: string };
}

const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese'];
const ACCENTS = ['American', 'British', 'Australian', 'Indian', 'Irish', 'Scottish', 'Canadian', 'South African'];
const CATEGORIES = [
  "Narrative & Story", "Conversational", "Characters & Animation", "Social Media",
  "Entertainment & TV", "Advertisement", "Informative & Educational"
];

export const VoiceFilters: React.FC<VoiceFiltersProps> = ({ isOpen, onClose, onApply, initialFilters }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(initialFilters?.language || '');
  const [selectedAccent, setSelectedAccent] = useState(initialFilters?.accent || '');
  const [selectedGender, setSelectedGender] = useState<string>(initialFilters?.gender || 'Any');
  const [selectedAge, setSelectedAge] = useState<string>('Any');
  const [selectedQuality, setSelectedQuality] = useState<string>('Any');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Reset form when modal opens with initial filters
  useEffect(() => {
    if (isOpen) {
      setSelectedLanguage(initialFilters?.language || '');
      setSelectedAccent(initialFilters?.accent || '');
      setSelectedGender(initialFilters?.gender || 'Any');
    }
  }, [isOpen, initialFilters]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleApply = () => {
    onApply({
      language: selectedLanguage || undefined,
      accent: selectedAccent || undefined,
      gender: selectedGender !== 'Any' ? selectedGender : undefined,
    });
  };

  const handleReset = () => {
    setSelectedLanguage('');
    setSelectedAccent('');
    setSelectedCategories([]);
    setSelectedGender('Any');
    setSelectedAge('Any');
    setSelectedQuality('Any');
    // Apply reset immediately
    onApply({});
  };

  const hasFilters = selectedLanguage || selectedAccent || selectedGender !== 'Any' || selectedCategories.length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Filters</h2>
            {hasFilters && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                Active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Language & Accent in one row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
              >
                <option value="">All languages</option>
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Accent</label>
              <select
                value={selectedAccent}
                onChange={(e) => setSelectedAccent(e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
              >
                <option value="">All accents</option>
                {ACCENTS.map(accent => (
                  <option key={accent} value={accent}>{accent}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Quality</label>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {['Any', 'High-Quality'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setSelectedQuality(opt)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedQuality === opt
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Gender</label>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {['Any', 'Male', 'Female', 'Neutral'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setSelectedGender(opt)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedGender === opt
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Age</label>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {['Any', 'Young', 'Middle Aged', 'Old'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setSelectedAge(opt)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedAge === opt
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
          <button
            onClick={handleReset}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Reset all
          </button>
          <button
            onClick={handleApply}
            className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
};
