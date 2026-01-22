import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useNotifications, Toast as ToastType } from '@/contexts/NotificationContext'

const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
}

const colors = {
    success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-500',
        text: 'text-green-800',
    },
    error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-500',
        text: 'text-red-800',
    },
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-500',
        text: 'text-amber-800',
    },
    info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-500',
        text: 'text-blue-800',
    },
}

interface ToastItemProps {
    toast: ToastType
    onDismiss: (id: string) => void
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
    const Icon = icons[toast.type]
    const color = colors[toast.type]

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${color.bg} ${color.border} max-w-sm`}
        >
            <Icon className={`w-5 h-5 shrink-0 ${color.icon}`} />
            <p className={`text-sm font-medium flex-1 ${color.text}`}>{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                className={`p-1 rounded-lg hover:bg-black/5 transition-colors ${color.text}`}
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    )
}

export const ToastContainer: React.FC = () => {
    const { toasts, dismissToast } = useNotifications()

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
                ))}
            </AnimatePresence>
        </div>
    )
}

export default ToastContainer
