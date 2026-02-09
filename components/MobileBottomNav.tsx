import React from 'react';
import { Home, Mic, Users, User, Crown } from 'lucide-react';
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

  // Right side items - Pricing instead of Help (drives conversions)
  const rightItems = [
    { id: 'subscription', icon: Crown, label: 'Plans' },
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
        className="flex flex-col items-center justify-center flex-1 min-h-[60px] py-2.5 transition-all active:scale-95"
      >
        <motion.div
          animate={{ scale: isActive ? 1.05 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-gray-100' : ''}`}
        >
          <item.icon
            className={`w-5 h-5 transition-colors ${isActive ? 'text-gray-900' : 'text-gray-400'}`}
            strokeWidth={isActive ? 2.5 : 2}
          />
        </motion.div>
        <span className={`text-[11px] mt-1 font-semibold transition-colors ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-xl border-t border-gray-200/80 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Left Items */}
        <div className="flex flex-1 justify-evenly">
          {leftItems.map(renderNavItem)}
        </div>

        {/* Center Create Button - Elevated FAB */}
        <div className="relative -mt-5 px-3">
          <motion.button
            onClick={() => onNavigate('tts')}
            whileTap={{ scale: 0.92 }}
            className={`w-[56px] h-[56px] rounded-2xl flex items-center justify-center shadow-lg transition-all ${
              isCreateActive
                ? 'bg-gray-900 text-white shadow-gray-900/30'
                : 'bg-gray-900 text-white shadow-gray-900/25 active:bg-gray-800'
            }`}
          >
            <Mic className="w-6 h-6" strokeWidth={2.5} />
          </motion.button>
          <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap ${
            isCreateActive ? 'text-gray-900' : 'text-gray-500'
          }`}>
            Create
          </span>
        </div>

        {/* Right Items */}
        <div className="flex flex-1 justify-evenly">
          {rightItems.map(renderNavItem)}
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
