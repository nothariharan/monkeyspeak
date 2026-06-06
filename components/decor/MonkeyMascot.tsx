'use client'

export default function MonkeyMascot({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <rect x="8" y="20" width="48" height="36" rx="0" fill="#d4a574" stroke="var(--border)" strokeWidth="2" />
      <circle cx="20" cy="28" r="10" fill="#c4956a" stroke="var(--border)" strokeWidth="2" />
      <circle cx="44" cy="28" r="10" fill="#c4956a" stroke="var(--border)" strokeWidth="2" />
      <rect x="18" y="32" width="28" height="22" fill="#e8c9a0" stroke="var(--border)" strokeWidth="2" />
      <circle cx="26" cy="40" r="4" fill="#111" />
      <circle cx="38" cy="40" r="4" fill="#111" />
      <ellipse cx="32" cy="48" rx="6" ry="4" fill="#c4956a" stroke="var(--border)" strokeWidth="1.5" />
      <path d="M28 48 Q32 52 36 48" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M14 18 Q8 8 4 14" stroke="var(--border)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 18 Q56 8 60 14" stroke="var(--border)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
