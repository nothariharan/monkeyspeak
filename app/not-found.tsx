import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: 'var(--bg)', color: 'var(--text-active)' }}
    >
      <span className="text-6xl">🐒</span>
      <h1 className="font-display font-black text-3xl">404</h1>
      <p className="font-mono text-xs max-w-sm" style={{ color: 'var(--text-stats)' }}>
        this page swung off into the jungle. nothing to read aloud here.
      </p>
      <Link href="/" className="desk-btn desk-btn-primary">
        back to the test
      </Link>
    </div>
  )
}
