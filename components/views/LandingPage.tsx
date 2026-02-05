import React, { useState } from 'react';
import { Play, Mic, Sparkles, Loader2, ArrowRight, Check, PlayCircle, Github, Twitter, Linkedin, Users, Globe, Zap, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShaderAvatar, ShaderType } from '../ui/ShaderAvatar';
import { AuthModal } from '../modals/AuthModal';
import DecibleLogo from '../DecibleLogo';

export const LandingPage: React.FC = () => {
  const [demoText, setDemoText] = useState("In the ancient land of Eldoria, where skies shimmered and forests whispered secrets to the wind, lived a dragon named Zephyros.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeVoice, setActiveVoice] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      question: "How is Decible different from other AI voiceover tools?",
      answer: "Unlike generic AI voice tools, Decible is purpose-built for faceless YouTube creators. Our voices are trained to deliver natural emotional expression, perfect pacing for video content, and consistent quality across long-form scripts. We focus on the specific needs of YouTube automation — not just text-to-speech."
    },
    {
      question: "Is Decible suitable for faceless YouTube channels?",
      answer: "Absolutely! Decible was created specifically for faceless YouTube channels. Whether you run a documentary channel, finance explainers, tech reviews, or storytelling content — our voices are optimized for the engagement patterns that work on YouTube. Many channels with 100K+ subscribers trust Decible for their daily content."
    },
    {
      question: "Will Decible voices sound like AI to my audience?",
      answer: "No. Our advanced voice models are trained to capture human nuances — natural pauses, emotional inflections, and conversational flow. Viewers consistently cannot distinguish Decible voices from human narrators. We've specifically eliminated the robotic patterns that plague other AI tools."
    },
    {
      question: "Can I use Decible for different YouTube niches?",
      answer: "Yes! We have voices optimized for every major YouTube niche: documentary narration, Reddit stories, true crime, finance/crypto, tech reviews, motivational content, ASMR, and more. You can also fine-tune voice settings like pace, emotion, and style to match your channel's unique tone."
    },
    {
      question: "Is Decible affordable for new and growing creators?",
      answer: "We designed our pricing specifically for creators at every stage. Start free with 5,000 credits to test the platform. Our paid plans start at just ₹395/month — a fraction of what you'd pay for human voiceover artists or competitors like ElevenLabs. As your channel grows, Decible scales with you."
    }
  ];

  const voices = [
    { name: 'Mark', tag: 'Casual and Conversational', shader: 'fluid' },
    { name: 'Spuds Oxley', tag: 'Wise and Approachable', shader: 'chrome' },
    { name: 'Rachel', tag: 'Calm and Soothing', shader: 'orb' },
    { name: 'Adam', tag: 'Deep and Narrator-like', shader: 'waves' },
    { name: 'Nicole', tag: 'Whisper and ASMR', shader: 'neon' },
  ];

  const handleDemoGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowAuth(true);
    }, 1200);
  };

  // DecibleLogo is now imported from components/DecibleLogo

  // Flowing wave SVG component for background decoration
  const FlowingWave = ({ className, direction = 'left' }: { className?: string; direction?: 'left' | 'right' }) => (
    <svg
      className={className}
      viewBox="0 0 1200 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`waveGradient-${direction}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.3" />
          <stop offset="25%" stopColor="#9ca3af" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#6b7280" stopOpacity="0.6" />
          <stop offset="75%" stopColor="#9ca3af" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`waveGradient2-${direction}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d1d5db" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#4b5563" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#d1d5db" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {direction === 'left' ? (
        <>
          <path
            d="M0 150 C200 50, 400 250, 600 150 C800 50, 1000 250, 1200 150 L1200 300 L0 300 Z"
            fill={`url(#waveGradient-${direction})`}
          />
          <path
            d="M0 180 C150 100, 350 220, 550 160 C750 100, 950 220, 1200 160 L1200 300 L0 300 Z"
            fill={`url(#waveGradient2-${direction})`}
          />
          <path
            d="M0 200 C100 140, 300 240, 500 180 C700 120, 900 240, 1200 180"
            stroke="url(#waveGradient-${direction})"
            strokeWidth="3"
            fill="none"
            opacity="0.6"
          />
        </>
      ) : (
        <>
          <path
            d="M1200 150 C1000 50, 800 250, 600 150 C400 50, 200 250, 0 150 L0 300 L1200 300 Z"
            fill={`url(#waveGradient-${direction})`}
          />
          <path
            d="M1200 180 C1050 100, 850 220, 650 160 C450 100, 250 220, 0 160 L0 300 L1200 300 Z"
            fill={`url(#waveGradient2-${direction})`}
          />
          <path
            d="M1200 200 C1100 140, 900 240, 700 180 C500 120, 300 240, 0 180"
            stroke="url(#waveGradient-${direction})"
            strokeWidth="3"
            fill="none"
            opacity="0.6"
          />
        </>
      )}
    </svg>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased overflow-x-hidden">
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />

      {/* ============================================
          NAVIGATION - Clean, minimal, proper spacing
          ============================================ */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <DecibleLogo size={32} className="text-gray-900" />
            <span className="text-lg font-semibold tracking-tight">Decible</span>
          </div>

          {/* Nav Links - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => setShowAuth(true)} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Text to Speech
            </button>
            <button onClick={() => setShowAuth(true)} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Voices
            </button>
            <button onClick={() => window.scrollTo({ top: document.body.scrollHeight * 0.5, behavior: 'smooth' })} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </button>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAuth(true)} className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block">
              Log in
            </button>
            <button
              onClick={() => setShowAuth(true)}
              className="h-10 px-5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* ============================================
            HERO SECTION - Clear hierarchy, proper spacing
            ============================================ */}
        <section className="pt-28 pb-10 px-6 relative">
          {/* Left flowing wave decoration */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[400px] h-[600px] pointer-events-none opacity-60 -translate-x-1/2">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1.2, delay: 0.5 }}
              className="w-full h-full"
            >
              <FlowingWave className="w-full h-full rotate-90" direction="left" />
            </motion.div>
          </div>

          {/* Right flowing wave decoration */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[400px] h-[600px] pointer-events-none opacity-60 translate-x-1/2">
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1.2, delay: 0.5 }}
              className="w-full h-full"
            >
              <FlowingWave className="w-full h-full -rotate-90" direction="right" />
            </motion.div>
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 h-8 px-4 mb-6 bg-gray-100 rounded-full"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm text-gray-600">Decible v1 — Now Available</span>
            </motion.div>

            {/* Headline - 48px mobile, 64px desktop */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-gray-900 mb-6 leading-[1.1]"
            >
              Best AI Voiceover Tool
              <br />
              <span className="text-gray-400">for Faceless Youtube.</span>
            </motion.h1>

            {/* Subheadline - 18px */}
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              Real human voices built for YouTube: Alive with human emotions, customised for every niche, priced for creators who want to scale.
            </motion.p>

            {/* CTA Buttons - Proper 48px height touch targets */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
            >
              <button
                onClick={() => setShowAuth(true)}
                className="w-full sm:w-auto h-12 px-8 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAuth(true)}
                className="w-full sm:w-auto h-12 px-8 bg-white border border-gray-200 text-gray-700 font-medium rounded-full hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                Listen to Samples
              </button>
            </motion.div>

          </div>
        </section>

        {/* ============================================
            INTERACTIVE DEMO - Clean card design
            ============================================ */}
        <section className="px-6 pb-16 relative">
          {/* Left wave decoration for demo section */}
          <div className="absolute left-0 top-0 w-[350px] h-[500px] pointer-events-none opacity-40 -translate-x-2/3 hidden lg:block">
            <FlowingWave className="w-full h-full rotate-[100deg]" direction="left" />
          </div>

          {/* Right wave decoration for demo section */}
          <div className="absolute right-0 bottom-0 w-[350px] h-[500px] pointer-events-none opacity-40 translate-x-2/3 hidden lg:block">
            <FlowingWave className="w-full h-full -rotate-[100deg]" direction="right" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="max-w-6xl mx-auto bg-white rounded-3xl border border-gray-200 shadow-xl shadow-gray-100 overflow-hidden relative z-10"
          >
            <div className="flex flex-col lg:flex-row min-h-[560px]">
              {/* Left Panel - Voice Selection */}
              <div className="w-full lg:w-80 p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Voices</span>
                  <span className="text-xs font-medium text-gray-900 bg-white px-2.5 py-1 rounded-md border border-gray-200">
                    Decible v1
                  </span>
                </div>

                <div className="space-y-2">
                  {voices.map((voice, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveVoice(i)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        activeVoice === i
                          ? 'bg-white border border-gray-200 shadow-sm'
                          : 'hover:bg-white/60'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white">
                        <ShaderAvatar type={voice.shader as ShaderType} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{voice.name}</div>
                        <div className="text-xs text-gray-400 truncate">{voice.tag}</div>
                      </div>
                      {activeVoice === i && (
                        <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel - Text Editor */}
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="h-14 px-6 border-b border-gray-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-sm font-medium text-gray-700">Try generating your first voice</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Feature Toggle Buttons */}
                    {[
                      { label: 'Text to Speech', active: true },
                      { label: 'Voice Cloning', active: false },
                    ].map((pill, i) => (
                      <button
                        key={i}
                        className={`h-8 px-4 rounded-full flex items-center gap-1.5 text-xs font-medium transition-all ${
                          pill.active
                            ? 'bg-gray-900 text-white'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <Mic className="w-3 h-3" />
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Area */}
                <div className="flex-1 p-6 relative">
                  <textarea
                    className="w-full h-full bg-transparent text-xl md:text-2xl text-gray-800 leading-relaxed resize-none focus:outline-none placeholder:text-gray-300"
                    value={demoText}
                    onChange={(e) => setDemoText(e.target.value.slice(0, 100))}
                    placeholder="Type something here..."
                    spellCheck={false}
                  />
                </div>

                {/* Footer */}
                <div className="h-20 px-6 border-t border-gray-100 flex items-center justify-end gap-4 bg-gray-50/30">
                  <span className="text-sm text-gray-400">
                    {demoText.length}/100
                  </span>
                  <button
                    onClick={handleDemoGenerate}
                    disabled={isGenerating}
                    className="h-11 px-6 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-70"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Generate Voice</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ============================================
            SOCIAL PROOF - Clean typography, proper grid
            ============================================ */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-8"
            >
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Trusted by creators
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight">
                1 Million+ subscribers
              </h2>
              <p className="text-lg text-gray-500 mt-2">
                consuming content made using Decible
              </p>
            </motion.div>

            {/* Creator Cards - 5 column grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { name: 'AI Guy', handle: '@ai_guy', subs: '273K' },
                { name: 'Inspire Xplorer', handle: '@InspireXplorer', subs: '52.7K' },
                { name: 'Money Degree', handle: '@MoneyDegree', subs: '33.7K' },
                { name: 'Leo Ai', handle: '@leo_Ai', subs: '32.7K' },
                { name: 'howtoai', handle: '@howtoai', subs: '303K' },
              ].map((creator, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-900 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {creator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>

                  {/* Name */}
                  <h4 className="text-sm font-semibold text-gray-900 text-center truncate">
                    {creator.name}
                  </h4>

                  {/* Handle */}
                  <p className="text-xs text-gray-400 text-center truncate mb-3">
                    {creator.handle}
                  </p>

                  {/* Subscriber badge */}
                  <div className="flex items-center justify-center gap-1.5 h-7 px-3 bg-gray-50 rounded-full mx-auto w-fit">
                    <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                    </svg>
                    <span className="text-xs font-medium text-gray-600">{creator.subs}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            STATS SECTION - Consistent card design
            ============================================ */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-6">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-sm font-semibold text-gray-400 uppercase tracking-wider text-center mb-8"
            >
              Why creators choose Decible
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { value: '10,000+', label: 'Premium Voices', icon: Users },
                { value: '50+', label: 'Languages', icon: Globe },
                { value: '5K', label: 'Free Credits', icon: Zap },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="bg-white border border-gray-100 rounded-2xl p-8 text-center hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  {/* Icon container - properly centered */}
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-900 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Value */}
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </div>

                  {/* Label */}
                  <div className="text-sm text-gray-500">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            WHAT IS DECIBLE - Product showcase section
            ============================================ */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              {/* Left - App Interface Mockup */}
              <motion.div
                initial={{ opacity: 0, x: -32 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="flex-1 w-full"
              >
                {/* App Window Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/50 overflow-hidden">
                  {/* Top Bar */}
                  <div className="h-12 px-4 bg-white border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <DecibleLogo size={24} className="text-gray-900" />
                        <span className="text-sm font-semibold text-gray-900">Decible</span>
                      </div>
                      <span className="text-gray-300">/</span>
                      <span className="text-sm text-gray-500">Voice Library</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-7 px-3 bg-emerald-500 rounded-lg flex items-center gap-1.5">
                        <span className="text-white text-xs font-medium">Create a Voice</span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex">
                    {/* Sidebar */}
                    <div className="w-48 p-4 border-r border-gray-100 bg-gray-50/50 hidden sm:block">
                      <div className="h-8 px-3 mb-4 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-700">My Workspace</span>
                      </div>
                      <div className="space-y-1">
                        {['Home', 'Text to Speech', 'Voices', 'Create Voice', 'Help Center'].map((item, i) => (
                          <div
                            key={i}
                            className={`h-8 px-3 rounded-lg flex items-center gap-2 text-xs ${
                              i === 2 ? 'bg-white border border-gray-200 font-medium text-gray-900' : 'text-gray-500'
                            }`}
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-4">
                      {/* Tabs */}
                      <div className="flex items-center gap-1 mb-4">
                        {['Explore', 'Latest', 'My Voices'].map((tab, i) => (
                          <div
                            key={i}
                            className={`h-8 px-4 rounded-full flex items-center text-xs font-medium ${
                              i === 0 ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            {tab}
                          </div>
                        ))}
                      </div>

                      {/* Category Pills */}
                      <div className="flex items-center gap-2 mb-4 overflow-hidden">
                        {['All', 'Commentary', 'Documentary', 'Storytelling'].map((cat, i) => (
                          <div
                            key={i}
                            className={`h-7 px-3 rounded-full flex items-center text-xs whitespace-nowrap ${
                              i === 0 ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
                            }`}
                          >
                            {cat}
                          </div>
                        ))}
                      </div>

                      {/* Trending Voices Label */}
                      <p className="text-sm font-semibold text-gray-900 mb-3">Trending voices</p>

                      {/* Voice Cards Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'Bill', desc: 'Wise, Mature, Balanced', type: 'Documentary', color: 'bg-gradient-to-br from-cyan-400 to-blue-500' },
                          { name: 'Brian', desc: 'Deep, Authoritative', type: 'Commentary', color: 'bg-gradient-to-br from-emerald-400 to-teal-500' },
                          { name: 'Lily', desc: 'Warm, Friendly Female', type: 'Storytelling', color: 'bg-gradient-to-br from-pink-300 to-rose-400' },
                          { name: 'Daniel', desc: 'Confident, Clear', type: 'Storytelling', color: 'bg-gradient-to-br from-amber-300 to-orange-400' },
                        ].map((voice, i) => (
                          <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-200 hover:shadow-sm transition-all">
                            <div className="flex items-start gap-2.5 mb-2">
                              <div className={`w-8 h-8 rounded-full ${voice.color} flex-shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">{voice.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{voice.type}</p>
                              </div>
                            </div>
                            <div className="h-7 bg-gray-50 rounded-lg flex items-center justify-center gap-1.5">
                              <Play className="w-3 h-3 text-gray-400" />
                              <span className="text-[10px] text-gray-500">Preview</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right - Copy */}
              <motion.div
                initial={{ opacity: 0, x: 32 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="flex-1 lg:max-w-md"
              >
                {/* Badge */}
                <div className="inline-flex items-center h-8 px-4 mb-6 bg-gray-100 rounded-full">
                  <span className="text-sm font-medium text-gray-600">What is Decible</span>
                </div>

                {/* Headline */}
                <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight mb-6 leading-[1.15]">
                  Smartest AI Voice Tool for Faceless Youtube Creators
                </h2>

                {/* Description */}
                <p className="text-lg text-gray-500 leading-relaxed mb-8">
                  Decible is the complete voiceover toolkit for faceless YouTube creators.
                  Create emotion-driven, non-robotic voices tailored to your niche — affordable, scalable, and built to grow channels faster.
                </p>

                {/* CTA Button */}
                <button
                  onClick={() => setShowAuth(true)}
                  className="h-12 px-8 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-all flex items-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign up for free
                </button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================
            COMPARISON CHART - High impact, scroll-stopping
            ============================================ */}
        <section className="py-16 bg-gradient-to-b from-gray-900 to-gray-800">
          <div className="max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              {/* Section Header */}
              <div className="text-center mb-10">
                <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 rounded-full">
                  Comparison
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  Why creators switch to Decible
                </h2>
              </div>

              {/* Comparison Card */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200">
                  <div className="col-span-6 px-6 py-4">
                    <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">Features</span>
                  </div>
                  <div className="col-span-3 px-4 py-4 text-center border-l border-gray-200">
                    <div className="flex items-center justify-center gap-1 opacity-50 blur-[1px]">
                      <span className="text-sm font-bold text-gray-700">||ElevenLabs</span>
                    </div>
                  </div>
                  <div className="col-span-3 px-4 py-4 text-center border-l border-gray-200 bg-emerald-50">
                    <div className="flex items-center justify-center gap-2">
                      <DecibleLogo size={20} className="text-gray-900" />
                      <span className="text-sm font-bold text-gray-900">Decible</span>
                    </div>
                  </div>
                </div>

                {/* Table Rows */}
                {[
                  { feature: 'Ease of Use', competitor: false, decible: true },
                  { feature: 'Affordability', competitor: false, decible: true },
                  { feature: 'Emotional Control', competitor: false, decible: true },
                  { feature: 'Built for YouTube Automation', competitor: false, decible: true },
                ].map((row, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-12 ${i !== 3 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="col-span-6 px-6 py-5">
                      <span className="text-sm font-medium text-gray-800">{row.feature}</span>
                    </div>
                    <div className="col-span-3 px-4 py-5 flex items-center justify-center border-l border-gray-100">
                      {row.competitor ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Check className="w-5 h-5 text-emerald-500" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="col-span-3 px-4 py-5 flex items-center justify-center border-l border-gray-100 bg-emerald-50/50">
                      {row.decible ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                          <Check className="w-5 h-5 text-white" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Bottom CTA */}
                <div className="px-6 py-6 bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={() => setShowAuth(true)}
                    className="w-full h-12 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                  >
                    Switch to Decible — It's Free
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            FAQ SECTION - Accordion style
            ============================================ */}
        <section className="py-16 bg-white relative overflow-hidden">
          {/* Left wave decoration */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[300px] h-[400px] pointer-events-none opacity-30 -translate-x-1/2 hidden lg:block">
            <FlowingWave className="w-full h-full rotate-90" direction="left" />
          </div>

          {/* Right wave decoration */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[300px] h-[400px] pointer-events-none opacity-30 translate-x-1/2 hidden lg:block">
            <FlowingWave className="w-full h-full -rotate-90" direction="right" />
          </div>

          <div className="max-w-3xl mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              {/* Section Header */}
              <div className="text-center mb-10">
                <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 bg-gray-100 rounded-full">
                  FAQ
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
                  Frequently Asked Questions
                </h2>
                <p className="text-gray-500 mt-3">
                  Everything you need to know about Decible
                </p>
              </div>

              {/* FAQ Accordion */}
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05, duration: 0.4 }}
                    className={`border rounded-xl overflow-hidden transition-all ${
                      openFaq === index
                        ? 'border-gray-300 bg-gray-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Question Button */}
                    <button
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left"
                    >
                      <span className={`font-semibold pr-4 ${
                        openFaq === index ? 'text-gray-900' : 'text-gray-800'
                      }`}>
                        {faq.question}
                      </span>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        openFaq === index
                          ? 'bg-gray-900 rotate-180'
                          : 'bg-gray-100'
                      }`}>
                        <ChevronDown className={`w-4 h-4 transition-colors ${
                          openFaq === index ? 'text-white' : 'text-gray-500'
                        }`} />
                      </div>
                    </button>

                    {/* Answer Panel */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      openFaq === index ? 'max-h-96' : 'max-h-0'
                    }`}>
                      <div className="px-6 pb-5 pt-0">
                        <p className="text-gray-600 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Bottom CTA */}
              <div className="mt-10 text-center">
                <p className="text-gray-500 mb-4">Still have questions?</p>
                <a
                  href="mailto:support@decible.io"
                  className="inline-flex items-center gap-2 h-11 px-6 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-all"
                >
                  Contact Support
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            FOOTER - Clean, organized
            ============================================ */}
        <footer className="border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              {/* Brand */}
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <DecibleLogo size={32} className="text-gray-900" />
                  <span className="text-lg font-semibold">Decible</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  AI voiceover tool built for YouTube creators who want to scale.
                </p>
              </div>

              {/* Product */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Product</h4>
                <ul className="space-y-3">
                  <li><button onClick={() => setShowAuth(true)} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Text to Speech</button></li>
                  <li><button onClick={() => setShowAuth(true)} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Voice Cloning</button></li>
                  <li><button onClick={() => setShowAuth(true)} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Voice Library</button></li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Resources</h4>
                <ul className="space-y-3">
                  <li><a href="mailto:support@decible.io" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Help Center</a></li>
                  <li><span className="text-sm text-gray-400">API Docs</span></li>
                  <li><span className="text-sm text-gray-400">Blog</span></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Legal</h4>
                <ul className="space-y-3">
                  <li><a href="/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Terms</a></li>
                  <li><a href="/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Privacy</a></li>
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-400">
                © {new Date().getFullYear()} Decible. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <Github className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" />
                <Twitter className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" />
                <Linkedin className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" />
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
