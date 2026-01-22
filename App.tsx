import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './components/views/LandingPage';
import { Dashboard } from './components/views/Dashboard';
import { TextToSpeech } from './components/views/TextToSpeech';
import { VoiceLibrary } from './components/views/VoiceLibrary';
import { Profile } from './components/views/Profile';
import { Bell, Menu } from 'lucide-react';
import { AudioProvider } from './src/contexts/GlobalAudioContext';
import { NotificationProvider, useNotifications } from './src/contexts/NotificationContext';
import { GlobalPlayer } from './components/GlobalPlayer';
import { ToastContainer } from './components/ui/Toast';
import { NotificationDropdown } from './components/ui/NotificationDropdown';

const AppContent: React.FC = () => {
  const [view, setView] = useState('landing');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const { unreadCount, addNotification, showToast } = useNotifications();

  const handleLogin = () => {
    setIsLoggedIn(true);
    setView('dashboard');

    // Welcome notification
    addNotification({
      title: 'Welcome to Decibal!',
      message: 'Start exploring our voice library or create your first voice generation.',
      type: 'success',
    });

    showToast('Successfully logged in!', 'success');
  };

  // Add some demo notifications on first load (for testing)
  useEffect(() => {
    if (isLoggedIn) {
      // Delayed notification for demo purposes
      const timer = setTimeout(() => {
        addNotification({
          title: 'New voices available',
          message: '15 new premium voices have been added to the library.',
          type: 'info',
        });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, addNotification]);

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard onNavigate={setView} />;
      case 'tts':
        return <TextToSpeech onNavigate={setView} />;
      case 'voice-creator':
      case 'library':
        return <VoiceLibrary onNavigate={setView} />;
      case 'profile':
        return <Profile />;
      case 'voice-to-text':
        return <div className="p-10 text-center text-gray-500">Voice to Text - Coming Soon</div>;
      default:
        return <Dashboard onNavigate={setView} />;
    }
  };

  if (!isLoggedIn) {
    return <LandingPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex w-full h-screen bg-white font-sans text-gray-900">
      <Sidebar
        currentView={view}
        onNavigate={setView}
        isCollapsed={isSidebarCollapsed}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white relative">
        <header className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0 z-20">
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-black"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="hover:text-black cursor-pointer font-medium" onClick={() => setView('dashboard')}>
                {view === 'dashboard' ? 'Workspaces' : 'Decibal'}
              </span>
              {view !== 'dashboard' && (
                <>
                  <span className="text-gray-300">/</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {view === 'tts' ? 'Text to Speech' : view === 'library' || view === 'voice-creator' ? 'Voice Library' : view.replace(/-/g, ' ')}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell with Dropdown */}
            <button
              ref={bellButtonRef}
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 relative transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown - rendered via portal */}
            <NotificationDropdown
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              anchorRef={bellButtonRef}
            />

            <button
              onClick={() => setView('profile')}
              className="w-8 h-8 bg-gradient-to-tr from-green-700 to-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-transparent hover:ring-gray-200 transition-all"
            >
              U
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative bg-white">
          {renderView()}
        </main>

        <GlobalPlayer />
      </div>

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AudioProvider>
        <AppContent />
      </AudioProvider>
    </NotificationProvider>
  );
};

export default App;
