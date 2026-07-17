'use client'

import { useId } from 'react'
import type { KaiState } from '@/types'

interface LunaAvatarProps {
  state: KaiState
  size?: number
}

export default function LunaAvatar({ state, size = 120 }: LunaAvatarProps) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '')

  const breatheClass = `luna-breathe-${uid}`
  const headSwayClass = `luna-headsway-${uid}`
  const mouthTalkClass = `luna-mouth-${uid}`
  const mouthIdleClass = `luna-mouth-idle-${uid}`
  const blinkClass = `luna-blink-${uid}`
  const eyesThinkClass = `luna-eyesthink-${uid}`
  const dotClass = (n: number) => `luna-dot-${n}-${uid}`

  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-block select-none"
      aria-label={`Luna — estado ${state}`}
    >
      <style>{`
        @keyframes ${breatheClass} {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes ${headSwayClass} {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        @keyframes ${mouthTalkClass} {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        @keyframes ${mouthIdleClass} {
          0%, 100% { transform: scaleY(1); }
        }
        @keyframes ${blinkClass} {
          0%, 94%, 100% { transform: scaleY(1); }
          96%, 98% { transform: scaleY(0.1); }
        }
        @keyframes ${eyesThinkClass} {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        @keyframes ${dotClass(1)} {
          0%, 100% { opacity: 0.15; }
          20% { opacity: 1; }
        }
        @keyframes ${dotClass(2)} {
          0%, 100% { opacity: 0.15; }
          40% { opacity: 1; }
        }
        @keyframes ${dotClass(3)} {
          0%, 100% { opacity: 0.15; }
          60% { opacity: 1; }
        }

        .luna-root-${uid} {
          animation: ${state === 'idle' ? `${breatheClass} 3s ease-in-out infinite` : 'none'};
        }
        .luna-head-${uid} {
          transform-origin: 60px 65px;
          animation: ${state === 'talking' ? `${headSwayClass} 0.6s ease-in-out infinite` : 'none'};
        }
        .luna-mouth-${uid} {
          transform-origin: center;
          animation: ${
            state === 'talking'
              ? `${mouthTalkClass} 0.3s ease-in-out infinite`
              : `${mouthIdleClass} 1s ease-in-out infinite`
          };
        }
        .luna-eyes-${uid} {
          transform-origin: center;
          animation: ${state === 'thinking' ? `${eyesThinkClass} 1.6s ease-in-out infinite` : 'none'};
        }
        .luna-eye-${uid} {
          transform-origin: center;
          animation: ${state === 'talking' ? `${blinkClass} 4s ease-in-out infinite` : 'none'};
        }
        .luna-thinking-dots-${uid} {
          opacity: ${state === 'thinking' ? 1 : 0};
          transition: opacity 0.2s ease;
        }
        .luna-thinking-dots-${uid} circle:nth-child(1) { animation: ${dotClass(1)} 1.4s ease-in-out infinite; }
        .luna-thinking-dots-${uid} circle:nth-child(2) { animation: ${dotClass(2)} 1.4s ease-in-out infinite; }
        .luna-thinking-dots-${uid} circle:nth-child(3) { animation: ${dotClass(3)} 1.4s ease-in-out infinite; }
      `}</style>

      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className={`luna-root-${uid}`}
      >
        <defs>
          <radialGradient id={`luna-bg-${uid}`} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
          <linearGradient id={`luna-hair-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4c2a63" />
            <stop offset="100%" stopColor="#2d1b3d" />
          </linearGradient>
        </defs>

        {/* thinking dots */}
        <g className={`luna-thinking-dots-${uid}`}>
          <circle cx="42" cy="10" r="3" fill="#ffffff" />
          <circle cx="54" cy="6" r="3" fill="#ffffff" />
          <circle cx="66" cy="10" r="3" fill="#ffffff" />
        </g>

        {/* background circle */}
        <circle cx="60" cy="60" r="56" fill={`url(#luna-bg-${uid})`} />

        {/* leaf icon, bottom-right corner (shared health-coach reference) */}
        <g transform="translate(88, 88)">
          <circle r="13" fill="#2d1b3d" opacity="0.25" />
          <path
            d="M0,7 C-6,7 -8,1 -6,-6 C1,-8 7,-4 7,2 C7,5 4,7 0,7 Z"
            fill="#ec4899"
          />
          <path d="M-5,-5 L4,4" stroke="#7c3aed" strokeWidth="1.2" strokeLinecap="round" />
        </g>

        {/* long hair — behind head, falls past shoulders */}
        <path
          d="M30,58
             C26,80 30,98 38,104
             L44,104
             C40,90 40,74 42,60
             Z"
          fill={`url(#luna-hair-${uid})`}
        />
        <path
          d="M90,58
             C94,80 90,98 82,104
             L76,104
             C80,90 80,74 78,60
             Z"
          fill={`url(#luna-hair-${uid})`}
        />

        {/* head group */}
        <g className={`luna-head-${uid}`}>
          {/* neck */}
          <rect x="52" y="70" width="16" height="14" rx="6" fill="#e8bfa0" />
          {/* face — softer, slightly narrower */}
          <ellipse cx="60" cy="55" rx="24" ry="26" fill="#f0cba8" />
          {/* long hair — front, framing the face */}
          <path
            d="M33,52
               C30,28 44,16 60,16
               C76,16 90,28 87,52
               C84,40 78,32 78,32
               C70,42 50,42 42,32
               C42,32 36,40 33,52 Z"
            fill={`url(#luna-hair-${uid})`}
          />

          {/* eyebrows for thinking */}
          {state === 'thinking' && (
            <>
              <path d="M46,46 Q50,43 55,45" stroke="#4c2a63" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M65,45 Q70,43 74,46" stroke="#4c2a63" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* eyes — softer almond shape with lashes */}
          <g className={`luna-eyes-${uid}`}>
            <ellipse cx="50" cy="54" rx="3.4" ry="4.2" fill="#2d1b3d" className={`luna-eye-${uid}`} />
            <ellipse cx="70" cy="54" rx="3.4" ry="4.2" fill="#2d1b3d" className={`luna-eye-${uid}`} />
            <path d="M46,50 Q50,48 54,50" stroke="#2d1b3d" strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d="M66,50 Q70,48 74,50" stroke="#2d1b3d" strokeWidth="1" fill="none" strokeLinecap="round" />
          </g>

          {/* blush */}
          <ellipse cx="44" cy="61" rx="4" ry="2.5" fill="#ec4899" opacity="0.25" />
          <ellipse cx="76" cy="61" rx="4" ry="2.5" fill="#ec4899" opacity="0.25" />

          {/* nose */}
          <path d="M59,58 Q57,64 60,65" stroke="#d9a679" strokeWidth="1.3" fill="none" strokeLinecap="round" />

          {/* mouth */}
          {state === 'talking' ? (
            <ellipse
              cx="60"
              cy="70"
              rx="6.5"
              ry="3.8"
              fill="#c2447a"
              className={`luna-mouth-${uid}`}
            />
          ) : (
            <path
              d="M51,69 Q60,75 69,69"
              stroke="#c2447a"
              strokeWidth="2.3"
              fill="none"
              strokeLinecap="round"
              className={`luna-mouth-${uid}`}
            />
          )}
        </g>
      </svg>
    </div>
  )
}
