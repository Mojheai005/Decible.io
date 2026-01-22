import React, { useState } from 'react';
import { HelpCircle, Mail, ChevronDown, ChevronUp, Book, CreditCard, Settings, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  icon: React.ElementType;
  items: FAQItem[];
}

const faqSections: FAQSection[] = [
  {
    title: 'Getting Started',
    icon: Book,
    items: [
      {
        question: 'How do I generate my first voice?',
        answer: 'Navigate to "Text to Speech" from the sidebar, select a voice from the dropdown, enter your text, and click "Generate Speech". Your audio will be ready in seconds.'
      },
      {
        question: 'What voices are available?',
        answer: 'We offer 100+ premium voices across 50+ languages. Browse our voice library to preview and select voices that match your needs.'
      },
      {
        question: 'How do I clone my own voice?',
        answer: 'Go to "Create Voice" in the sidebar. Upload a clear audio sample of at least 30 seconds, and our AI will create a custom voice clone for you.'
      },
    ]
  },
  {
    title: 'Billing & Credits',
    icon: CreditCard,
    items: [
      {
        question: 'How do credits work?',
        answer: 'Credits are consumed based on the number of characters you convert to speech. 1 character = 1 credit. New users receive 5,000 free credits to start.'
      },
      {
        question: 'How do I upgrade my plan?',
        answer: 'Visit your Profile page and click on the plan you want to upgrade to. For enterprise plans, contact us at support@decibal.io.'
      },
      {
        question: 'Do unused credits roll over?',
        answer: 'Monthly credits reset at the start of each billing cycle. Consider upgrading your plan if you consistently need more credits.'
      },
    ]
  },
  {
    title: 'Technical Support',
    icon: Settings,
    items: [
      {
        question: 'What audio formats are supported?',
        answer: 'Generated audio is available in MP3 format. For voice cloning uploads, we accept MP3, WAV, and M4A files.'
      },
      {
        question: 'Is there an API available?',
        answer: 'Yes! Our API allows you to integrate Decibal voice generation into your applications. Contact support@decibal.io for API access.'
      },
      {
        question: 'My generation failed. What should I do?',
        answer: 'Try again with a shorter text segment. If the issue persists, check your internet connection or contact support@decibal.io.'
      },
    ]
  },
];

const FAQAccordion: React.FC<{ section: FAQSection }> = ({ section }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
        <section.icon className="w-5 h-5 text-gray-600" />
        <h3 className="font-bold text-gray-900">{section.title}</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {section.items.map((item, index) => (
          <div key={index}>
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-800 pr-4">{item.question}</span>
              {openIndex === index ? (
                <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
              )}
            </button>
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export const HelpCenter: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/20">
          <HelpCircle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Help Center</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          Find answers to common questions or reach out to our support team.
        </p>
      </motion.div>

      {/* Contact Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6 mb-10"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <Mail className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900 mb-1">Need more help?</h2>
            <p className="text-gray-600 text-sm mb-3">
              Our support team is here to assist you with any questions.
            </p>
            <a
              href="mailto:support@decibal.io"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Contact Support
            </a>
            <p className="text-xs text-gray-500 mt-2">support@decibal.io</p>
          </div>
        </div>
      </motion.div>

      {/* FAQ Sections */}
      <div className="space-y-6">
        {faqSections.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <FAQAccordion section={section} />
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-center"
      >
        <p className="text-sm text-gray-400">
          Can't find what you're looking for?{' '}
          <a href="mailto:support@decibal.io" className="text-purple-600 hover:underline">
            Email us directly
          </a>
        </p>
      </motion.div>
    </div>
  );
};
