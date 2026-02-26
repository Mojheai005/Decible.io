import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LandingPage } from './components/views/LandingPage';
import { Dashboard } from './components/views/Dashboard';
import { TextToSpeech } from './components/views/TextToSpeech';
import { VoiceLibrary } from './components/views/VoiceLibrary';
import { Profile } from './components/views/Profile';
import { Subscription } from './components/views/Subscription';
import { HelpCenter } from './components/views/HelpCenter';
import { Bell, Menu, FileAudio, Coins, HelpCircle } from 'lucide-react';
import DecibleLogo from './components/DecibleLogo';
import { useUserProfile, clearProfileCache, prefetchProfile } from './src/hooks/useUserProfile';
import { AudioProvider } from './src/contexts/GlobalAudioContext';
import { NotificationProvider, useNotifications } from './src/contexts/NotificationContext';
import { GlobalPlayer } from './components/GlobalPlayer';
import { ToastContainer } from './components/ui/Toast';
import { NotificationDropdown } from './components/ui/NotificationDropdown';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from './hooks/useIsMobile';

const AppContent: React.FC = () => {
  const [view, setView] = useState('landing');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const isLoggedInRef = useRef(false);
  const isMobile = useIsMobile(768);

  const { unreadCount, addNotification, showToast } = useNotifications();
  const { profile } = useUserProfile(isLoggedIn);

  // Keep ref in sync with state to avoid stale closures
  useEffect(() => { isLoggedInRef.current = isLoggedIn; }, [isLoggedIn]);

  // Check real Supabase auth state on mount
  useEffect(() => {
    const supabase = createClient();

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: unknown } }) => {
      if (session) {
        prefetchProfile(); // Start fetching profile in parallel with React re-render
        setIsLoggedIn(true);
        setView('dashboard');
      }
      setIsLoading(false);
    });

    // Listen for auth state changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (event === 'SIGNED_IN' && session) {
        // Only navigate to dashboard on INITIAL sign-in, not on token refresh
        if (!isLoggedInRef.current) {
          // Prefetch profile IMMEDIATELY — before React re-renders and mounts useUserProfile hooks
          // This eliminates the waterfall: auth → re-render → fetch profile
          prefetchProfile();
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
        clearProfileCache();
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
    clearProfileCache();
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
      {/* Sidebar - hidden on mobile */}
      {!isMobile && (
        <Sidebar
          currentView={view}
          onNavigate={setView}
          isCollapsed={isSidebarCollapsed}
          onLogout={handleLogout}
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white relative">
        {/* Header - simplified on mobile */}
        <header className={`border-b border-gray-100 flex items-center justify-between bg-white shrink-0 z-20 ${isMobile ? 'h-14 px-4' : 'h-16 px-6'}`}>
          <div className="flex items-center gap-3 text-sm">
            {!isMobile && (
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-black"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            {/* Mobile: Show logo + app name */}
            {isMobile ? (
              <button
                onClick={() => setView('dashboard')}
                className="flex items-center gap-2"
              >
                <DecibleLogo size={28} className="text-gray-900" />
                <span className="font-bold text-gray-900 text-base">Decible</span>
              </button>
            ) : (
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
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Help/Support - Mobile only */}
            {isMobile && (
              <button
                onClick={() => setView('help')}
                className="p-2.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                aria-label="Help & Support"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            )}

            {/* Credits Indicator Pill — color-coded by remaining % */}
            {(() => {
              const remaining = profile?.remainingCredits ?? 0;
              const total = profile?.totalCredits ?? 1;
              const pct = total > 0 ? (remaining / total) * 100 : 100;
              const isLow = pct <= 20;
              const isMedium = pct > 20 && pct <= 50;

              const pillBg = isLow
                ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200/60'
                : isMedium
                  ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/60'
                  : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/60';
              const iconColor = isLow ? 'text-red-500' : isMedium ? 'text-amber-600' : 'text-emerald-600';
              const textColor = isLow ? 'text-red-700' : isMedium ? 'text-amber-700' : 'text-emerald-700';

              return (
                <button
                  onClick={() => setView('subscription')}
                  className={`flex items-center gap-1.5 border rounded-full transition-all hover:shadow-sm active:scale-95 ${pillBg} ${
                    isMobile ? 'px-2.5 py-1.5' : 'px-3 py-1.5'
                  }`}
                >
                  <Coins className={`${iconColor} ${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                  <span className={`font-semibold ${textColor} ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {remaining > 0 ? remaining.toLocaleString() : '0'}
                  </span>
                  {isLow && (
                    <span className={`bg-red-500 text-white font-bold rounded-full ${isMobile ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-1.5 py-0.5'}`}>
                      Low
                    </span>
                  )}
                </button>
              );
            })()}

            {/* Notification Bell with Dropdown */}
            <button
              ref={bellButtonRef}
              onClick={() => setShowNotifications(!showNotifications)}
              className={`hover:bg-gray-100 rounded-full text-gray-500 relative transition-colors ${isMobile ? 'p-2.5' : 'p-2'}`}
              aria-label="Notifications"
            >
              <Bell className={isMobile ? 'w-5 h-5' : 'w-5 h-5'} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 bg-red-500 rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center">
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

            {!isMobile && (
              <button
                onClick={() => setView('profile')}
                className="w-8 h-8 bg-gradient-to-tr from-gray-800 to-gray-700 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-transparent hover:ring-gray-200 transition-all"
                aria-label="Profile"
              >
                {profile?.name ? profile.name.charAt(0).toUpperCase() : profile?.email ? profile.email.charAt(0).toUpperCase() : '?'}
              </button>
            )}
          </div>
        </header>

        {/* Main content - add bottom padding on mobile for nav bar */}
        <main className={`flex-1 overflow-y-auto relative bg-white ${isMobile ? 'pb-20' : ''}`}>
          {/* TTS is always mounted to preserve generation state across view switches */}
          <div className={baseView === 'tts' ? 'h-full' : 'hidden'}>
            <TextToSpeech onNavigate={setView} isMobile={isMobile} />
          </div>
          {baseView !== 'tts' && renderView()}
        </main>

        <GlobalPlayer isMobile={isMobile} />
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav currentView={view} onNavigate={setView} />
      )}

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
