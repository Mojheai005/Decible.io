'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// ===========================================
// NOTIFICATION TYPES
// ===========================================

export interface Notification {
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    timestamp: Date
    read: boolean
    action?: {
        label: string
        onClick: () => void
    }
}

export interface Toast {
    id: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    duration?: number
}

interface NotificationContextType {
    // Notifications (persistent, shown in bell dropdown)
    notifications: Notification[]
    unreadCount: number
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
    markAsRead: (id: string) => void
    markAllAsRead: () => void
    removeNotification: (id: string) => void
    clearAllNotifications: () => void

    // Toasts (temporary, shown as popups)
    toasts: Toast[]
    showToast: (message: string, type?: Toast['type'], duration?: number) => void
    dismissToast: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// ===========================================
// NOTIFICATION PROVIDER
// ===========================================

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [toasts, setToasts] = useState<Toast[]>([])

    // Generate unique ID
    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // ===========================================
    // NOTIFICATION METHODS
    // ===========================================

    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: Notification = {
            ...notification,
            id: generateId(),
            timestamp: new Date(),
            read: false,
        }
        setNotifications(prev => [newNotification, ...prev].slice(0, 50)) // Keep max 50
    }, [])

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        )
    }, [])

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }, [])

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }, [])

    const clearAllNotifications = useCallback(() => {
        setNotifications([])
    }, [])

    const unreadCount = notifications.filter(n => !n.read).length

    // ===========================================
    // TOAST METHODS
    // ===========================================

    const showToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 4000) => {
        const id = generateId()
        const toast: Toast = { id, message, type, duration }

        setToasts(prev => [...prev, toast])

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                dismissToast(id)
            }, duration)
        }
    }, [])

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            addNotification,
            markAsRead,
            markAllAsRead,
            removeNotification,
            clearAllNotifications,
            toasts,
            showToast,
            dismissToast,
        }}>
            {children}
        </NotificationContext.Provider>
    )
}

// ===========================================
// HOOK
// ===========================================

export const useNotifications = () => {
    const context = useContext(NotificationContext)
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider')
    }
    return context
}

// Convenience hook for just toasts
export const useToast = () => {
    const { showToast, dismissToast, toasts } = useNotifications()
    return { showToast, dismissToast, toasts }
}
