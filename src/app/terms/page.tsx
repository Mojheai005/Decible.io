'use client';

import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Decible</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
            <p className="text-gray-500 text-sm">Last updated: January 2025</p>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 text-lg leading-relaxed mb-8">
            Welcome to Decible. By accessing or using our services, you agree to be bound by these Terms of Service. Please read them carefully.
          </p>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-600">
              By creating an account or using Decible's services, you agree to these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-600">
              Decible provides AI-powered voice generation services, including text-to-speech conversion, voice cloning, and related audio generation features. We reserve the right to modify, suspend, or discontinue any aspect of our services at any time.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. User Accounts</h2>
            <div className="space-y-4 text-gray-600">
              <p>To access certain features, you must create an account. You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Providing accurate and complete information</li>
                <li>Maintaining the security of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. Acceptable Use</h2>
            <p className="text-gray-600 mb-4">You agree not to use Decible's services to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Create content that impersonates others without their consent</li>
              <li>Generate harmful, abusive, defamatory, or illegal content</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Harass, threaten, or deceive any person</li>
              <li>Spread misinformation or create deepfakes for malicious purposes</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Attempt to reverse engineer or extract our AI models</li>
              <li>Resell or redistribute our services without authorization</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. Voice Cloning Policy</h2>
            <p className="text-gray-600">
              When using our voice cloning feature, you represent and warrant that you have obtained all necessary rights, permissions, and consents to use the voice samples you provide. You may only clone voices that you own or have explicit written permission to use.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">6. Credits and Billing</h2>
            <div className="space-y-4 text-gray-600">
              <p><strong className="text-gray-800">Credits:</strong> Our services operate on a credit-based system. Credits are consumed based on usage and do not carry over between billing periods unless otherwise specified.</p>
              <p><strong className="text-gray-800">Payments:</strong> All payments are processed securely. Subscription fees are billed in advance on a recurring basis.</p>
              <p><strong className="text-gray-800">Refunds:</strong> Refunds may be issued at our discretion. Contact support for refund requests.</p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">7. Intellectual Property</h2>
            <div className="space-y-4 text-gray-600">
              <p><strong className="text-gray-800">Our Property:</strong> Decible and its licensors own all rights to the service, including our AI models, software, and branding.</p>
              <p><strong className="text-gray-800">Your Content:</strong> You retain ownership of the text and audio samples you provide. You grant us a license to process this content to provide our services.</p>
              <p><strong className="text-gray-800">Generated Content:</strong> Subject to these terms, you own the audio generated through our services for your personal or commercial use.</p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">8. Disclaimers</h2>
            <p className="text-gray-600">
              OUR SERVICES ARE PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT OUR SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. WE ARE NOT RESPONSIBLE FOR THE ACCURACY OR QUALITY OF GENERATED CONTENT.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-600">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DECIBAL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">10. Termination</h2>
            <p className="text-gray-600">
              We may terminate or suspend your account at any time for violations of these terms or for any other reason. Upon termination, your right to use our services will immediately cease.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">11. Changes to Terms</h2>
            <p className="text-gray-600">
              We may modify these Terms of Service at any time. We will notify you of significant changes by email or through our service. Continued use of our services after changes constitutes acceptance of the modified terms.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">12. Governing Law</h2>
            <p className="text-gray-600">
              These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising from these terms shall be resolved through binding arbitration.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">13. Contact Us</h2>
            <p className="text-gray-600">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="font-medium text-gray-900">Decible Support</p>
              <a href="mailto:support@decible.io" className="text-purple-600 hover:underline">support@decible.io</a>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-gray-500">
          © 2025 Decible Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
