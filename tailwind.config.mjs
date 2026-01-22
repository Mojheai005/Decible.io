/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './App.tsx',
    ],
    theme: {
        extend: {
            colors: {
                background: '#ffffff',
                foreground: '#000000',
                sidebar: '#f9fafb',
                border: '#e5e7eb',
                muted: '#6b7280',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            boxShadow: {
                'premium': '0 20px 40px -10px rgba(0, 0, 0, 0.05)',
                'glow': '0 0 20px rgba(0, 0, 0, 0.1)',
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.05)'
            },
            animation: {
                'blob': 'blob 7s infinite',
                'float': 'float 6s ease-in-out infinite'
            },
            keyframes: {
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' }
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' }
                }
            }
        }
    },
    plugins: [],
}
