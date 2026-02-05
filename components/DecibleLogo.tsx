'use client'

import React from 'react'

interface DecibleLogoProps {
  size?: number
  className?: string
}

// Shared Decible Logo — D crosshair mark with red recording dot
// Uses currentColor for the main shape so it inherits from parent text color
export default function DecibleLogo({ size = 32, className = '' }: DecibleLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Vertical crosshair line */}
      <rect x="22" y="5" width="7" height="90" fill="currentColor"/>
      {/* Left top horizontal crosshair */}
      <rect x="5" y="28" width="22" height="7" fill="currentColor"/>
      {/* Left bottom horizontal crosshair */}
      <rect x="5" y="65" width="22" height="7" fill="currentColor"/>
      {/* Right top horizontal crosshair */}
      <rect x="73" y="28" width="22" height="7" fill="currentColor"/>
      {/* Right bottom horizontal crosshair */}
      <rect x="73" y="65" width="22" height="7" fill="currentColor"/>
      {/* D shape - thick rounded D */}
      <path
        d="M29 18 L29 82 L52 82 C75 82 90 67 90 50 C90 33 75 18 52 18 L29 18 Z M36 25 L52 25 C70 25 83 36 83 50 C83 64 70 75 52 75 L36 75 L36 25 Z"
        fill="currentColor"
      />
      {/* Red recording dot */}
      <circle cx="58" cy="50" r="14" fill="#EF4444"/>
    </svg>
  )
}
