import React from 'react';
import { X, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin }) => {
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
                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-black/20">
                    <span className="text-white font-bold text-lg">II</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
                <p className="text-gray-500 text-sm">Sign in to continue to ElevenLabs</p>
            </div>

            <div className="space-y-4">
                <button
                    onClick={onLogin}
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium text-gray-700 bg-white shadow-sm group"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
                    Continue with Google
                </button>

                <button
                    onClick={onLogin}
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-black text-white rounded-xl hover:bg-gray-800 transition-all font-bold shadow-lg shadow-gray-200 active:scale-95"
                >
                    <Mail className="w-5 h-5" />
                    Continue with Email
                </button>
            </div>

            <div className="mt-8 text-center">
                <p className="text-xs text-gray-400">
                    By clicking continue, you agree to our <a href="#" className="underline hover:text-gray-800">Terms of Service</a> and <a href="#" className="underline hover:text-gray-800">Privacy Policy</a>.
                </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
