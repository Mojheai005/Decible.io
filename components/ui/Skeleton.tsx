import React from 'react'

interface SkeletonProps {
    className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
    return (
        <div
            className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
            style={{
                animation: 'shimmer 1.5s ease-in-out infinite',
            }}
        />
    )
}

// Voice Card Skeleton for VoiceLibrary
export const VoiceCardSkeleton: React.FC = () => {
    return (
        <tr className="border-b border-gray-50">
            <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="w-6 h-6 rounded" />
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <Skeleton className="h-6 w-20 rounded-full" />
            </td>
            <td className="px-6 py-4">
                <Skeleton className="h-4 w-12" />
            </td>
            <td className="px-6 py-4">
                <Skeleton className="h-4 w-14" />
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="w-8 h-8 rounded-full" />
                </div>
            </td>
        </tr>
    )
}

// Voice List Skeleton (multiple rows)
export const VoiceListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
    return (
        <tbody className="bg-white">
            {Array.from({ length: count }).map((_, index) => (
                <VoiceCardSkeleton key={index} />
            ))}
        </tbody>
    )
}

// Dashboard Card Skeleton
export const DashboardCardSkeleton: React.FC = () => {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-3 w-32" />
        </div>
    )
}

// Voice Dropdown Skeleton
export const VoiceDropdownSkeleton: React.FC = () => {
    return (
        <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="w-8 h-8 rounded-full" />
                </div>
            ))}
        </div>
    )
}

// Use Case Card Skeleton
export const UseCaseCardSkeleton: React.FC = () => {
    return (
        <div className="rounded-2xl overflow-hidden">
            <Skeleton className="h-24 w-full" />
        </div>
    )
}

// Text Input Skeleton
export const TextAreaSkeleton: React.FC = () => {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 p-10 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
        </div>
    )
}

// Add shimmer keyframes via style tag
export const SkeletonStyles: React.FC = () => (
    <style>{`
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    `}</style>
)

export default Skeleton
