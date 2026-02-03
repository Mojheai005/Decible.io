import React, { useState } from 'react';
import { X, Mail, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setGoogleLoading(false);
      }
      // If no error, browser will redirect to Google OAuth
    } catch {
      setError('Failed to connect to Google. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = () => {
    // Navigate to the dedicated login page with email/password form
    window.location.href = '/login';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 overflow-hidden"
          >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-black transition-colors rounded-full hover:bg-gray-50"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                    <span className="text-white font-bold text-lg">dB</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
                <p className="text-gray-500 text-sm">Sign in to continue to Decible</p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}

            <div className="space-y-4">
                <button
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium text-gray-700 bg-white shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {googleLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
                    )}
                    {googleLoading ? 'Connecting...' : 'Continue with Google'}
                </button>

                <button
                    onClick={handleEmailLogin}
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-black text-white rounded-xl hover:bg-gray-800 transition-all font-bold shadow-lg shadow-gray-200 active:scale-95"
                >
                    <Mail className="w-5 h-5" />
                    Continue with Email
                </button>
            </div>

            <div className="mt-8 text-center">
                <p className="text-xs text-gray-400">
                    By clicking continue, you agree to our <a href="/terms" className="underline hover:text-gray-800">Terms of Service</a> and <a href="/privacy" className="underline hover:text-gray-800">Privacy Policy</a>.
                </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
