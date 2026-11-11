import type { Metadata } from 'next'
import './dashboard.css'

// Internal support dashboard for the Decible team (password protected). Everything for it lives
// under /dashboard, and its styles only apply inside the .dd wrapper, so the rest of the site is
// unaffected.
export const metadata: Metadata = {
    title: 'Decible Support',
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <div className="dd">{children}</div>
}
