'use client'

import { useId } from 'react'
import type { KaiState } from '@/types'

interface KaiAvatarProps {
  state: KaiState
  size?: number
}

export default function KaiAvatar({ state, size = 120 }: KaiAvatarProps) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '')

  const breatheClass = `kai-breathe-${uid}`
  const headSwayClass = `kai-headsway-${uid}`
  const mouthTalkClass = `kai-mouth-${uid}`
  const mouthIdleClass = `kai-mouth-idle-${uid}`
  const blinkClass = `kai-blink-${uid}`
  const eyesThinkClass = `kai-eyesthink-${uid}`
  const dotClass = (n: number) => `kai-dot-${n}-${uid}`

  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-block select-none"
      aria-label={`Kai — estado ${state}`}
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

        .kai-root-${uid} {
          animation: ${state === 'idle' ? `${breatheClass} 3s ease-in-out infinite` : 'none'};
        }
        .kai-head-${uid} {
          transform-origin: 60px 65px;
          animation: ${state === 'talking' ? `${headSwayClass} 0.6s ease-in-out infinite` : 'none'};
        }
        .kai-mouth-${uid} {
          transform-origin: center;
          animation: ${
            state === 'talking'
              ? `${mouthTalkClass} 0.3s ease-in-out infinite`
              : `${mouthIdleClass} 1s ease-in-out infinite`
          };
        }
        .kai-eyes-${uid} {
          transform-origin: center;
          animation: ${state === 'thinking' ? `${eyesThinkClass} 1.6s ease-in-out infinite` : 'none'};
        }
        .kai-eye-${uid} {
          transform-origin: center;
          animation: ${state === 'talking' ? `${blinkClass} 4s ease-in-out infinite` : 'none'};
        }
        .kai-thinking-dots-${uid} {
          opacity: ${state === 'thinking' ? 1 : 0};
          transition: opacity 0.2s ease;
        }
        .kai-thinking-dots-${uid} circle:nth-child(1) { animation: ${dotClass(1)} 1.4s ease-in-out infinite; }
        .kai-thinking-dots-${uid} circle:nth-child(2) { animation: ${dotClass(2)} 1.4s ease-in-out infinite; }
        .kai-thinking-dots-${uid} circle:nth-child(3) { animation: ${dotClass(3)} 1.4s ease-in-out infinite; }
      `}</style>

      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className={`kai-root-${uid}`}
      >
        <defs>
          <radialGradient id={`kai-bg-${uid}`} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#00d4aa" />
            <stop offset="100%" stopColor="#00695c" />
          </radialGradient>
        </defs>

        {/* thinking dots */}
        <g className={`kai-thinking-dots-${uid}`}>
          <circle cx="42" cy="10" r="3" fill="#ffffff" />
          <circle cx="54" cy="6" r="3" fill="#ffffff" />
          <circle cx="66" cy="10" r="3" fill="#ffffff" />
        </g>

        {/* background circle */}
        <circle cx="60" cy="60" r="56" fill={`url(#kai-bg-${uid})`} />

        {/* leaf icon, bottom-right corner */}
        <g transform="translate(88, 88)">
          <circle r="13" fill="#0d1117" opacity="0.25" />
          <path
            d="M0,7 C-6,7 -8,1 -6,-6 C1,-8 7,-4 7,2 C7,5 4,7 0,7 Z"
            fill="#5eead4"
          />
          <path d="M-5,-5 L4,4" stroke="#00695c" strokeWidth="1.2" strokeLinecap="round" />
        </g>

        {/* head group */}
        <g className={`kai-head-${uid}`}>
          {/* neck */}
          <rect x="52" y="70" width="16" height="14" rx="6" fill="#d9a679" />
          {/* face */}
          <circle cx="60" cy="55" r="26" fill="#e3b48a" />
          {/* hair — short dark hair */}
          <path
            d="M34,50
               C32,30 46,18 60,18
               C74,18 88,30 86,50
               C83,42 76,36 76,36
               C70,44 50,44 44,36
               C44,36 37,42 34,50 Z"
            fill="#2b2118"
          />
          {/* eyebrows for thinking */}
          {state === 'thinking' && (
            <>
              <path d="M46,47 Q50,44 55,46" stroke="#2b2118" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M65,46 Q70,44 74,47" stroke="#2b2118" strokeWidth="2" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* eyes */}
          <g className={`kai-eyes-${uid}`}>
            <ellipse cx="50" cy="54" rx="3.2" ry="4" fill="#1a1a1a" className={`kai-eye-${uid}`} />
            <ellipse cx="70" cy="54" rx="3.2" ry="4" fill="#1a1a1a" className={`kai-eye-${uid}`} />
          </g>

          {/* nose */}
          <path d="M59,58 Q57,64 60,65" stroke="#c9986a" strokeWidth="1.5" fill="none" strokeLinecap="round" />

          {/* mouth */}
          {state === 'talking' ? (
            <ellipse
              cx="60"
              cy="70"
              rx="7"
              ry="4"
              fill="#7a2e2e"
              className={`kai-mouth-${uid}`}
            />
          ) : (
            <path
              d="M50,69 Q60,76 70,69"
              stroke="#7a2e2e"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              className={`kai-mouth-${uid}`}
            />
          )}
        </g>
      </svg>
    </div>
  )
}
