import React, { useState } from 'react';
import { CreditCard, History, Settings, User, Loader2, RefreshCw, TrendingUp, TrendingDown, Crown, Check, ChevronRight, Bell, Shield, HelpCircle, LogOut, Mail, Calendar } from 'lucide-react';
import { useUserProfile, Transaction } from '@/hooks/useUserProfile';
import { useIsMobile } from '../../hooks/useIsMobile';
import { createClient } from '@/lib/supabase/client';

// Format number with commas
const formatNumber = (num: number): string => {
   return num.toLocaleString();
};

// Format date
const formatDate = (dateString: string): string => {
   const date = new Date(dateString);
   return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Calculate days until reset
const getDaysUntilReset = (resetDate: string): number => {
   const now = new Date();
   const reset = new Date(resetDate);
   const diffTime = reset.getTime() - now.getTime();
   return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Transaction row component
const TransactionRow: React.FC<{ transaction: Transaction; isMobile?: boolean }> = ({ transaction, isMobile }) => {
   const isPositive = transaction.amount > 0;

   if (isMobile) {
      return (
         <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
            <div>
               <div className="font-medium text-gray-900 text-sm">{transaction.type}</div>
               <div className="text-xs text-gray-500">{formatDate(transaction.date)}</div>
            </div>
            <div className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
               {isPositive ? '+' : ''}{formatNumber(transaction.amount)}
            </div>
         </div>
      );
   }

   return (
      <tr className="hover:bg-gray-50">
         <td className="px-6 py-4 text-sm text-gray-900">{formatDate(transaction.date)}</td>
         <td className="px-6 py-4 text-sm text-gray-600">{transaction.type}</td>
         <td className="px-6 py-4 text-sm font-medium flex items-center gap-1">
            {isPositive ? (
               <>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">+{formatNumber(transaction.amount)}</span>
               </>
            ) : (
               <>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">{formatNumber(transaction.amount)}</span>
               </>
            )}
         </td>
         <td className="px-6 py-4">
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${transaction.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
               }`}>
               {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </span>
         </td>
      </tr>
   );
};

interface ProfileProps {
   onLogout?: () => void;
   onNavigate?: (view: string) => void;
}

export const Profile: React.FC<ProfileProps> = ({ onLogout, onNavigate }) => {
   const isMobile = useIsMobile();
   const { profile, transactions, plans, isLoading, error, refetch } = useUserProfile();
   const isFreePlan = !profile?.plan || profile.plan === 'free';
   const [activeSection, setActiveSection] = useState<'overview' | 'history' | 'settings'>('overview');

   // Loading state
   if (isLoading) {
      return (
         <div className="p-4 md:p-8 flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">Loading profile...</span>
         </div>
      );
   }

   // Error state
   if (error) {
      return (
         <div className="p-4 md:p-8 max-w-md mx-auto text-center">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
               <h3 className="font-bold text-red-800 mb-2">Failed to load profile</h3>
               <p className="text-red-600 text-sm mb-4">{error}</p>
               <button
                  onClick={refetch}
                  className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-semibold"
               >
                  Retry
               </button>
            </div>
         </div>
      );
   }

   // Calculate usage percentage
   const usagePercentage = profile
      ? Math.min(100, (profile.usedCredits / profile.totalCredits) * 100)
      : 0;

   // Get current plan details
   const currentPlan = plans.find(p => p.id === profile?.plan) || plans[0];

   // Settings menu items — actionable items wire to real views, others are coming soon
   const settingsItems = [
      { id: 'billing', icon: CreditCard, label: 'Plans & Billing', desc: 'Manage subscription and payment methods', action: () => onNavigate?.('subscription') },
      { id: 'help', icon: HelpCircle, label: 'Help & Support', desc: 'FAQs and contact support', action: () => onNavigate?.('help') },
      { id: 'account', icon: User, label: 'Account Details', desc: 'Profile name and email (coming soon)', comingSoon: true },
      { id: 'notifications', icon: Bell, label: 'Notifications', desc: 'Notification preferences (coming soon)', comingSoon: true },
      { id: 'security', icon: Shield, label: 'Security', desc: 'Password and 2FA (coming soon)', comingSoon: true },
   ];

   const handleLogout = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      if (onLogout) onLogout();
   };

   return (
      <div className={`max-w-5xl mx-auto h-full overflow-y-auto ${isMobile ? 'p-4 pb-32' : 'p-8'}`}>
         {/* Header */}
         <div className="flex items-center justify-between mb-6">
            <div>
               <h1 className={`font-bold text-gray-900 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Account</h1>
               <p className="text-gray-500 text-sm mt-1">
                  Manage your account and preferences
               </p>
            </div>
            <button
               onClick={refetch}
               className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
               title="Refresh"
            >
               <RefreshCw className="w-5 h-5 text-gray-500" />
            </button>
         </div>

         {/* Profile Card */}
         <div className={`bg-white border border-gray-200 rounded-2xl ${isMobile ? 'p-5 mb-4' : 'p-6 mb-6'}`}>
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : profile?.email ? profile.email.charAt(0).toUpperCase() : '?'}
               </div>
               <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">{profile?.name || profile?.email?.split('@')[0] || 'User'}</h2>
                  <div className="flex items-center gap-2 mt-1">
                     <Mail className="w-4 h-4 text-gray-400" />
                     <span className="text-sm text-gray-500">{profile?.email || 'email@example.com'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                     <Calendar className="w-4 h-4 text-gray-400" />
                     <span className="text-sm text-gray-500">Member since {profile?.createdAt ? formatDate(profile.createdAt) : 'N/A'}</span>
                  </div>
               </div>
            </div>
            {/* Inline plan badge */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
               <div className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${
                  isFreePlan ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700 border border-amber-200/50'
               }`}>
                  <Crown className="w-3 h-3 inline mr-1" />
                  {currentPlan?.name || 'Free'} Plan
               </div>
               {isFreePlan && (
                  <button
                     onClick={() => onNavigate?.('subscription')}
                     className="px-3 py-1 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                  >
                     Upgrade
                  </button>
               )}
            </div>
         </div>

         {/* Tab Navigation - Mobile */}
         {isMobile && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
               {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'history', label: 'History' },
                  { id: 'settings', label: 'Settings' },
               ].map(tab => (
                  <button
                     key={tab.id}
                     onClick={() => setActiveSection(tab.id as typeof activeSection)}
                     className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                        activeSection === tab.id
                           ? 'bg-gray-900 text-white'
                           : 'bg-gray-100 text-gray-600'
                     }`}
                  >
                     {tab.label}
                  </button>
               ))}
            </div>
         )}

         <div className={`grid gap-6 ${isMobile ? '' : 'grid-cols-3'}`}>
            {/* Left Column - Usage & Plan */}
            {(!isMobile || activeSection === 'overview') && (
               <div className={isMobile ? '' : 'col-span-2 space-y-6'}>
                  {/* Usage Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">Credit Usage</h3>
                        <span className="text-sm text-gray-500">
                           Resets in {getDaysUntilReset(profile?.resetDate || new Date().toISOString())} days
                        </span>
                     </div>

                     <div className="mb-6">
                        <div className="flex justify-between text-sm font-medium mb-2">
                           <span className="text-gray-600">Used this month</span>
                           <span className="text-gray-900">
                              {formatNumber(profile?.usedCredits || 0)} / {formatNumber(profile?.totalCredits || 0)}
                           </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                           <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                 usagePercentage > 90
                                    ? 'bg-red-500'
                                    : usagePercentage > 70
                                       ? 'bg-amber-500'
                                       : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.max(1, usagePercentage)}%` }}
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl text-center">
                           <div className="text-xl font-bold text-gray-900">
                              {formatNumber(profile?.totalCredits || 0)}
                           </div>
                           <div className="text-xs text-gray-500 mt-1">Total</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl text-center">
                           <div className="text-xl font-bold text-gray-900">
                              {formatNumber(profile?.usedCredits || 0)}
                           </div>
                           <div className="text-xs text-gray-500 mt-1">Used</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl text-center">
                           <div className="text-xl font-bold text-green-600">
                              {formatNumber(profile?.remainingCredits || 0)}
                           </div>
                           <div className="text-xs text-gray-500 mt-1">Remaining</div>
                        </div>
                     </div>
                  </div>

                  {/* Current Plan Card */}
                  <div className="bg-gray-900 rounded-2xl p-5 md:p-6 text-white">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                              <Crown className="w-5 h-5 text-amber-400" />
                           </div>
                           <div>
                              <div className="text-sm text-gray-400">Current Plan</div>
                              <div className="font-bold capitalize text-lg">{currentPlan?.name || 'Free'}</div>
                           </div>
                        </div>
                        <button
                           onClick={() => onNavigate?.('subscription')}
                           className="px-4 py-2 bg-white text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors"
                        >
                           {isFreePlan ? 'Upgrade' : 'Manage'}
                        </button>
                     </div>
                     {isFreePlan && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                           <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                                 <Check className="w-4 h-4 text-green-400" />
                                 <span>60+ videos/mo</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                                 <Check className="w-4 h-4 text-green-400" />
                                 <span>Premium voices</span>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* Right Column - Settings (Desktop) */}
            {!isMobile && (
               <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Quick Settings</h3>
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                     {settingsItems.map((item) => (
                        <button
                           key={item.id}
                           onClick={item.action}
                           disabled={item.comingSoon}
                           className={`w-full flex items-center gap-4 p-4 transition-colors text-left group ${
                              item.comingSoon ? 'opacity-50 cursor-default' : 'hover:bg-gray-50 cursor-pointer'
                           }`}
                        >
                           <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              item.comingSoon ? 'bg-gray-50' : 'bg-gray-100 group-hover:bg-gray-200'
                           }`}>
                              <item.icon className="w-5 h-5 text-gray-600" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                 <span className="font-semibold text-gray-900 text-[15px]">{item.label}</span>
                                 {item.comingSoon && (
                                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Soon</span>
                                 )}
                              </div>
                              <div className="text-sm text-gray-500 truncate">{item.desc}</div>
                           </div>
                           {!item.comingSoon && (
                              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 group-hover:text-gray-600 transition-colors" />
                           )}
                        </button>
                     ))}
                  </div>

                  <button
                     onClick={handleLogout}
                     className="w-full flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-2xl hover:bg-red-100 transition-colors text-left group"
                  >
                     <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-red-200 transition-colors">
                        <LogOut className="w-5 h-5 text-red-600" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="font-semibold text-red-700 text-[15px]">Log Out</div>
                        <div className="text-sm text-red-500">Sign out of your account</div>
                     </div>
                  </button>
               </div>
            )}
         </div>

         {/* Transaction History - Mobile Tab or Desktop Full Width */}
         {(!isMobile || activeSection === 'history') && (
            <div className={isMobile ? 'mt-4' : 'mt-8'}>
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Transaction History</h3>
                  <span className="text-sm text-gray-500">{transactions.length} transactions</span>
               </div>

               {isMobile ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4">
                     {transactions.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-sm">
                           No transactions yet
                        </div>
                     ) : (
                        transactions.map(tx => (
                           <TransactionRow key={tx.id} transaction={tx} isMobile />
                        ))
                     )}
                  </div>
               ) : (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                           <tr>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {transactions.map(tx => (
                              <TransactionRow key={tx.id} transaction={tx} />
                           ))}
                        </tbody>
                     </table>
                     {transactions.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                           No transactions yet
                        </div>
                     )}
                  </div>
               )}
            </div>
         )}

         {/* Settings - Mobile Tab */}
         {isMobile && activeSection === 'settings' && (
            <div className="space-y-3">
               {settingsItems.map((item) => (
                  <button
                     key={item.id}
                     onClick={item.action}
                     disabled={item.comingSoon}
                     className={`w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl transition-colors text-left ${
                        item.comingSoon ? 'opacity-50' : 'active:bg-gray-50'
                     }`}
                  >
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        item.comingSoon ? 'bg-gray-50' : 'bg-gray-100'
                     }`}>
                        <item.icon className="w-5 h-5 text-gray-600" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                           <span className="font-semibold text-gray-900 text-[15px]">{item.label}</span>
                           {item.comingSoon && (
                              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Soon</span>
                           )}
                        </div>
                        <div className="text-sm text-gray-500 line-clamp-1">{item.desc}</div>
                     </div>
                     {!item.comingSoon && (
                        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                     )}
                  </button>
               ))}

               <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-2xl active:bg-red-100 transition-colors text-left mt-4"
               >
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                     <LogOut className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="font-semibold text-red-700 text-[15px]">Log Out</div>
                     <div className="text-sm text-red-500">Sign out of your account</div>
                  </div>
               </button>
            </div>
         )}
      </div>
   );
};
