'use client';

import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Decibal</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-gray-500 text-sm">Last updated: January 2025</p>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 text-lg leading-relaxed mb-8">
            At Decibal, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our voice generation services.
          </p>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
            <div className="space-y-4 text-gray-600">
              <p><strong className="text-gray-800">Account Information:</strong> When you create an account, we collect your name, email address, and authentication credentials.</p>
              <p><strong className="text-gray-800">Usage Data:</strong> We collect information about how you use our services, including text inputs for voice generation, voice selections, and generation history.</p>
              <p><strong className="text-gray-800">Voice Samples:</strong> If you use our voice cloning feature, we collect the audio samples you provide to create custom voices.</p>
              <p><strong className="text-gray-800">Technical Data:</strong> We automatically collect certain information including your IP address, browser type, device information, and interaction data.</p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>To provide, maintain, and improve our voice generation services</li>
              <li>To process your text-to-speech requests and deliver generated audio</li>
              <li>To create and manage your custom voice clones</li>
              <li>To communicate with you about your account and our services</li>
              <li>To detect, prevent, and address technical issues and abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. Data Security</h2>
            <p className="text-gray-600">
              We implement industry-standard security measures to protect your personal information. This includes encryption of data in transit and at rest, secure authentication protocols, and regular security audits. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. Cookies and Tracking</h2>
            <p className="text-gray-600">
              We use cookies and similar tracking technologies to enhance your experience, analyze usage patterns, and remember your preferences. You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. Third-Party Services</h2>
            <p className="text-gray-600">
              We may use third-party services for authentication (such as Google Sign-In), payment processing, and analytics. These services have their own privacy policies, and we encourage you to review them.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">6. Data Retention</h2>
            <p className="text-gray-600">
              We retain your personal information for as long as your account is active or as needed to provide you services. You can request deletion of your account and associated data by contacting us.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">7. Your Rights</h2>
            <p className="text-gray-600 mb-4">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate personal data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">8. Children's Privacy</h2>
            <p className="text-gray-600">
              Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">9. Changes to This Policy</h2>
            <p className="text-gray-600">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">10. Contact Us</h2>
            <p className="text-gray-600">
              If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="font-medium text-gray-900">Decibal Support</p>
              <a href="mailto:support@decibal.io" className="text-purple-600 hover:underline">support@decibal.io</a>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-gray-500">
          © 2025 Decibal Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
