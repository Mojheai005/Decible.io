'use client'

import { useState, useCallback } from 'react'

declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => RazorpayInstance
    }
}

interface RazorpayOptions {
    key: string
    amount: number
    currency: string
    name: string
    description: string
    order_id: string
    prefill?: { name?: string; email?: string }
    theme?: { color?: string }
    handler: (response: RazorpayResponse) => void
    modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
    open: () => void
    close: () => void
}

interface RazorpayResponse {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
}

interface UsePaymentResult {
    initiatePayment: (planId: string, orderType?: string) => Promise<void>
    isProcessing: boolean
    processingPlanId: string | null
    error: string | null
}

function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true)
            return
        }
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

export function usePayment(): UsePaymentResult {
    const [isProcessing, setIsProcessing] = useState(false)
    const [processingPlanId, setProcessingPlanId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const initiatePayment = useCallback(async (planId: string, orderType = 'subscription') => {
        setIsProcessing(true)
        setProcessingPlanId(planId)
        setError(null)

        try {
            // Load Razorpay SDK
            const loaded = await loadRazorpayScript()
            if (!loaded) {
                throw new Error('Failed to load payment gateway. Please try again.')
            }

            // Create order on server — API expects { type, planId }
            const orderResponse = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: orderType, planId }),
            })

            if (!orderResponse.ok) {
                const errData = await orderResponse.json().catch(() => ({}))
                throw new Error(errData.error || 'Failed to create order')
            }

            const orderData = await orderResponse.json()

            // Open Razorpay checkout
            const options: RazorpayOptions = {
                key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
                amount: orderData.amount,
                currency: orderData.currency || 'INR',
                name: 'Decible',
                description: orderData.description || `${orderType === 'topup' ? 'Credit Top-up' : 'Subscription'} - ${planId}`,
                order_id: orderData.orderId,
                prefill: {
                    name: orderData.prefill?.name,
                    email: orderData.prefill?.email,
                },
                theme: { color: '#111827' },
                handler: async (response: RazorpayResponse) => {
                    // Verify payment on server
                    try {
                        const verifyResponse = await fetch('/api/payments/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        })

                        if (!verifyResponse.ok) {
                            throw new Error('Payment verification failed')
                        }

                        // Trigger credits refresh across app
                        window.dispatchEvent(new Event('credits-updated'))
                    } catch (verifyErr) {
                        setError(verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed')
                    } finally {
                        setIsProcessing(false)
                        setProcessingPlanId(null)
                    }
                },
                modal: {
                    ondismiss: () => {
                        setIsProcessing(false)
                        setProcessingPlanId(null)
                    },
                },
            }

            const rzp = new window.Razorpay(options)
            rzp.open()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Payment failed'
            setError(msg)
            setIsProcessing(false)
            setProcessingPlanId(null)
        }
    }, [])

    return { initiatePayment, isProcessing, processingPlanId, error }
}
