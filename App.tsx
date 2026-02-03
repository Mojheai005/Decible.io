import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './components/views/LandingPage';
import { Dashboard } from './components/views/Dashboard';
import { TextToSpeech } from './components/views/TextToSpeech';
import { VoiceLibrary } from './components/views/VoiceLibrary';
import { Profile } from './components/views/Profile';
import { Subscription } from './components/views/Subscription';
import { HelpCenter } from './components/views/HelpCenter';
import { Bell, Menu, FileAudio } from 'lucide-react';
import { AudioProvider } from './src/contexts/GlobalAudioContext';
import { NotificationProvider, useNotifications } from './src/contexts/NotificationContext';
import { GlobalPlayer } from './components/GlobalPlayer';
import { ToastContainer } from './components/ui/Toast';
import { NotificationDropdown } from './components/ui/NotificationDropdown';
import { createClient } from '@/lib/supabase/client';

const AppContent: React.FC = () => {
  const [view, setView] = useState('landing');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const isLoggedInRef = useRef(false);

  const { unreadCount, addNotification, showToast } = useNotifications();

  // Keep ref in sync with state to avoid stale closures
  useEffect(() => { isLoggedInRef.current = isLoggedIn; }, [isLoggedIn]);

  // Check real Supabase auth state on mount
  useEffect(() => {
    const supabase = createClient();

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true);
        setView('dashboard');
      }
      setIsLoading(false);
    });

    // Listen for auth state changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Only navigate to dashboard on INITIAL sign-in, not on token refresh
        if (!isLoggedInRef.current) {
          setIsLoggedIn(true);
          setView('dashboard');
          addNotification({
            title: 'Welcome to Decible!',
            message: 'Start exploring our voice library or create your first voice generation.',
            type: 'success',
          });
          showToast('Successfully logged in!', 'success');
        }
      } else if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setView('landing');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [addNotification, showToast]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setView('landing');
    showToast('Logged out successfully', 'info');
  };

  // Parse current view
  const [baseView] = view.split('?');
  const queryString = view.includes('?') ? view.split('?')[1] : '';
  const viewParams = new URLSearchParams(queryString);
  const tabParam = viewParams.get('tab');

  const renderView = () => {
    switch (baseView) {
      case 'dashboard':
        return <Dashboard onNavigate={setView} />;
      case 'voice-creator':
      case 'library':
        return <VoiceLibrary onNavigate={setView} initialTab={tabParam || undefined} />;
      case 'profile':
        return <Profile onLogout={handleLogout} onNavigate={setView} />;
      case 'subscription':
        return <Subscription onNavigate={setView} />;
      case 'voice-to-text':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-10">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <FileAudio className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Voice to Text</h2>
            <p className="text-gray-500">This feature is coming soon.</p>
          </div>
        );
      case 'help':
        return <HelpCenter />;
      case 'tts':
        return null; // TTS is always mounted below, hidden when not active
      default:
        return <Dashboard onNavigate={setView} />;
    }
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LandingPage />;
  }

  return (
    <div className="flex w-full h-screen bg-white font-sans text-gray-900">
      <Sidebar
        currentView={view}
        onNavigate={setView}
        isCollapsed={isSidebarCollapsed}
        onLogout={handleLogout}
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
                {view === 'dashboard' ? 'Workspaces' : 'Decible'}
              </span>
              {view !== 'dashboard' && (
                <>
                  <span className="text-gray-300">/</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {view === 'tts' ? 'Text to Speech' : view === 'library' || view === 'voice-creator' ? 'Voice Library' : view === 'subscription' ? 'Subscription' : view.replace(/-/g, ' ')}
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
              aria-label="Notifications"
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
              aria-label="Profile"
            >
              U
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative bg-white">
          {/* TTS is always mounted to preserve generation state across view switches */}
          <div className={baseView === 'tts' ? 'h-full' : 'hidden'}>
            <TextToSpeech onNavigate={setView} />
          </div>
          {baseView !== 'tts' && renderView()}
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
