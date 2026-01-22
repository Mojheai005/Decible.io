import { NextResponse } from 'next/server';
import { getNextApiKey } from '@/lib/dubvoice';

const DUBVOICE_BASE_URL = 'https://www.dubvoice.ai/api/v1';

export async function GET() {
    try {
        const apiKey = getNextApiKey();

        const response = await fetch(`${DUBVOICE_BASE_URL}/me`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            // Return mock data if API fails (for demo mode)
            return NextResponse.json({
                profile: {
                    id: 'demo-user',
                    email: 'demo@example.com',
                    name: 'Demo User',
                    plan: 'free',
                    totalCredits: 50000,
                    usedCredits: 0,
                    remainingCredits: 50000,
                    voiceSlots: 5,
                    resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                },
                transactions: [],
                plans: [
                    { id: 'free', name: 'Free', credits: 10000, price: 0, voiceSlots: 5 },
                    { id: 'starter', name: 'Starter', credits: 50000, price: 9, voiceSlots: 10 },
                    { id: 'pro', name: 'Pro', credits: 200000, price: 29, voiceSlots: 25 },
                    { id: 'enterprise', name: 'Enterprise', credits: 1000000, price: 99, voiceSlots: 100 },
                ]
            });
        }

        const data = await response.json();

        // Calculate remaining credits
        const totalCredits = data.credits || 50000;
        const usedCredits = data.total_used || 0;
        const remainingCredits = Math.max(0, totalCredits - usedCredits);

        // Return structured response matching useUserProfile hook expectations
        return NextResponse.json({
            profile: {
                id: data.email || 'user_id',
                email: data.email || 'user@example.com',
                name: data.email?.split('@')[0] || 'User',
                plan: 'free',
                totalCredits,
                usedCredits,
                remainingCredits,
                voiceSlots: 5,
                resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
            transactions: [],
            plans: [
                { id: 'free', name: 'Free', credits: 10000, price: 0, voiceSlots: 5 },
                { id: 'starter', name: 'Starter', credits: 50000, price: 9, voiceSlots: 10 },
                { id: 'pro', name: 'Pro', credits: 200000, price: 29, voiceSlots: 25 },
                { id: 'enterprise', name: 'Enterprise', credits: 1000000, price: 99, voiceSlots: 100 },
            ]
        });

    } catch (error) {
        console.error('Profile API Error:', error);
        // Return mock data on error
        return NextResponse.json({
            profile: {
                id: 'demo-user',
                email: 'demo@example.com',
                name: 'Demo User',
                plan: 'free',
                totalCredits: 50000,
                usedCredits: 0,
                remainingCredits: 50000,
                voiceSlots: 5,
                resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
            transactions: [],
            plans: [
                { id: 'free', name: 'Free', credits: 10000, price: 0, voiceSlots: 5 },
                { id: 'starter', name: 'Starter', credits: 50000, price: 9, voiceSlots: 10 },
                { id: 'pro', name: 'Pro', credits: 200000, price: 29, voiceSlots: 25 },
                { id: 'enterprise', name: 'Enterprise', credits: 1000000, price: 99, voiceSlots: 100 },
            ]
        });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, amount } = body;

        if (action === 'use_credits' && amount) {
            // In a real app, this would deduct credits from Supabase
            return NextResponse.json({
                success: true,
                message: `Used ${amount} credits`,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Profile POST Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
