import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Mic, Music, Users, MessageSquare, Menu, ChevronRight, ChevronDown, Plus, Edit2, Check, Sparkles, Home, Trash2, HelpCircle, Settings, CreditCard, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserProfile } from '@/hooks/useUserProfile';
import { createClient } from '@/lib/supabase/client';
import DecibleLogo from './DecibleLogo';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isCollapsed: boolean;
  onLogout?: () => void;
}

interface Workspace {
  id: string;
  name: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isCollapsed, onLogout }) => {
  // Fetch real user profile
  const { profile, isLoading: profileLoading } = useUserProfile();

  // Workspace State
  // No change needed for state names if they are already "Workspace". checking UI rendering next.
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: 'ws-default', name: 'My Workspace' }
  ]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-default');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsWorkspaceOpen(false);
        setEditingWorkspaceId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateWorkspace = () => {
    if (workspaces.length >= 5) return;
    const newId = `ws-${Date.now()}`;
    setWorkspaces([...workspaces, { id: newId, name: `Workspace ${workspaces.length + 1}` }]);
    setActiveWorkspaceId(newId);
    setIsWorkspaceOpen(false);
  };

  const handleStartRename = (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkspaceId(ws.id);
    setEditName(ws.name);
  };

  const handleSaveRename = () => {
    if (editingWorkspaceId) {
      setWorkspaces(workspaces.map(ws => ws.id === editingWorkspaceId ? { ...ws, name: editName } : ws));
      setEditingWorkspaceId(null);
    }
  };

  const handleDeleteWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (workspaces.length <= 1) return; // Prevent deleting the last workspace

    const newWorkspaces = workspaces.filter(ws => ws.id !== id);
    setWorkspaces(newWorkspaces);

    // If we deleted the active one, switch to the first available
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(newWorkspaces[0].id);
    }
  };

  const activeWorkspace = workspaces.find(ws => ws.id === activeWorkspaceId) || workspaces[0];

  // Format credits for display
  const formatCredits = (num: number): string => {
    if (num >= 10000) return `${(num / 1000).toFixed(0)}k`;
    return num.toLocaleString();
  };

  // Get user initials
  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Home' },
    { id: 'tts', icon: Mic, label: 'Text to Speech' },
    { id: 'library', icon: Users, label: 'Voices' },
    { id: 'create', icon: Plus, label: 'Create Voice' },
    { id: 'help', icon: HelpCircle, label: 'Help Center' },
  ];

  // Removed "Coming Soon" and other extra items as per feedback

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="border-r border-gray-100 h-screen flex flex-col bg-white overflow-y-auto shrink-0 z-30 font-medium relative group"
    >
      <div className={`p-4 flex flex-col h-full ${isCollapsed ? 'items-center' : ''}`}>

        {/* Logo Area */}
        <div className={`flex items-center gap-3 mb-6 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
          <DecibleLogo size={30} className="text-gray-900 shrink-0" />
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold tracking-tight text-gray-900 whitespace-nowrap"
            >
              Decible
            </motion.span>
          )}
        </div>

        {/* Workspace Dropdown */}
        {!isCollapsed && (
          <div className="mb-6 relative" ref={dropdownRef}>
            <button
              onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-1.5 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-red-100 text-red-600 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-[14px] font-semibold text-gray-800 truncate group-hover:text-gray-900">
                  {activeWorkspace?.name || 'Workspace'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isWorkspaceOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isWorkspaceOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.id}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-sm cursor-pointer group/item ${activeWorkspaceId === ws.id ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        onClick={() => {
                          if (!editingWorkspaceId) {
                            setActiveWorkspaceId(ws.id);
                            setIsWorkspaceOpen(false);
                          }
                        }}
                      >
                        {editingWorkspaceId === ws.id ? (
                          <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              autoFocus
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 min-w-0 bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-indigo-400"
                            />
                            <button onClick={handleSaveRename} className="text-green-600 hover:bg-green-50 p-1 rounded">
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 truncate flex-1">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeWorkspaceId === ws.id ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <span className="truncate">{ws.name}</span>
                            </div>

                            <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => handleStartRename(ws, e)}
                                title="Rename Workspace"
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {workspaces.length > 1 && (
                                <button
                                  onClick={(e) => handleDeleteWorkspace(ws.id, e)}
                                  title="Delete Workspace"
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {workspaces.length < 5 && (
                    <div className="p-1.5 border-t border-gray-100">
                      <button
                        onClick={handleCreateWorkspace}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>New Workspace</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Main Nav */}
        <div className="space-y-1 w-full flex-1">
          {menuItems.map((item) => {
            const isActive = currentView === item.id || (item.id === 'dashboard' && currentView === 'landing'); // Handle landing as dashboard for highlighting

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`group relative w-full flex rounded-xl transition-all duration-200 ${
                  isCollapsed
                    ? 'flex-col items-center justify-center py-2 px-1'
                    : 'flex-row items-center gap-3.5 px-3.5 py-2.5'
                } ${isActive ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {isCollapsed ? (
                  <span className="text-[10px] mt-1 text-center leading-tight">{item.label.split(' ')[0]}</span>
                ) : (
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                )}
              </button>
            )
          })}

          {/* Bottom User Profile with Hover Dropdown */}
          <div className={`mt-auto pt-4 border-t border-gray-100 w-full ${isCollapsed ? 'flex justify-center' : ''} relative group/profile`}>
            <div
              className={`flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-all ${isCollapsed ? 'justify-center' : ''}`}
            >
              {profileLoading ? (
                <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                  {getInitials(profile?.name || 'Demo User')}
                </div>
              )}

              {!isCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-bold text-gray-900 truncate">{profile?.name || 'Demo User'}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {formatCredits(profile?.remainingCredits || 0)} Credits
                  </div>
                </div>
              )}
            </div>

            {/* Hover Dropdown Menu */}
            <div className="absolute bottom-full left-0 right-0 mb-2 opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-50">
              <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden py-1">
                <button
                  onClick={() => onNavigate('profile')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => onNavigate('subscription')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span>Subscription</span>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    if (onLogout) onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};
