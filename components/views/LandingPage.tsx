import React, { useState } from 'react';
import { Play, Mic, Music, Globe, BookOpen, Layers, Sparkles, Loader2, ArrowRight, Check, PlayCircle, Star, Github, Twitter, Linkedin, HelpCircle, Users, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShaderAvatar, ShaderType } from '../ui/ShaderAvatar';
import { AuthModal } from '../modals/AuthModal';

export const LandingPage: React.FC = () => {
  const [demoText, setDemoText] = useState("In the ancient land of Eldoria, where skies shimmered and forests whispered secrets to the wind, lived a dragon named Zephyros.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeVoice, setActiveVoice] = useState(0);
  const [showAuth, setShowAuth] = useState(false);

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

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
      />

      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 w-full bg-white/80 backdrop-blur-xl z-50 border-b border-gray-100"
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <div className="w-5 h-5 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-sm flex items-center justify-center text-white text-[10px] font-bold">dB</div>
              Decibal
            </h1>
            <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-500">
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-black transition-colors">Home</button>
              <button onClick={() => setShowAuth(true)} className="hover:text-black transition-colors">Text to Speech</button>
              <button onClick={() => setShowAuth(true)} className="hover:text-black transition-colors">Discover Voices</button>
              <button onClick={() => window.scrollTo({ top: document.body.scrollHeight * 0.6, behavior: 'smooth' })} className="hover:text-black transition-colors">Pricing</button>
              <a href="mailto:support@decibal.io" className="hover:text-black transition-colors">Help</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowAuth(true)} className="text-sm font-medium hover:text-gray-600 transition-colors">Log in</button>
            <button onClick={() => setShowAuth(true)} className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-black/10">
              Sign up
            </button>
          </div>
        </div>
      </motion.nav>

      <main className="pt-32 px-6">
        {/* Hero Section */}
        <div className="max-w-5xl mx-auto text-center mb-24 relative">
          {/* Background Blobs */}
          <div className="absolute top-0 -left-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 -right-20 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600 mb-8 hover:bg-gray-100 transition-colors cursor-pointer">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Introducing Turbo v2.5 Model
              <ArrowRight className="w-4 h-4" />
            </div>

            <h1 className="text-6xl md:text-8xl font-medium tracking-tight mb-8 leading-[0.95] text-gray-900">
              Generative Voice AI <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-black">That Resonates.</span>
            </h1>

            <p className="text-xl text-gray-500 mb-12 max-w-2xl mx-auto leading-relaxed">
              Create the most realistic speech, voices, and sound effects. Powering the world's most innovative companies.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 relative z-10">
              <button onClick={() => setShowAuth(true)} className="w-full sm:w-auto bg-black text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition-all hover:scale-105 shadow-xl shadow-gray-200 active:scale-95 flex items-center justify-center gap-2">
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <button onClick={() => setShowAuth(true)} className="w-full sm:w-auto bg-white border border-gray-200 text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-50 transition-all hover:border-gray-300 flex items-center justify-center gap-2">
                <PlayCircle className="w-5 h-5" />
                Listen to Samples
              </button>
            </div>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="flex flex-wrap justify-center gap-3 mb-24 relative z-10"
          >
            {[
              { icon: Mic, label: 'TEXT TO SPEECH', active: true },
              { icon: Globe, label: 'AGENTS' },
              { icon: Music, label: 'MUSIC' },
              { icon: Layers, label: 'DUBBING' },
              { icon: Mic, label: 'VOICE CLONING' },
              { icon: BookOpen, label: 'READER' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05, y: -2 }}
                className={`flex items-center gap-2 px-6 py-3 rounded-full border text-xs font-bold tracking-widest cursor-pointer transition-all ${feature.active
                    ? 'bg-black border-black text-white shadow-lg'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-black'
                  }`}
              >
                <feature.icon className="w-4 h-4" />
                {feature.label}
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Interactive Demo Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-white rounded-[2.5rem] border border-gray-200 shadow-2xl shadow-gray-200/50 overflow-hidden max-w-7xl mx-auto h-[700px] flex flex-col md:flex-row relative z-20"
        >
          {/* Left List */}
          <div className="w-full md:w-[420px] p-8 border-r border-gray-100 bg-gray-50/50 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Available Voices</h3>
              <span className="text-xs font-medium text-black bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">v2.5 Model</span>
            </div>

            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {voices.map((voice, i) => (
                <motion.div
                  key={i}
                  onClick={() => setActiveVoice(i)}
                  whileHover={{ scale: 1.02 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${activeVoice === i
                      ? 'bg-white border-gray-200 shadow-lg scale-[1.02]'
                      : 'bg-transparent border-transparent hover:bg-white/60'
                    }`}
                >
                  <div className="w-14 h-14 rounded-full flex-shrink-0 relative shadow-inner ring-2 ring-white overflow-hidden border border-gray-100">
                    <ShaderAvatar type={voice.shader as ShaderType} />
                    {activeVoice === i && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-black rounded-full flex items-center justify-center text-white border-2 border-white"
                      >
                        <Check className="w-3 h-3" />
                      </motion.div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate text-lg">{voice.name}</div>
                    <div className="text-xs text-gray-500 font-medium truncate">{voice.tag}</div>
                  </div>
                  {activeVoice === i && (
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-black">
                      <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 flex flex-col bg-white relative">
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>

            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <h3 className="text-sm font-bold text-gray-700">Text to Speech Editor</h3>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-black transition-colors">
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-8 relative">
              <textarea
                className="w-full h-full bg-transparent text-3xl md:text-4xl font-normal text-gray-800 leading-normal resize-none focus:outline-none placeholder:text-gray-300"
                value={demoText}
                onChange={(e) => setDemoText(e.target.value)}
                placeholder="Type something here..."
                spellCheck={false}
              />

              <div className="absolute bottom-10 right-10 flex items-center gap-4">
                <div className="text-xs font-medium text-gray-400 bg-white/80 px-3 py-1.5 rounded-full border border-gray-100">
                  {demoText.length} chars
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDemoGenerate}
                  className="flex items-center gap-3 bg-black text-white pl-8 pr-8 py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition-all shadow-xl shadow-black/20"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      Generate Speech
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature Stats */}
        <div className="max-w-7xl mx-auto mt-24 text-center">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-10">Why creators choose Decibal</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '100+', label: 'Premium Voices', icon: Users, color: 'from-purple-500 to-indigo-500' },
              { value: '50+', label: 'Languages', icon: Globe, color: 'from-blue-500 to-cyan-500' },
              { value: '5K', label: 'Free Credits', icon: Zap, color: 'from-amber-500 to-orange-500' },
              { value: '24/7', label: 'Support', icon: HelpCircle, color: 'from-green-500 to-emerald-500' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-gray-300 transition-all cursor-default group"
              >
                <div className={`w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-3xl font-black text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-gray-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto mt-32 border-t border-gray-100 pt-16 pb-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
            <div className="col-span-2">
              <h2 className="text-xl font-bold mb-6">Decibal</h2>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                Pioneering research in AI audio generation. We make content universally accessible in any language and voice.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-sm">Product</h3>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><button onClick={() => setShowAuth(true)} className="hover:text-black transition-colors">Text to Speech</button></li>
                <li><button onClick={() => setShowAuth(true)} className="hover:text-black transition-colors">Voice Cloning</button></li>
                <li><button onClick={() => setShowAuth(true)} className="hover:text-black transition-colors">Dubbing Studio</button></li>
                <li><button onClick={() => setShowAuth(true)} className="hover:text-black transition-colors">Audio Native</button></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-sm">Resources</h3>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="mailto:support@decibal.io" className="hover:text-black transition-colors">Help Center</a></li>
                <li><span className="text-gray-400 cursor-default" title="Coming soon">API Docs</span></li>
                <li><span className="text-gray-400 cursor-default" title="Coming soon">Blog</span></li>
                <li><span className="text-gray-400 cursor-default" title="Coming soon">Community</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-sm">Company</h3>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="/terms" className="hover:text-black transition-colors">Terms of Service</a></li>
                <li><a href="/privacy" className="hover:text-black transition-colors">Privacy Policy</a></li>
                <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-black transition-colors">About</button></li>
                <li><a href="mailto:support@decibal.io" className="hover:text-black transition-colors">Careers</a></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-50">
            <div className="text-xs text-gray-400 font-medium">© {new Date().getFullYear()} Decibal Inc. All rights reserved.</div>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Github className="w-5 h-5 text-gray-400 hover:text-black cursor-pointer transition-colors" />
              <Twitter className="w-5 h-5 text-gray-400 hover:text-black cursor-pointer transition-colors" />
              <Linkedin className="w-5 h-5 text-gray-400 hover:text-black cursor-pointer transition-colors" />
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
