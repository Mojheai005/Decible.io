import React from 'react';
import { Home, Mic, Users, HelpCircle, User, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onNavigate }) => {
  // Left side items
  const leftItems = [
    { id: 'dashboard', icon: Home, label: 'Home' },
    { id: 'library', icon: Users, label: 'Voices' },
  ];

  // Right side items
  const rightItems = [
    { id: 'help', icon: HelpCircle, label: 'Help' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  const isCreateActive = currentView === 'tts';

  const renderNavItem = (item: { id: string; icon: any; label: string }) => {
    const isActive = currentView === item.id ||
      (item.id === 'dashboard' && currentView === 'landing') ||
      (item.id === 'library' && currentView === 'voice-creator');

    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className="flex flex-col items-center justify-center flex-1 min-h-[56px] py-2 transition-all active:scale-95"
      >
        <motion.div
          animate={{ scale: isActive ? 1.05 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`p-2 rounded-xl transition-colors ${
            isActive ? 'bg-gray-100' : ''
          }`}
        >
          <item.icon
            className={`w-5 h-5 transition-colors ${
              isActive ? 'text-gray-900' : 'text-gray-400'
            }`}
            strokeWidth={isActive ? 2.5 : 2}
          />
        </motion.div>
        <span className={`text-[10px] mt-0.5 font-medium transition-colors ${
          isActive ? 'text-gray-900' : 'text-gray-400'
        }`}>
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200/80 z-50 pb-safe">
      <div className="flex items-center px-2">
        {/* Left Items */}
        <div className="flex flex-1">
          {leftItems.map(renderNavItem)}
        </div>

        {/* Center Create Button - Elevated */}
        <div className="relative -mt-4 px-2">
          <motion.button
            onClick={() => onNavigate('tts')}
            whileTap={{ scale: 0.95 }}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
              isCreateActive
                ? 'bg-gray-900 text-white shadow-gray-900/30'
                : 'bg-gradient-to-br from-gray-800 to-gray-900 text-white shadow-gray-400/40 active:shadow-gray-400/20'
            }`}
          >
            {isCreateActive ? (
              <Mic className="w-6 h-6" strokeWidth={2.5} />
            ) : (
              <Plus className="w-6 h-6" strokeWidth={2.5} />
            )}
          </motion.button>
          <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap ${
            isCreateActive ? 'text-gray-900' : 'text-gray-500'
          }`}>
            Create
          </span>
        </div>

        {/* Right Items */}
        <div className="flex flex-1">
          {rightItems.map(renderNavItem)}
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
