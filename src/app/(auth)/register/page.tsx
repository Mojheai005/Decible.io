'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, Eye, EyeOff, Loader2, Check } from 'lucide-react'
import DecibleLogo from '@/components/DecibleLogo'

export default function RegisterPage() {
    const router = useRouter()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const supabase = createClient()

    // Password strength checker
    const getPasswordStrength = (pass: string) => {
        let strength = 0
        if (pass.length >= 8) strength++
        if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++
        if (/\d/.test(pass)) strength++
        if (/[^a-zA-Z0-9]/.test(pass)) strength++
        return strength
    }

    const passwordStrength = getPasswordStrength(password)
    const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong']
    const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500']

    const handleEmailSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match')
            setLoading(false)
            return
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long')
            setLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name,
                        full_name: name,
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
                },
            })

            if (error) {
                if (error.message.includes('already registered')) {
                    setError('This email is already registered. Please login instead.')
                } else {
                    setError(error.message)
                }
                return
            }

            setSuccess(true)
        } catch {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignup = async () => {
        setGoogleLoading(true)
        setError('')

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
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

    // Success state
    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10 text-green-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-4">Check your email</h1>
                    <p className="text-gray-400 mb-6">
                        We&apos;ve sent a verification link to <span className="text-white font-medium">{email}</span>.
                        Please click the link to verify your account.
                    </p>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
                        <p className="text-gray-400 text-sm">
                            Didn&apos;t receive the email? Check your spam folder or{' '}
                            <button
                                onClick={() => setSuccess(false)}
                                className="text-violet-400 hover:text-violet-300"
                            >
                                try again
                            </button>
                        </p>
                    </div>
                    <Link
                        href="/login"
                        className="text-violet-400 hover:text-violet-300 font-medium"
                    >
                        Back to login
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2">
                        <DecibleLogo size={42} className="text-white" />
                        <span className="text-2xl font-bold text-white">Decible</span>
                    </Link>
                    <h1 className="text-2xl font-bold text-white mt-6">Create your account</h1>
                    <p className="text-gray-400 mt-2">Start with 5,000 free credits</p>
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
                        onClick={handleGoogleSignup}
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
                        {googleLoading ? 'Connecting...' : 'Sign up with Google'}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-gray-700" />
                        <span className="text-gray-500 text-sm">or sign up with email</span>
                        <div className="flex-1 h-px bg-gray-700" />
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailSignup} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                                Full name
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

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
                                    placeholder="Create a strong password"
                                    required
                                    minLength={8}
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
                            {/* Password strength indicator */}
                            {password && (
                                <div className="mt-2">
                                    <div className="flex gap-1 mb-1">
                                        {[0, 1, 2, 3].map((i) => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full ${
                                                    i < passwordStrength
                                                        ? strengthColors[passwordStrength - 1]
                                                        : 'bg-gray-700'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Password strength: {strengthLabels[passwordStrength - 1] || 'Very weak'}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                Confirm password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    id="confirmPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                />
                                {confirmPassword && password === confirmPassword && (
                                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="terms"
                                required
                                className="w-4 h-4 mt-1 rounded border-gray-600 bg-gray-900 text-violet-500 focus:ring-violet-500"
                            />
                            <label htmlFor="terms" className="text-sm text-gray-400">
                                I agree to the{' '}
                                <Link href="/terms" className="text-violet-400 hover:text-violet-300">
                                    Terms of Service
                                </Link>{' '}
                                and{' '}
                                <Link href="/privacy" className="text-violet-400 hover:text-violet-300">
                                    Privacy Policy
                                </Link>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || googleLoading}
                            className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                'Create account'
                            )}
                        </button>
                    </form>

                    {/* Login link */}
                    <p className="text-center text-gray-400 mt-6">
                        Already have an account?{' '}
                        <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>

                {/* Benefits */}
                <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold text-white">5K</div>
                        <div className="text-xs text-gray-500">Free Credits</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">100+</div>
                        <div className="text-xs text-gray-500">AI Voices</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">Free</div>
                        <div className="text-xs text-gray-500">Forever Plan</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
