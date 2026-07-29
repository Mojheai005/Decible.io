// ===========================================
// ADMIN: COURSE BUYERS
// Manage the email allowlist for the course-buyer credit bonus.
// Protected by the ADMIN_API_SECRET env var via the x-admin-secret header —
// intended for the course platform's purchase webhook (or manual curl),
// NEVER for browser/user access.
//
//   POST   { "email": "a@b.com" }  or  { "emails": ["a@b.com", ...], "credits": 500000 }
//   GET    ?granted=true|false     — list entitlements (latest 200)
//   DELETE { "email": "a@b.com" }  — remove an entitlement
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { validateEmail } from '@/lib/validation';

const DEFAULT_BONUS_CREDITS = 500000;

function checkAuth(request: NextRequest): NextResponse | null {
    const secret = process.env.ADMIN_API_SECRET;
    if (!secret) {
        return NextResponse.json({ error: 'Admin API not configured' }, { status: 503 });
    }
    const provided = request.headers.get('x-admin-secret');
    if (!provided || provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}

export async function POST(request: NextRequest) {
    const denied = checkAuth(request);
    if (denied) return denied;

    try {
        const body = await request.json();
        const rawEmails: string[] = Array.isArray(body.emails)
            ? body.emails
            : body.email ? [body.email] : [];
        const credits = Number.isInteger(body.credits) && body.credits > 0
            ? body.credits
            : DEFAULT_BONUS_CREDITS;
        const note = typeof body.note === 'string' ? body.note.slice(0, 200) : null;

        const emails = [...new Set(
            rawEmails
                .map((e: string) => String(e).trim().toLowerCase())
                .filter((e: string) => validateEmail(e))
        )];

        if (emails.length === 0) {
            return NextResponse.json({ error: 'No valid emails provided' }, { status: 400 });
        }

        const admin = getAdminClient();

        // Never overwrite existing rows (a granted row must stay granted)
        const { data: existing } = await admin
            .from('course_entitlements')
            .select('email')
            .in('email', emails);

        const existingSet = new Set((existing || []).map((r: { email: string }) => r.email));
        const toInsert = emails.filter(e => !existingSet.has(e));

        if (toInsert.length > 0) {
            const { error } = await admin
                .from('course_entitlements')
                .insert(toInsert.map(email => ({ email, credits, note })));

            if (error) {
                console.error('[Admin] course-buyers insert failed:', error.message);
                return NextResponse.json({ error: `Insert failed: ${error.message}` }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            added: toInsert,
            alreadyPresent: emails.filter(e => existingSet.has(e)),
            credits,
        });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

export async function GET(request: NextRequest) {
    const denied = checkAuth(request);
    if (denied) return denied;

    const grantedParam = new URL(request.url).searchParams.get('granted');
    const admin = getAdminClient();

    let query = admin
        .from('course_entitlements')
        .select('email, credits, granted, granted_at, note, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

    if (grantedParam === 'true') query = query.eq('granted', true);
    if (grantedParam === 'false') query = query.eq('granted', false);

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ entitlements: data, count: data?.length ?? 0 });
}

export async function DELETE(request: NextRequest) {
    const denied = checkAuth(request);
    if (denied) return denied;

    try {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        if (!validateEmail(email)) {
            return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
        }

        const admin = getAdminClient();
        const { error } = await admin.from('course_entitlements').delete().eq('email', email);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, removed: email });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
