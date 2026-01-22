import React from 'react';
import { CreditCard, History, Settings, User, Zap, Loader2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useUserProfile, Transaction } from '@/hooks/useUserProfile';

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
const TransactionRow: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
   const isPositive = transaction.amount > 0;

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

export const Profile: React.FC = () => {
   const { profile, transactions, plans, isLoading, error, refetch } = useUserProfile();

   // Loading state
   if (isLoading) {
      return (
         <div className="p-8 flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">Loading profile...</span>
         </div>
      );
   }

   // Error state
   if (error) {
      return (
         <div className="p-8 max-w-md mx-auto text-center">
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

   return (
      <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
         <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
            <button
               onClick={refetch}
               className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
               title="Refresh"
            >
               <RefreshCw className="w-5 h-5 text-gray-500" />
            </button>
         </div>
         <p className="text-gray-500 mb-10">
            Welcome back, <span className="font-medium text-gray-900">{profile?.name || 'User'}</span>
         </p>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Usage Card */}
            <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Zap className="w-32 h-32" />
               </div>
               <h2 className="text-lg font-bold mb-6">Subscription Usage</h2>

               <div className="mb-8">
                  <div className="flex justify-between text-sm font-medium mb-2">
                     <span>Characters used</span>
                     <span className="text-gray-900">
                        {formatNumber(profile?.usedCredits || 0)} / {formatNumber(profile?.totalCredits || 0)}
                     </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                     <div
                        className={`h-3 rounded-full transition-all duration-500 ${usagePercentage > 90
                              ? 'bg-gradient-to-r from-red-400 to-red-600'
                              : usagePercentage > 70
                                 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                                 : 'bg-gradient-to-r from-green-400 to-green-600'
                           }`}
                        style={{ width: `${Math.max(1, usagePercentage)}%` }}
                     />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                     Resets in {getDaysUntilReset(profile?.resetDate || new Date().toISOString())} days
                  </p>
               </div>

               <div className="grid grid-cols-3 gap-6">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                     <div className="text-2xl font-bold text-gray-900">
                        {formatNumber(profile?.totalCredits || 0)}
                     </div>
                     <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Total Credits</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                     <div className="text-2xl font-bold text-gray-900">
                        {formatNumber(profile?.remainingCredits || 0)}
                     </div>
                     <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Remaining</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                     <div className="text-2xl font-bold text-gray-900 capitalize">
                        {profile?.plan || 'Free'}
                     </div>
                     <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Current Plan</div>
                  </div>
               </div>
            </div>

            {/* Plan Details */}
            <div className="bg-gray-900 rounded-2xl p-8 text-white flex flex-col justify-between shadow-xl shadow-gray-200">
               <div>
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6">
                     <User className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold mb-2 capitalize">{currentPlan?.name || 'Free'} Plan</h2>
                  <p className="text-gray-400 text-sm mb-4">
                     {formatNumber(currentPlan?.credits || 10000)} characters/month
                  </p>
                  <p className="text-gray-400 text-sm">
                     {currentPlan?.voiceSlots || 5} voice slots included
                  </p>
               </div>
               <button
                  onClick={() => alert('Contact support@nmm.ai to upgrade your plan')}
                  className="w-full py-3 bg-white text-black font-bold rounded-full hover:bg-gray-100 transition-colors mt-6"
               >
                  Upgrade Plan
               </button>
            </div>
         </div>

         {/* Transactions / History */}
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Credit History</h2>
            <span className="text-sm text-gray-500">{transactions.length} transactions</span>
         </div>
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
            {transactions.length > 0 && transactions.length < 5 && (
               <div className="p-4 text-center text-gray-400 text-sm border-t border-gray-100">
                  All transactions shown
               </div>
            )}
         </div>

         {/* Upgrade Plans */}
         <div className="mt-12">
            <h2 className="text-xl font-bold mb-6">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               {plans.map(plan => (
                  <div
                     key={plan.id}
                     className={`p-6 rounded-xl border transition-all ${plan.id === profile?.plan
                           ? 'border-black bg-gray-50'
                           : 'border-gray-200 hover:border-gray-400'
                        }`}
                  >
                     <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                     <p className="text-2xl font-bold mb-3">
                        {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
                     </p>
                     <ul className="text-sm text-gray-600 space-y-2">
                        <li>• {formatNumber(plan.credits)} characters</li>
                        <li>• {plan.voiceSlots} voice slots</li>
                     </ul>
                     {plan.id === profile?.plan ? (
                        <div className="mt-4 py-2 text-center text-sm font-semibold text-gray-500">
                           Current Plan
                        </div>
                     ) : (
                        <button
                           onClick={() => alert('Contact support@nmm.ai to change your plan')}
                           className="mt-4 w-full py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                        >
                           {plan.price > (plans.find(p => p.id === profile?.plan)?.price || 0) ? 'Upgrade' : 'Downgrade'}
                        </button>
                     )}
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
};
