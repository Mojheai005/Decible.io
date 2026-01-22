import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, Trash2, Info, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import { useNotifications, Notification } from '@/contexts/NotificationContext'

const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
}

const colors = {
    success: 'text-green-500 bg-green-50',
    error: 'text-red-500 bg-red-50',
    warning: 'text-amber-500 bg-amber-50',
    info: 'text-blue-500 bg-blue-50',
}

interface NotificationItemProps {
    notification: Notification
    onMarkRead: (id: string) => void
    onRemove: (id: string) => void
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkRead, onRemove }) => {
    const Icon = icons[notification.type]
    const colorClass = colors[notification.type]

    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
        if (seconds < 60) return 'Just now'
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
    }

    return (
        <div
            className={`group flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer ${notification.read ? 'bg-transparent hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
            onClick={() => {
                if (!notification.read) onMarkRead(notification.id)
                notification.action?.onClick?.()
            }}
        >
            <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
                <Icon className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-semibold truncate ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notification.title}
                    </h4>
                    {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                <span className="text-[10px] text-gray-400 mt-1 block">{timeAgo(notification.timestamp)}</span>
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); onRemove(notification.id) }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}

interface NotificationDropdownProps {
    isOpen: boolean
    onClose: () => void
    anchorRef?: React.RefObject<HTMLElement | null>
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, anchorRef }) => {
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAllNotifications
    } = useNotifications()

    const [position, setPosition] = useState({ top: 0, right: 0 })
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Calculate position when opened
    useEffect(() => {
        if (isOpen && anchorRef?.current) {
            const rect = anchorRef.current.getBoundingClientRect()
            setPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right
            })
        }
    }, [isOpen, anchorRef])

    // If no anchor ref, use a default position (top right area)
    useEffect(() => {
        if (isOpen && !anchorRef) {
            setPosition({
                top: 64, // Below header
                right: 16
            })
        }
    }, [isOpen, anchorRef])

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return

        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                onClose()
            }
        }

        // Delay to avoid immediate close
        const timer = setTimeout(() => {
            document.addEventListener('click', handleClick)
        }, 10)

        return () => {
            clearTimeout(timer)
            document.removeEventListener('click', handleClick)
        }
    }, [isOpen, onClose])

    // Close on escape
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    // Use portal to render at document body level - ensures it's above everything
    const content = (
        <>
            {/* Invisible backdrop to catch clicks */}
            <div
                className="fixed inset-0"
                style={{ zIndex: 99998 }}
                onClick={onClose}
            />

            {/* Dropdown - fixed position with highest z-index */}
            <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="fixed w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
                style={{
                    zIndex: 99999,
                    top: position.top,
                    right: position.right,
                    maxHeight: 'calc(100vh - 100px)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-600 rounded-full">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {notifications.length > 0 && (
                            <>
                                <button
                                    onClick={markAllAsRead}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Mark all as read"
                                >
                                    <CheckCheck className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={clearAllNotifications}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Clear all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ml-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bell className="w-7 h-7 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">No notifications yet</p>
                            <p className="text-xs text-gray-400 mt-1">We'll notify you when something arrives</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {notifications.map(notification => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={markAsRead}
                                    onRemove={removeNotification}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                        <button className="w-full text-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors py-1">
                            View all notifications
                        </button>
                    </div>
                )}
            </motion.div>
        </>
    )

    // Render via portal to body
    if (typeof document !== 'undefined') {
        return createPortal(content, document.body)
    }

    return content
}

export default NotificationDropdown
