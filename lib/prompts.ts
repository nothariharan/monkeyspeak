import type { PromptType, Duration } from '@/store/testStore'

// ─── Sentence banks ───────────────────────────────────────────────────────────

const CASUAL: string[] = [
  'The coffee machine in the break room has been broken for three weeks and nobody has fixed it.',
  'I finally finished the book I started reading six months ago and the ending was surprisingly good.',
  'We should grab lunch sometime this week if your schedule clears up on Thursday or Friday.',
  'The traffic this morning was absolutely terrible and I ended up being twenty minutes late.',
  'She sent me a message asking if I wanted to join her book club but I already have too many commitments.',
  'The new park they built near the river is actually really nice once you get past the parking situation.',
  'I ordered that thing online three weeks ago and it still has not shown up at my door.',
  'My neighbour has been playing music until two in the morning every single night this week.',
  'We ended up staying at the restaurant for almost four hours because the conversation was so good.',
  'The dog figured out how to open the back gate and now I have to buy a completely new lock.',
  'I have been trying to learn a new language for about six months now and I can finally hold a basic conversation.',
  'The presentation went way better than I expected and the client seemed genuinely interested in moving forward.',
  'She called me out of nowhere on a Tuesday and told me she was moving to another country next month.',
  'The gym I go to keeps changing its opening hours and I can never figure out when it is actually open.',
  'I tried making that recipe you sent me but I think I added too much salt and it was completely inedible.',
  'The forecast said it would be sunny all week but it has rained every single day so far.',
  'My phone battery dies before noon even when I charge it overnight and I cannot figure out what is draining it.',
  'We were supposed to leave at eight but ended up not getting out of the house until almost ten.',
  'The new neighbourhood pizza place is honestly better than anywhere we have been in years.',
  'I keep meaning to clean out the garage but something always comes up at the last minute.',
  'She mentioned offhand that she got promoted and acted like it was completely not a big deal.',
  'The meeting that was supposed to take thirty minutes somehow stretched into two full hours.',
  'I finally switched to a standing desk and my back has not bothered me nearly as much this week.',
  'We found this tiny cafe tucked away down a side street and it became our regular spot immediately.',
  'The checkout queue at the supermarket yesterday was so long I almost just put everything back and left.',
  'My laptop started making a weird noise last night and now I am worried I need to replace the whole thing.',
  'She sent the wrong file to the entire company and it caused a whole situation that lasted for days.',
  'I got to the cinema late and missed the first ten minutes and now the entire plot makes no sense to me.',
  'The landlord said he would fix the leak in the bathroom ceiling last month and it is still dripping.',
  'We drove all the way out there only to find out the place was closed on Mondays.',
]

const TECHNICAL: string[] = [
  'The API endpoint returns a four hundred and twenty-two status when the request body fails schema validation.',
  'We need to refactor the authentication middleware before we can safely ship the new user permission model.',
  'The pull request was blocked because the integration tests were flaking on the CI pipeline for three days.',
  'Memory usage spikes every four hours which suggests there is a leak somewhere in the background worker process.',
  'The database migration rolled back automatically because the foreign key constraint failed on the staging environment.',
  'We are moving from a monolithic architecture to microservices and the service mesh is the biggest challenge right now.',
  'The rate limiter is configured to allow two hundred requests per minute per IP address across all endpoints.',
  'Deploying to production requires a manual approval step in the pipeline to prevent accidental rollouts on Fridays.',
  'The load balancer health check was hitting the wrong port and causing half the instances to fall out of rotation.',
  'The feature flag is enabled for five percent of users in production as part of the gradual rollout strategy.',
  'We switched from polling to WebSockets to reduce latency for real-time collaborative editing features.',
  'The query was doing a full table scan because the composite index was not being used by the query planner.',
  'She opened a ticket for the race condition in the payment processing flow that only shows up under high load.',
  'The object storage bucket policy was too permissive and the security team flagged it during the quarterly audit.',
  'We containerised the entire stack using Docker and the local development environment now matches production exactly.',
  'The cache invalidation logic is coupled too tightly to the business layer and needs to be extracted into its own service.',
  'Our SLA requires ninety-nine point nine percent uptime which means we have less than nine hours of downtime per year.',
  'The new telemetry pipeline ingests about forty million events per day and stores them in a columnar format for analytics.',
  'We switched from a custom serialisation format to Protocol Buffers and the payload size dropped by sixty percent.',
  'The A/B test ran for three weeks and the variant with the simplified onboarding flow had a fourteen percent higher conversion rate.',
  'The distributed tracing showed that ninety percent of the latency was coming from a single synchronous call to the inventory service.',
  'We use an optimistic locking strategy to handle concurrent edits without requiring a global database-level lock.',
  'The webhook delivery system retries up to five times with exponential backoff before marking an event as permanently failed.',
  'Kubernetes autoscaling is triggered when CPU usage exceeds seventy percent averaged across all pods for two consecutive minutes.',
  'The end-to-end encryption implementation uses asymmetric key pairs with a rotating symmetric session key for each connection.',
  'The GraphQL resolver has an N plus one query problem that we need to solve with a dataloader batching layer.',
  'Branch protection rules require at least two approvals and a passing status check before any merge to main.',
  'The canary deployment went wrong because the new service version had a breaking change in the event schema.',
  'We instrumented every function call with structured logging so we can reconstruct any request in the audit trail.',
  'The chaos engineering exercise revealed that the system fails ungracefully when the primary region loses connectivity.',
]

const TONGUE_TWISTERS: string[] = [
  'She sells seashells by the seashore and the shells she sells are surely seashells.',
  'How much wood would a woodchuck chuck if a woodchuck could chuck wood.',
  'Peter Piper picked a peck of pickled peppers and a peck of pickled peppers Peter Piper picked.',
  'Whether the weather is warm whether the weather is hot we have to put up with the weather whether we like it or not.',
  'Fuzzy Wuzzy was a bear and Fuzzy Wuzzy had no hair so Fuzzy Wuzzy was not very fuzzy was he.',
  'The thirty-three thieves thought that they thrilled the throne throughout Thursday.',
  'I scream you scream we all scream for ice cream on a clean cream screen.',
  'Red lorry yellow lorry red lorry yellow lorry said rapidly six times without stumbling.',
  'A proper copper coffee pot sitting on a proper copper shelf in a copper coffee shop.',
  'Unique New York unique New York you know you need unique New York.',
  'Betty Botter bought some butter but the butter was bitter so Betty bought some better butter.',
  'Six sick slick slim sycamore saplings standing in a row by the silently shimmering sea.',
  'Swan swam over the sea swim swan swim and swan swam back again well swum swan.',
  'The big black bug bit the big black bear but the big black bear bit the big black bug back.',
  'Lesser leather never weathered wetter weather better than leather and lighter leather.',
  'Which witch switched the Swiss wristwatches and which wristwatch was Swiss.',
  'Through three cheese trees three free fleas flew while these fleas flew freezy breezes blew.',
  'A skunk sat on a stump and thunk the stump stunk but the stump thunk the skunk stunk.',
  'She sees cheese on these shelves and these shelves she sees are cheese she sees.',
  'Toy boat toy boat toy boat said ten times fast without tripping over your tongue.',
]

const NUMBERS: string[] = [
  'forty seven two hundred and twelve fifteen sixty three nine hundred and one',
  'thirty eight thousand four hundred and twenty six minus one thousand and twelve',
  'one million two hundred and fifty thousand and one point nine nine',
  'seventy two divided by eight equals nine exactly',
  'four score and seven years is eighty seven years in total',
  'three hundred and sixty five days in a year except during leap years with three hundred and sixty six',
  'two thirds of nine hundred is six hundred which is sixty six point six percent',
  'ninety nine bottles of something on the wall take one down and you have ninety eight',
  'one two three four five six seven eight nine ten eleven twelve',
  'five hundred and twelve gigabytes is half a terabyte',
  'twenty four hours in a day seven days in a week fifty two weeks in a year',
  'the square root of one hundred and forty four is twelve exactly',
  'one thousand and twenty four is two to the power of ten',
  'three point one four one five nine two six is how pi begins',
  'sixty seconds per minute sixty minutes per hour twenty four hours per day',
  'eight multiplied by seven is fifty six not fifty seven or fifty five',
  'nine hundred and ninety nine thousand nine hundred and ninety nine',
  'one hundred billion divided by one hundred million is one thousand',
  'forty four forty four forty four forty four forty four forty four',
  'a dozen is twelve a gross is one hundred and forty four a myriad is ten thousand',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Target word counts per duration to ensure the prompt never runs out mid-test.
 * Uses ~150 wpm as a generous upper-end estimate.
 */
const WORD_COUNT_TARGET: Record<number, number> = {
  15:  45,
  30:  90,
  60:  175,
  120: 350,
}

/**
 * Get a prompt word array for the given type and duration.
 * For custom mode, pass the custom text directly.
 */
export function getPrompt(
  type: PromptType,
  duration: number,
  customText?: string
): string[] {
  const targetWords = WORD_COUNT_TARGET[duration] ?? 90

  if (type === 'custom' && customText) {
    return customText
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean)
  }

  let bank: string[]
  switch (type) {
    case 'technical':      bank = TECHNICAL;       break
    case 'tongue-twisters': bank = TONGUE_TWISTERS; break
    case 'numbers':         bank = NUMBERS;          break
    default:                bank = CASUAL;           break
  }

  const shuffled = shuffle(bank)
  const words: string[] = []

  let idx = 0
  while (words.length < targetWords) {
    const sentence = shuffled[idx % shuffled.length]
    const sentenceWords = sentence.split(/\s+/).filter(Boolean)
    words.push(...sentenceWords)
    idx++
  }

  return words.slice(0, targetWords + 20) // a little buffer
}
