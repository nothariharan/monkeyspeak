import type { Metadata } from 'next'
import PreviewClient from './PreviewClient'

/*
  standalone design-verification page. renders the shared SpeedResultsView with
  mock data so the look can be checked at /results-preview without a real run.
*/

export const metadata: Metadata = {
  title: 'MonkeySpeak — results preview',
  robots: { index: false, follow: false },
}

export default function ResultsPreviewPage() {
  return <PreviewClient />
}
