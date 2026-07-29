// ===========================================
// COURSE BUYER BONUS
// Grants a one-time credit bonus (default 500,000) to users whose email
// is in the course_entitlements table. The claim is atomic: the row is
// flipped granted=false -> true first, so parallel logins can never
// double-grant. If the credit RPC then fails, the claim is rolled back
// so the next login retries.
// ===========================================

import { getAdminClient } from './supabase/admin'

export async function grantCourseBonusIfEligible(userId: string, email: string | undefined | null): Promise<number> {
    if (!email) return 0

    try {
        const admin = getAdminClient()
        const normalized = email.trim().toLowerCase()

        // Atomic claim: only one request can flip granted to true
        const { data: claimed, error: claimError } = await admin
            .from('course_entitlements')
            .update({
                granted: true,
                granted_at: new Date().toISOString(),
                granted_user_id: userId,
            })
            .eq('email', normalized)
            .eq('granted', false)
            .select('credits')

        if (claimError) {
            // Table may not exist yet (setup SQL not run) — fail soft
            console.error('[CourseBonus] claim check failed:', claimError.message)
            return 0
        }
        if (!claimed || claimed.length === 0) {
            return 0 // not a course buyer, or already granted
        }

        const credits = (claimed[0] as { credits: number }).credits || 500000

        const { error: grantError } = await admin.rpc('add_credits', {
            p_user_id: userId,
            p_amount: credits,
            p_type: 'bonus',
            p_description: 'Course buyer bonus — welcome!',
            p_reference_id: `course_${normalized}`,
        })

        if (grantError) {
            console.error('[CourseBonus] add_credits failed, rolling back claim:', grantError.message)
            await admin
                .from('course_entitlements')
                .update({ granted: false, granted_at: null, granted_user_id: null })
                .eq('email', normalized)
            return 0
        }

        console.log(`[CourseBonus] Granted ${credits} credits to ${normalized}`)
        return credits
    } catch (err) {
        console.error('[CourseBonus] unexpected error:', err)
        return 0
    }
}
