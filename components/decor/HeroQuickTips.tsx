'use client'

const TIPS = [
  'read what is shown on the screen',
  'speak clearly at a steady pace',
  'allow mic access before you start',
  'beat your last score, not someone else',
]

export default function HeroQuickTips() {
  return (
    <section className="hero-sticky-note hero-sticky-note--tips hero-animate" aria-label="Quick tips">
      <span className="hero-paper-tape hero-paper-tape--purple" aria-hidden />
      <div className="hero-sticky-note-head">
        <span className="hero-sticky-note-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12v2h8v-2a7 7 0 0 0-4-12z" />
          </svg>
        </span>
        <h3>quick tips</h3>
      </div>

      <ul className="hero-tips-list">
        {TIPS.map((tip) => (
          <li key={tip}>
            <span className="hero-tips-check" aria-hidden />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
