import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Share2, Link, MessageCircle } from 'lucide-react';

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  audioUrl?: string;
  title?: string;
  onDownload?: () => void;
  onCopyLink?: () => void;
}

export const ShareSheet: React.FC<ShareSheetProps> = ({
  isOpen,
  onClose,
  audioUrl,
  title = 'Share Audio',
  onDownload,
  onCopyLink,
}) => {
  const handleNativeShare = async () => {
    if (navigator.share && audioUrl) {
      try {
        await navigator.share({
          title: 'Audio from Decible',
          text: 'Check out this AI-generated voice!',
          url: audioUrl,
        });
        onClose();
      } catch (err) {
        // User cancelled or error
      }
    }
  };

  const handleCopyLink = () => {
    if (audioUrl) {
      navigator.clipboard.writeText(audioUrl);
      onCopyLink?.();
      onClose();
    }
  };

  const shareOptions = [
    {
      id: 'download',
      icon: Download,
      label: 'Download',
      sublabel: 'Save to device',
      onClick: () => { onDownload?.(); onClose(); },
      color: 'bg-blue-500',
    },
    {
      id: 'copy',
      icon: Link,
      label: 'Copy Link',
      sublabel: 'Share anywhere',
      onClick: handleCopyLink,
      color: 'bg-gray-700',
    },
    ...(typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? [{
      id: 'share',
      icon: Share2,
      label: 'More Options',
      sublabel: 'Share to apps',
      onClick: handleNativeShare,
      color: 'bg-green-500',
    }] : []),
  ];

  // Social share URLs (web fallback)
  const socialOptions = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: '💬',
      url: `https://wa.me/?text=${encodeURIComponent(`Check out this AI voice: ${audioUrl}`)}`,
    },
    {
      id: 'twitter',
      label: 'Twitter',
      icon: '𝕏',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this AI voice from Decible!`)}&url=${encodeURIComponent(audioUrl || '')}`,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: '📨',
      url: `https://t.me/share/url?url=${encodeURIComponent(audioUrl || '')}&text=${encodeURIComponent('AI voice from Decible')}`,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4">
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Primary Actions */}
            <div className="px-5 pb-6">
              <div className="flex gap-3">
                {shareOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={option.onClick}
                    className="flex-1 flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl active:bg-gray-100 transition-colors"
                  >
                    <div className={`w-12 h-12 ${option.color} rounded-full flex items-center justify-center text-white`}>
                      <option.icon className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">{option.label}</div>
                      <div className="text-[11px] text-gray-500">{option.sublabel}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Social Options */}
            {audioUrl && (
              <div className="px-5 pb-8 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Share to
                </p>
                <div className="flex gap-4">
                  {socialOptions.map((social) => (
                    <a
                      key={social.id}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2"
                      onClick={onClose}
                    >
                      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl active:bg-gray-200 transition-colors">
                        {social.icon}
                      </div>
                      <span className="text-xs text-gray-600">{social.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShareSheet;
