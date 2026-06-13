import Image from 'next/image'

interface LogoMarkProps {
  className?: string
}

export default function LogoMark({ className = '' }: LogoMarkProps) {
  return (
    <span className={`logo-mark ${className}`.trim()} aria-label="monkeyspeak">
      <Image
        src="/logo.png"
        alt=""
        width={34}
        height={34}
        className="logo-mark__icon"
        priority
      />
      <span className="logo-mark__word">
        <span className="logo-mark__monkey">monkey</span>
        <span className="logo-mark__speak">speak</span>
      </span>
    </span>
  )
}
