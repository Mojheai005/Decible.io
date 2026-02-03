'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mic2, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get('redirect') || '/dashboard'
    const errorParam = searchParams.get('error')

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState(errorParam === 'auth_failed' ? 'Authentication failed. Please try again.' : '')

    const supabase = createClient()

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    setError('Invalid email or password. Please try again.')
                } else if (error.message.includes('Email not confirmed')) {
                    setError('Please verify your email before logging in.')
                } else {
                    setError(error.message)
                }
                return
            }

            router.push(redirectTo)
            router.refresh()
        } catch {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setGoogleLoading(true)
        setError('')

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })

            if (error) {
                setError(error.message)
                setGoogleLoading(false)
            }
        } catch {
            setError('Failed to connect to Google. Please try again.')
            setGoogleLoading(false)
        }
    }

    return (
        <div className="w-full max-w-md">
            {/* Logo */}
            <div className="text-center mb-8">
                <Link href="/" className="inline-flex items-center gap-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Mic2 className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white">NMM Voice</span>
                </Link>
                <h1 className="text-2xl font-bold text-white mt-6">Welcome back</h1>
                <p className="text-gray-400 mt-2">Sign in to continue to your account</p>
            </div>

            {/* Card */}
            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-8">
                {/* Error Alert */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Google Button */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || loading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {googleLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                    )}
                    {googleLoading ? 'Connecting...' : 'Continue with Google'}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-gray-700" />
                    <span className="text-gray-500 text-sm">or continue with email</span>
                    <div className="flex-1 h-px bg-gray-700" />
                </div>

                {/* Email Form */}
                <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                            Email address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="w-full pl-10 pr-12 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-violet-500 focus:ring-violet-500"
                            />
                            <span className="text-sm text-gray-400">Remember me</span>
                        </label>
                        <Link href="/forgot-password" className="text-sm text-violet-400 hover:text-violet-300">
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Sign in'
                        )}
                    </button>
                </form>

                {/* Sign up link */}
                <p className="text-center text-gray-400 mt-6">
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium">
                        Sign up free
                    </Link>
                </p>
            </div>

            {/* Footer */}
            <p className="text-center text-gray-500 text-sm mt-8">
                By continuing, you agree to our{' '}
                <Link href="/terms" className="text-gray-400 hover:text-white">
                    Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-gray-400 hover:text-white">
                    Privacy Policy
                </Link>
            </p>
        </div>
    )
}

function LoginLoading() {
    return (
        <div className="w-full max-w-md">
            <div className="text-center mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto">
                    <Mic2 className="w-7 h-7 text-white" />
                </div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-8">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <Suspense fallback={<LoginLoading />}>
                <LoginForm />
            </Suspense>
        </div>
    )
}
