import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { VideoBackground } from './VideoBackground';
import { BlurIn } from './ui/BlurIn';
import { SplitText } from './ui/SplitText';

const Hero: React.FC = () => {
  return (
    <section className="relative w-full h-screen overflow-hidden bg-background">
      {/* Background Video Layer */}
      <VideoBackground src="https://customer-cbeadsgr09pnsezs.cloudflarestream.com/df176a2fb2ea2b64bd21ae1c10d3af6a/manifest/video.m3u8" />

      {/* Content Container */}
      <div className="relative z-20 w-full h-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col justify-center">

        {/* Content Wrapper */}
        <div className="flex flex-col items-start gap-6 max-w-4xl">

          {/* Badge */}
          <BlurIn delay={0} duration={0.6}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 text-white/80" />
              <span className="text-sm font-medium text-white/80">New AI Automation Ally</span>
            </div>
          </BlurIn>

          {/* Heading */}
          <div className="flex flex-col gap-0 leading-tight lg:leading-[1.2]">
            {/* Line 1 */}
            <div className="block text-4xl md:text-5xl lg:text-6xl font-medium text-foreground">
              <SplitText
                text="Unlock the Power of AI"
                delay={0}
                duration={0.6}
              />
            </div>

            {/* Line 2 (and 3 visually) */}
            <div className="block text-4xl md:text-5xl lg:text-6xl font-medium text-foreground">
               <span className="inline-block mr-[0.25em]">
                  <SplitText
                    text="for Your"
                    delay={0.4}
                    duration={0.6}
                  />
               </span>
               <span className="inline-block font-serif italic text-white">
                  <SplitText
                    text="Business."
                    delay={0.56}
                    duration={0.6}
                  />
               </span>
            </div>
          </div>

          {/* Subtitle */}
          <BlurIn delay={0.4} duration={0.6} className="w-full">
            <p className="text-lg font-normal text-white/80 leading-relaxed max-w-xl">
              Our cutting-edge AI platform automates, analyzes, and accelerates your workflows so you can focus on what really matters.
            </p>
          </BlurIn>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <BlurIn delay={0.6} duration={0.6}>
              <a
                href="#book-call"
                className="group flex items-center gap-2 bg-foreground text-background rounded-full px-5 py-3 font-medium transition-transform hover:scale-105 active:scale-95"
              >
                Book A Free Call
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </BlurIn>

            <BlurIn delay={0.6} duration={0.6}>
              <button
                className="rounded-full px-8 py-3 font-medium text-white bg-white/20 backdrop-blur-sm border border-white/10 transition-colors hover:bg-white/30"
              >
                Learn now
              </button>
            </BlurIn>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
