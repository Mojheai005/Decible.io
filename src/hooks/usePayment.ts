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

interface RazorpayFailure {
    error?: {
        code?: string
        description?: string
        reason?: string
        source?: string
        step?: string
        metadata?: { order_id?: string; payment_id?: string }
    }
}

interface RazorpayInstance {
    open: () => void
    close: () => void
    on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void
}

interface RazorpayResponse {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
}

export type OrderType = 'subscription' | 'upgrade' | 'topup'

interface UsePaymentResult {
    /** For plans pass the plan id; for credit top-ups pass the top-up package id with orderType 'topup'. */
    initiatePayment: (id: string, orderType?: OrderType, billingPeriod?: 'monthly' | 'yearly') => Promise<void>
    isProcessing: boolean
    processingPlanId: string | null
    error: string | null
    success: string | null
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
    const [success, setSuccess] = useState<string | null>(null)

    const initiatePayment = useCallback(async (
        id: string,
        orderType: OrderType = 'subscription',
        billingPeriod: 'monthly' | 'yearly' = 'monthly',
    ) => {
        setIsProcessing(true)
        setProcessingPlanId(id)
        setError(null)
        setSuccess(null)

        const done = () => {
            setIsProcessing(false)
            setProcessingPlanId(null)
        }

        try {
            const loaded = await loadRazorpayScript()
            if (!loaded) {
                throw new Error('The payment window could not load. Check your connection and try again.')
            }

            // The server expects a plan id for plans and a package id for top-ups.
            // Top-ups used to send planId, which the server rejected every time.
            const orderBody = orderType === 'topup'
                ? { type: 'topup', topupPackageId: id }
                : { type: orderType, planId: id, billingPeriod }

            const orderResponse = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderBody),
            })

            if (!orderResponse.ok) {
                const errData = await orderResponse.json().catch(() => ({}))
                throw new Error(errData.error || 'We could not start the payment. Nothing was charged. Please try again.')
            }

            const orderData = await orderResponse.json()

            const options: RazorpayOptions = {
                key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
                amount: orderData.amount,
                currency: orderData.currency || 'INR',
                name: 'Decible',
                description: orderData.description || (orderType === 'topup' ? 'Credit top-up' : `Subscription - ${id}`),
                order_id: orderData.orderId,
                prefill: {
                    name: orderData.prefill?.name,
                    email: orderData.prefill?.email,
                },
                theme: { color: '#111827' },
                handler: async (response: RazorpayResponse) => {
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
                        const verifyData = await verifyResponse.json().catch(() => ({}))

                        if (!verifyResponse.ok) {
                            throw new Error(verifyData.error
                                || `We could not confirm your payment. If you were charged, contact support with payment ID ${response.razorpay_payment_id}.`)
                        }

                        const credits = Number(verifyData.credits) || orderData.credits
                        setError(null) // an earlier failed attempt in the same checkout no longer applies
                        setSuccess(orderType === 'topup'
                            ? `Payment successful. ${Number(credits).toLocaleString()} credits were added to your account.`
                            : verifyData.planPending
                                ? `Payment successful and ${Number(credits).toLocaleString()} credits were added. `
                                    + 'Your plan change is still being applied; refresh this page in a minute.'
                                : `Payment successful. Your plan is active and ${Number(credits).toLocaleString()} credits were added.`)

                        // Refresh plan and credits everywhere in the app
                        window.dispatchEvent(new Event('credits-updated'))
                    } catch (verifyErr) {
                        setError(verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed')
                    } finally {
                        done()
                    }
                },
                modal: {
                    ondismiss: done,
                },
            }

            const rzp = new window.Razorpay(options)

            // Razorpay explains a failed attempt in the browser. Show it to the
            // buyer and store it on the order: that reason never reached the
            // server before, so failed and abandoned checkouts looked the same.
            rzp.on('payment.failed', (failure: RazorpayFailure) => {
                const e = failure?.error ?? {}
                const why = e.description ? `: ${e.description.replace(/\.$/, '')}` : ''
                setError(`Payment failed${why}. No payment was taken; if your bank shows a debit, it is reversed automatically. `
                    + 'You can try again or use another payment method.')
                fetch('/api/payments/failed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_order_id: e.metadata?.order_id || orderData.orderId,
                        error: { code: e.code, description: e.description, reason: e.reason, source: e.source, step: e.step },
                    }),
                    keepalive: true,
                }).catch(() => { /* reporting must never break checkout */ })
            })

            rzp.open()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment failed')
            done()
        }
    }, [])

    return { initiatePayment, isProcessing, processingPlanId, error, success }
}
