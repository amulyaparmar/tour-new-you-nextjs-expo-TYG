'use client'

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { appendDictationText } from "@tour/shared"
import {
  ArrowRight,
  BarChart2,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  ThumbsDown,
  ThumbsUp,
  Loader2,
  MessageCircle,
  PlayCircle,
  Search,
  Share2,
  Sparkles,
  Video,
  Zap,
} from "lucide-react"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"
import tourExamplesTYG from "./tour-examples-TYG"
import { ElevenLabsDictationButton } from "./ElevenLabsDictationButton"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const interFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const generatedAssets: Record<string, string> = {
  "tour-hero-product-console": "https://tkweddqlriikqgylsuxz.supabase.co/storage/v1/object/public/images/processed/64e36049-7c12-48d8-bd38-8c66f883f04c.png",
  "tour-ai-leasing-inbox": "https://tkweddqlriikqgylsuxz.supabase.co/storage/v1/object/public/images/processed/a554d375-2136-478a-849c-0d8e435eaa07.png",
  "tour-builder": "https://tkweddqlriikqgylsuxz.supabase.co/storage/v1/object/public/images/processed/32e8da3b-e81a-4421-bcc9-c8f5fbce88fe.png",
  "tour-analytics-attribution": "https://tkweddqlriikqgylsuxz.supabase.co/storage/v1/object/public/images/processed/f0ef4b75-b345-4324-8a92-0bdbe9645a21.png",
  "tour-setup-flow": "https://tkweddqlriikqgylsuxz.supabase.co/storage/v1/object/public/images/processed/506ba81d-32c9-4f54-92d6-be1efe38d2e3.png",
  "tour-customer-outcomes": "https://tkweddqlriikqgylsuxz.supabase.co/storage/v1/object/public/images/processed/3cffed70-2f37-4cd7-8a6a-115886820509.png",
}

const coreFeatures = [
  {
    icon: Video,
    title: "Guided virtual video tours",
    text: "Turn unit, amenity, neighborhood, and floor plan content into a renter path that feels like your best in-person tour.",
  },
  {
    icon: Bot,
    title: "AI leasing agent",
    text: "Answer availability, pet, pricing, parking, amenity, and policy questions when your team is busy or offline.",
  },
  {
    icon: MessageCircle,
    title: "Personalized follow-up",
    text: "Send prospects the exact tour moments, unit recommendations, reminders, and booking links that match their intent.",
  },
  {
    icon: Calendar,
    title: "Scheduling handoff",
    text: "Move high-intent renters from video engagement to a booked in-person or virtual appointment without extra steps.",
  },
  {
    icon: BarChart2,
    title: "Analytics and attribution",
    text: "See which campaigns, website moments, tours, and AI interactions produce qualified leads and signed leases.",
  },
  {
    icon: Code2,
    title: "Website embed and integrations",
    text: "Launch the Tour widget quickly and connect leasing context to the systems your team already uses.",
  },
]

const platformPills = ["Website embed", "AI answers", "Scheduler", "Attribution", "CRM handoff"]
const BOOK_DEMO_EMBED_URL = "https://cal.com/amulya/30min?embed=true&theme=light"
const TOUR_ASSISTANT_SYSTEM_PROMPT = `You are the Tour.video website assistant.
Answer questions about Tour.video, guided virtual leasing tours, website widgets, AI answers, scheduling, video ads AI, setup, and property-team workflows.
Keep responses concise, specific, and useful for a leasing, multifamily, student housing, or property marketing buyer.
If the user asks to see samples, explain what the samples show and point them toward /samples.
If the user asks to book or schedule, tell them the demo scheduler is available in this popup.`
const customerExampleStrip = tourExamplesTYG.slice(2, 12)

// const heroAudienceWords = ["renter", "visitor", "patient", "student", "prospect", "caller", "lead", "guest"]

type WebsiteOgPreview = {
  url: string
  title: string
  description: string
  imageUrl: string | null
  faviconUrl: string | null
}

const mockSuggestionResponses: Record<string, {
  query: string
  intro: string
  bullets: Array<{ label: string; text: string; href?: string }>
  closing: string
  followUp: string
  options: string[]
}> = {
  "Website embed": {
    query: "Show me how the website embed works.",
    intro:
      "The Tour embed turns your existing property website into a guided leasing path. Visitors can start with video, ask questions, and move into high-intent actions without leaving the page.",
    bullets: [
      { label: "Instant launch", text: "drop Tour into the homepage, floor plan page, or paid landing page with one embed." },
      { label: "Context aware", text: "route visitors into amenities, pricing, scheduling, or specials based on what they click." },
      { label: "Performance tracking", text: "connect tour engagement back to leads, booked appointments, and conversion events.", href: "/samples" },
    ],
    closing: "Most teams start with the homepage widget, then add focused embeds to floor plan and availability pages.",
    followUp: "Where should Tour appear first?",
    options: ["Homepage", "Floor plans", "Paid landing page"],
  },
  "AI answers": {
    query: "How does Tour answer renter questions?",
    intro:
      "Tour answers common leasing questions while keeping the visitor inside a visual tour experience. It can explain availability, amenities, pet policy, parking, pricing, and next steps.",
    bullets: [
      { label: "Renter intent", text: "detect what the visitor is trying to do and recommend the right next action." },
      { label: "Media-backed answers", text: "send people to the exact tour moment that supports the answer." },
      { label: "Lead capture", text: "turn high-intent questions into calls, forms, or booked tours.", href: "/demo" },
    ],
    closing: "The key is that answers do not feel like a dead-end chat box. They keep moving the renter through the tour.",
    followUp: "What should the assistant answer first?",
    options: ["Pricing", "Pet policy", "Availability"],
  },
  Scheduler: {
    query: "Show me the scheduler handoff.",
    intro:
      "Tour can move a high-intent visitor from browsing into a booked appointment after they watch, ask, or compare the right moments.",
    bullets: [
      { label: "Smart timing", text: "surface scheduling after intent signals like floor plan views or repeat amenity clicks." },
      { label: "Lower friction", text: "keep booking inside the guided flow instead of sending visitors to another page." },
      { label: "Team handoff", text: "pass source, selected interests, and tour context to the leasing team.", href: "/book-demo" },
    ],
    closing: "That gives the leasing team a warmer conversation and gives the renter fewer steps to complete.",
    followUp: "What booking path do you want to show?",
    options: ["In-person tour", "Virtual tour", "Request a call"],
  },
  Attribution: {
    query: "What attribution can Tour show?",
    intro:
      "Tour can show which website moments, campaigns, videos, and AI interactions are creating qualified leasing conversations.",
    bullets: [
      { label: "Tour engagement", text: "see which media, floor plans, and CTAs get prospects to continue." },
      { label: "Lead source", text: "connect engagement from campaigns, organic pages, and property traffic." },
      { label: "Conversion proof", text: "tie assisted tours to appointments, follow-up, and leasing outcomes.", href: "/pricing" },
    ],
    closing: "The goal is to make Tour feel like a measurable leasing channel, not only a nicer website widget.",
    followUp: "Which metric should we highlight?",
    options: ["Appointments", "Qualified leads", "Tour completion"],
  },
  "CRM handoff": {
    query: "How does CRM handoff work?",
    intro:
      "Tour can collect the visitor's interests, summarize intent, and hand the next step to your CRM or leasing workflow.",
    bullets: [
      { label: "Captured context", text: "include what they watched, clicked, asked, and wanted to see next." },
      { label: "Follow-up ready", text: "send the right tour link, floor plan, or CTA with less manual work." },
      { label: "Workflow fit", text: "support the handoff pattern your team already uses.", href: "/book-demo" },
    ],
    closing: "This makes follow-up feel personalized even when the first interaction happened after hours.",
    followUp: "What CRM are you using?",
    options: ["Entrata", "Yardi", "Other"],
  },
  "Explore amenities": {
    query: "Explore amenities.",
    intro:
      "Tour can guide visitors through amenities like a leasing agent would: start with lifestyle, show the space, and end with the next best action.",
    bullets: [
      { label: "Visual proof", text: "show actual amenity clips instead of sending people to a static list." },
      { label: "Personalized paths", text: "route fitness, study, pool, pet, and social-space interests differently." },
      { label: "Conversion CTA", text: "pair each amenity with booking, availability, or related floor plan steps.", href: "/samples" },
    ],
    closing: "Amenities become part of the leasing conversation, not just a section on the website.",
    followUp: "Which amenity should we feature?",
    options: ["Fitness center", "Pool", "Study rooms"],
  },
  "View floor plans": {
    query: "View floor plans.",
    intro:
      "Tour can help visitors compare floor plans with guided context, not just bedroom counts and pricing tables.",
    bullets: [
      { label: "Guided comparison", text: "explain who each layout is best for and what tradeoffs matter." },
      { label: "Media pairing", text: "connect floor plans to unit videos, amenity clips, and availability." },
      { label: "Next-step capture", text: "turn floor plan interest into a saved preference or booked tour.", href: "/demo" },
    ],
    closing: "The result is a clearer path from browsing floor plans to taking action.",
    followUp: "What should the renter compare?",
    options: ["Studio", "1 bedroom", "2 bedroom"],
  },
  "View Tour Examples": {
    query: "Show me Tour.video examples.",
    intro:
      "Tour.video examples show how real property media can become a guided website experience instead of a static video gallery.",
    bullets: [
      { label: "Property-specific tours", text: "show amenities, floor plans, neighborhood clips, and leasing paths for each community." },
      { label: "Website-ready media", text: "pair each example with calls to action like scheduling, floor plans, and follow-up." },
      { label: "Reusable patterns", text: "use proven examples as templates for new property launches.", href: "/samples" },
    ],
    closing: "The examples on the right show how different communities can use the same Tour.video system in their own style.",
    followUp: "Which example do you want to explore first?",
    options: ["Amenities", "Floor plans", "Student housing"],
  },
  "Setup Time & Video Ads AI": {
    query: "How long does setup take, and how can video ads AI help?",
    intro:
      "Tour.video can start with existing property media and website context, then turn that material into a tour experience and follow-up paths.",
    bullets: [
      { label: "Fast setup", text: "use your website, videos, photos, and leasing details to create a guided tour flow." },
      { label: "Video ads AI", text: "reuse tour content to test short ad angles, landing-page hooks, and follow-up messages." },
      { label: "Launch path", text: "start with one property widget, then expand into campaigns and more embedded moments.", href: "/book-demo" },
    ],
    closing: "A good first step is choosing one property and one conversion goal, then building the tour around that path.",
    followUp: "Do you want to talk through setup or ads first?",
    options: ["Setup time", "Video ads", "Launch plan"],
  },
  "Book a Demo": {
    query: "I want to book a demo.",
    intro:
      "A Tour.video demo can walk through the website widget, example tours, AI answers, scheduling paths, and what setup would look like for your properties.",
    bullets: [
      { label: "See the widget", text: "review how the floating tour and popup experience works on a property website." },
      { label: "Map your content", text: "identify what videos, floor plans, and CTAs should go into the first launch." },
      { label: "Plan next steps", text: "decide whether to start with a property tour, campaign landing page, or broader portfolio rollout.", href: "/book-demo" },
    ],
    closing: "You can book a demo and use your own property as the example.",
    followUp: "What should the demo focus on?",
    options: ["Website widget", "AI answers", "Video ads"],
  },
}

function createTourChatMessage(role: "user" | "assistant" | "system", content: string) {
  return {
    id: `tour-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  }
}

type TourChatMessage = ReturnType<typeof createTourChatMessage>

function useLocalTourAssistant({
  initialMessages,
  onFinish,
}: {
  initialMessages: TourChatMessage[]
  onFinish?: () => void
}) {
  const [messages, setMessages] = useState<TourChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const responseTimerRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (responseTimerRef.current) {
      window.clearTimeout(responseTimerRef.current)
      responseTimerRef.current = null
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading) return

    stop()
    setMessages((currentMessages) => [
      ...currentMessages,
      createTourChatMessage("user", trimmedInput),
    ])
    setInput("")
    setIsLoading(true)

    responseTimerRef.current = window.setTimeout(() => {
      setMessages((currentMessages) => [
        ...currentMessages,
        createTourChatMessage(
          "assistant",
          "Tour.video turns renter intent into a guided leasing path: show the right media, answer the question, then move the visitor toward a booked tour or follow-up."
        ),
      ])
      setIsLoading(false)
      onFinish?.()
    }, 520)
  }, [input, isLoading, onFinish, stop])

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    setMessages,
    isLoading,
    error: null,
    stop,
  }
}

function formatPrecalculatedTourAnswer(response: (typeof mockSuggestionResponses)[string]) {
  const bullets = response.bullets
    .map((bullet) => `- ${bullet.label}: ${bullet.text}${bullet.href ? ` ${bullet.href}` : ""}`)
    .join("\n")

  return `${response.intro}

What you can do with it:
${bullets}

${response.closing}

${response.followUp}`
}

const testimonialStories = [
  {
    src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/essentials_t.mp4",
    title: "The Essential",
    logo: "ESSENTIAL",
    img: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/essentials_testimonials.png",
    metric: "Sooner",
    metricLabel: "launches for future projects",
    quote:
      "I would hire them at any of my projects. When I look at all the work that was done, I'm thrilled. I wish I had done this at some of my other projects and done it sooner.",
    person: "Customer Story",
  },
  {
    src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/peak_made.mp4",
    title: "PeakMade Real Estate",
    logo: "PEAKMADE",
    img: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/peakmade_testimonials.png",
    metric: "$5M+",
    metricLabel: "reported return on investment",
    quote:
      "Our return on investment was over $5 million. It has been a phenomenal tool for the onsite teams to use.",
    person: "Portfolio Operator",
  },
  {
    src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/Quad_real_estate.mp4",
    title: "Quad Real Estate",
    logo: "QUAD",
    img: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/Quad_realestate_v2.png",
    metric: "Pro",
    metricLabel: "video product for lease-up",
    quote:
      "The team has been proactive in creating a professional video product that will make the difference in converting leads.",
    person: "Lease-up Team",
  },
  {
    src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/CLS.mp4",
    title: "Campus Life & Style",
    logo: "CLS",
    img: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/cls_v2.png",
    metric: "Live",
    metricLabel: "virtual tours across properties",
    quote:
      "The feedback that we're getting from the properties that the virtual tours have gone live on has been amazing. Overall it's been a great experience and I highly recommend working with them.",
    person: "Student Housing Team",
  },
  {
    src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/caliber_living.mp4",
    title: "Caliber Living",
    logo: "CALIBER",
    img: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/calibar_living_v2.png",
    metric: "Easy",
    metricLabel: "low-lift resident coordination",
    quote:
      "We haven't really had to do a whole lot on our side except just coordinating schedules and times with our current residents. The ease with which it's been to work with them has been phenomenal.",
    person: "Caliber Living",
  },
  {
    src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/GMH.mp4",
    title: "GMH Communities",
    logo: "GMH",
    img: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/GMH_v2.png",
    metric: "Anywhere",
    metricLabel: "guided tours for remote students",
    quote:
      "Leasemagnets has helped give that virtual tour for our students who may not be able to physically come to the property and provide that experience even from thousands of miles away.",
    person: "GMH Communities",
  },
  {
    src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/189/intro_new/PeakMade_-_Brad_Hoff_mp4_1.mp4",
    title: "Varsity Berkeley",
    logo: "VARSITY",
    img: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/189/intro_new/PeakMade_-_Brad_Hoff_mp4_1.jpg",
    metric: "Next best",
    metricLabel: "thing to seeing it in person",
    quote:
      "This is the next best thing to actually seeing it in person. You can go online to our website and walk through virtual tours that show actual apartments, like a guided tour by a leasing consultant.",
    person: "PeakMade Team",
  },
  {
    src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/189/intro_new/PeakMade_-_Brad_Hoff_mp4_1.mp4",
    title: "Vue32 / Willow Bridge",
    logo: "VUE32",
    img: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/189/intro_new/PeakMade_-_Brad_Hoff_mp4_1.jpg",
    metric: "Pizzazz",
    metricLabel: "high-quality video for the website",
    quote:
      "View32 loves Leasemagnets, the high quality videos, the awesome staff. We think this is going to offer so much pizzazz to the website and we can't wait to see it.",
    person: "Willow Bridge Team",
  },
]

const heroVideoAssets = {
  widgetDemos: [
    {
      label: "Widget demo 1",
      src: "https://static.tour.video/landingTYG/Website%20LM%20widget%201_nb_2025_TYG.webm",
    },
    {
      label: "Widget demo 2",
      src: "https://static.tour.video/landingTYG/Website%20LM%20widget%202_nb_2025_TYG.webm",
    },
    {
      label: "Widget demo 3",
      src: "https://static.tour.video/landingTYG/Website%20LM%20widget%203_nb_2025_TYG.webm",
    },
    {
      label: "Widget demo 4",
      src: "https://static.tour.video/landingTYG/Website%20LM%20widget%204_nb_2025_TYG.webm",
    },
    {
      label: "Widget demo 5",
      src: "https://static.tour.video/landingTYG/Website%20LM%20widget%205_nb_2025_TYG.webm",
    },
    {
      label: "Widget demo 6",
      src: "https://static.tour.video/landingTYG/Website%20LM%20widget%206_nb_2025_TYG.webm",
    },
  ],
  tourMp4s: [
    {
      label: "Ivy Row LA",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/541/intro_main/Ivy_Row_LA_Teach_intro_2025__1__mp4_1.mp4",
    },
    {
      label: "GEO Central",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/529/intro_main/GEO_Central_intro_2025__1__mp4_1.mp4#t=40",
    },
    {
      label: "The Gathering Salisbury",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/553/intro_main/The_Gathering_Salisbury_intro_2025_mp4_1.mp4#t=4",
    },
    {
      label: "The Lorimer",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/542/intro_main/The_Lorimer_Intro_2025_mp4_3.mp4",
    },
    {
      label: "Twin River Commons",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/518/intro_main/Twin_River_Commons_intro_2024__1__mp4_2.mp4",
    },
    {
      label: "27 North",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/intro_revamp_intro/27_North_intro_2024_mp4_1.mp4",
    },
    {
      label: "West 22 Main",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/543/intro_main/West_22_Main_Intro_2025__1__mp4_1.mp4",
    },
    {
      label: "Astoria Denton TX",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/540/intro_astoria/Astoria_Denton_TX_Intro_2025__2__mp4_1.mp4",
    },
    {
      label: "Vue53",
      src: "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/43/intro_vue53_main/Vue53_intro_2025_mp4_1.mp4",
    },
    {
      label: "Vue 32",
      src: "https://storage.googleapis.com/leasemagnets-cloud-storage/Vue%2032_intro_V4_2024TYG.mp4",
    },
  ],
}

const HERO_WIDGET_VIDEOS = heroVideoAssets.widgetDemos
const HERO_TOUR_VIDEOS = heroVideoAssets.tourMp4s

function getRandomVideoIndex(length: number, excludeIndex?: number) {
  if (length <= 1) return 0

  let nextIndex = Math.floor(Math.random() * length)
  while (nextIndex === excludeIndex) {
    nextIndex = Math.floor(Math.random() * length)
  }

  return nextIndex
}

function getTourShareSlug(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tour"
}

function getTourIndexFromSlug(slug: string | null) {
  if (!slug) return -1
  const normalizedSlug = slug.toLowerCase()

  return HERO_TOUR_VIDEOS.findIndex((video) => getTourShareSlug(video.label) === normalizedSlug)
}

function playNotificationBlimp() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextCtor) return

  try {
    const audioContext = new AudioContextCtor()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(680, now)
    oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.08)
    oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.16)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.2)
    window.setTimeout(() => audioContext.close().catch(() => {}), 260)
  } catch {
    // Browsers can block audio before user interaction; the visual transition still runs.
  }
}

function tryAutoplay(videoEl: HTMLVideoElement | null) {
  if (!videoEl) return
  videoEl.muted = true
  videoEl.defaultMuted = true
  const playPromise = videoEl.play()
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {})
  }
}

export function LandingPage() {
  return (
    <div className={`${plusJakartaSans.className} min-h-screen overflow-x-hidden bg-[#ffffff] text-black`}>
      <AnnouncementBar />
      <Header />
      <main>
        <HeroSection />
        <TrustRow />
        <FeatureOverview />
        <ProductSection
          eyebrow="AI leasing inbox"
          title="Every conversation keeps the renter context"
          text="Tour shows your team what the renter watched, asked, and clicked before anyone replies. AI can answer instantly or prepare the perfect handoff for a leasing agent."
          imageSlug="tour-ai-leasing-inbox"
          imageAlt="Tour.video AI leasing inbox UI generated with gpt-image-2"
          points={["Prospect intent timeline", "Tour-aware AI replies", "Next-best action prompts"]}
        />
        <ProductSection
          eyebrow="Tour builder"
          title="Create the tour your best leasing agent would give"
          text="Start from a property website, pull out the important leasing moments, then build a guided video path with scripts, scenes, and calls to action."
          imageSlug="tour-builder"
          imageAlt="Tour.video tour builder UI generated with gpt-image-2"
          points={["Website analysis", "Storyboard and script", "Property-specific CTAs"]}
          reverse
        />
        <ProductSection
          eyebrow="Attribution"
          title="Know what turns traffic into leases"
          text="Connect tour engagement, source data, follow-up, booked appointments, and leasing outcomes so marketing and leasing teams share the same picture."
          imageSlug="tour-analytics-attribution"
          imageAlt="Tour.video analytics attribution UI generated with gpt-image-2"
          points={["Source-level lead quality", "Tour completion funnel", "Revenue attribution"]}
        />
        <SetupSection />
        <CustomerProofSection />
        <CaseStudyMetricsSection />
        <FinalCta />
      </main>
      <Footer />
      <FloatingTourSquareWidget />
    </div>
  )
}

function AnnouncementBar() {
  return (
    <div className={`${interFont.className} bg-black px-4 py-3 text-center text-sm font-medium text-white`}>
      <span className="inline-flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#60a5fa]" />
        New: AI leasing follow-up for every guided tour
        <ArrowRight className="h-4 w-4" />
      </span>
    </div>
  )
}

function Header() {
  return (
    <header className={`${interFont.className} sticky top-0 z-50 border-b border-black/10 bg-[#ffffff]/95 px-5 py-4 backdrop-blur`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Tour.video home">
          <Image src="/images/tour logo TYG.svg" alt="Tour.video" width={142} height={54} className="h-8 w-auto" priority />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {["Product", "Solutions", "Resources", "Pricing"].map((item) => (
            <a key={item} href={item === "Pricing" ? "/pricing" : "#features"} className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-white">
              {item}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/signin" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-white sm:inline-flex">
            Log in
          </Link>
          <Link href="/book-demo" className="hidden rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black hover:border-black/20 sm:inline-flex">
            Book demo
          </Link>
          <Link href="/demo" className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            Start free
          </Link>
        </div>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section className="px-4 pb-16 pt-20 sm:px-6 sm:pb-20 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold shadow-sm">
          <CheckCircle2 className="h-4 w-4" />
          4.8 stars | 1.3M+ tours delivered
        </div>
        <h1 className="mt-8 max-w-5xl text-6xl font-semibold leading-[0.95] tracking-normal text-black sm:text-7xl lg:text-8xl">
          Every renter gets a guided tour
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 sm:text-xl">
          Tour.video turns anonymous website visitors into qualified leasing conversations with video tours, AI answers, scheduling, and attribution.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/demo" className="inline-flex h-12 items-center justify-center rounded-full bg-[#2563eb] px-6 text-sm font-semibold text-white hover:bg-[#1d4ed8]">
            Start a tour
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link href="/samples" className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-semibold text-black hover:border-black/20">
            <PlayCircle className="mr-2 h-4 w-4" />
            See how it works
          </Link>
        </div>
        <div className="mt-12 w-full">
          <HeroWidgetVideoCarousel />
        </div>
      </div>
    </section>
  )
}

function HeroWidgetVideoCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    setCurrentIndex(getRandomVideoIndex(HERO_WIDGET_VIDEOS.length))

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => getRandomVideoIndex(HERO_WIDGET_VIDEOS.length, prev))
    }, 9000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return

    const currentVideoSrc = (HERO_WIDGET_VIDEOS[currentIndex] ?? HERO_WIDGET_VIDEOS[0]!).src
    if (videoEl.currentSrc !== currentVideoSrc && videoEl.getAttribute("src") !== currentVideoSrc) {
      videoEl.src = currentVideoSrc
      videoEl.load()
    }

    tryAutoplay(videoEl)
  }, [currentIndex])

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="relative rounded-lg bg-[#f3f4f6] px-4 pb-6 pt-20 sm:px-8 sm:pb-8 sm:pt-24 lg:px-12 lg:pb-10">
        <HeroTourLauncher />
        <div className="relative mx-auto aspect-[16/10] w-full max-w-5xl overflow-hidden rounded-[1.5rem] bg-transparent sm:aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            src={HERO_WIDGET_VIDEOS[0]!.src}
            onEnded={() => setCurrentIndex((prev) => getRandomVideoIndex(HERO_WIDGET_VIDEOS.length, prev))}
          />
        </div>
        <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2 text-sm font-medium text-zinc-600">
          {platformPills.map((pill) => (
            <span key={pill} className="rounded-full border border-black/10 bg-white px-3 py-1">
              {pill}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-2">
        {HERO_WIDGET_VIDEOS.map((video, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrentIndex(index)}
            className={`h-2.5 rounded-full border border-slate-300 transition ${
              currentIndex === index ? "w-7 bg-[#2563eb]" : "w-2.5 bg-white hover:bg-slate-100"
            }`}
            aria-label={`Show ${video.label}`}
          />
        ))}
      </div>
    </div>
  )
}

function HeroTourLauncher() {
  const [query, setQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [gmbSuggestion, setGmbSuggestion] = useState<any | null>(null)
  const [selectedGmbPlace, setSelectedGmbPlace] = useState<any | null>(null)
  const [isSearchingGmb, setIsSearchingGmb] = useState(false)
  const [websitePreview, setWebsitePreview] = useState<WebsiteOgPreview | null>(null)
  const [isLoadingWebsitePreview, setIsLoadingWebsitePreview] = useState(false)
  const hasPropertyValue = query.trim().length > 0
  const showLauncherPopover = isInputFocused && !isSubmitting
  const normalizedWebsite = normalizeWebsiteInput(query)
  const selectedGmbName = selectedGmbPlace?.displayName?.text || ""
  const hasLockedGmbPlace = !!selectedGmbPlace && query.trim() === selectedGmbName
  const searchLabel = normalizedWebsite ? "Use this website" : "Search result"

  useEffect(() => {
    const rawQuery = query.trim()
    const isWebsite = !!normalizeWebsiteInput(rawQuery)

    setGmbSuggestion(null)

    if (hasLockedGmbPlace) {
      setIsSearchingGmb(false)
      return
    }

    if (rawQuery.length < 3 || isWebsite) {
      setIsSearchingGmb(false)
      return
    }

    let isActive = true
    setIsSearchingGmb(true)

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/gmb/search?query=${encodeURIComponent(rawQuery)}&extra=false`)
        if (!isActive) return

        if (response.ok) {
          const result = await response.json()
          setGmbSuggestion(result?.data || null)
        } else {
          setGmbSuggestion(null)
        }
      } catch {
        if (isActive) setGmbSuggestion(null)
      } finally {
        if (isActive) setIsSearchingGmb(false)
      }
    }, 320)

    return () => {
      isActive = false
      window.clearTimeout(timer)
    }
  }, [hasLockedGmbPlace, query])

  useEffect(() => {
    if (!normalizedWebsite) {
      setWebsitePreview(null)
      setIsLoadingWebsitePreview(false)
      return
    }

    let isActive = true
    setWebsitePreview(null)
    setIsLoadingWebsitePreview(true)

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/generate/hub/link-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalizedWebsite }),
        })

        if (!isActive) return

        if (response.ok) {
          const data = await response.json()
          setWebsitePreview({
            url: data?.url || normalizedWebsite,
            title: data?.title || new URL(normalizedWebsite).hostname,
            description: data?.description || "",
            imageUrl: data?.imageUrl || null,
            faviconUrl: data?.faviconUrl || null,
          })
        } else {
          setWebsitePreview(null)
        }
      } catch {
        if (isActive) setWebsitePreview(null)
      } finally {
        if (isActive) setIsLoadingWebsitePreview(false)
      }
    }, 1400)

    return () => {
      isActive = false
      window.clearTimeout(timer)
    }
  }, [normalizedWebsite])

  const openCreateTour = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const openCreateTourFromPlace = (place: any, fallbackName: string) => {
    const placeId = place?.id
    if (!placeId) return false

    const name = place?.displayName?.text || fallbackName
    const website = place?.websiteUri || normalizeWebsiteInput(fallbackName)
    const params = new URLSearchParams({
      source: "home-hero",
      name,
    })

    if (website) params.set("website", website)

    openCreateTour(`/create/tour/via/placeid/${encodeURIComponent(placeId)}?${params.toString()}`)
    return true
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const rawQuery = query.trim()
    if (!rawQuery || isSubmitting) return

    setIsSubmitting(true)
    setMessage("")

    try {
      if (selectedGmbPlace && openCreateTourFromPlace(selectedGmbPlace, rawQuery)) {
        setIsSubmitting(false)
        return
      }

      const gmbResponse = await fetch(`/api/gmb/search?query=${encodeURIComponent(rawQuery)}&extra=false`)

      if (gmbResponse.ok) {
        const result = await gmbResponse.json()
        const place = result?.data
        if (openCreateTourFromPlace(place, rawQuery)) {
          setIsSubmitting(false)
          return
        }
      }

      const website = normalizeWebsiteInput(rawQuery)
      if (website) {
        const params = new URLSearchParams({
          source: "home-hero",
          property: rawQuery,
        })
        openCreateTour(`/create/tour/via/website/${encodeURIComponent(website)}?${params.toString()}`)
        setIsSubmitting(false)
        return
      }

      setMessage("Try a property name with city, or paste the website.")
    } catch (error) {
      console.error("Error launching guided tour flow:", error)
      const website = normalizeWebsiteInput(rawQuery)
      if (website) {
        openCreateTour(`/create/tour/via/website/${encodeURIComponent(website)}?source=home-hero&property=${encodeURIComponent(rawQuery)}`)
      } else {
        setMessage("Could not find that property yet. Try adding the city or website.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="absolute left-1/2 top-6 z-20 w-[min(92%,46rem)] -translate-x-1/2"
    >
      <div className="group/field flex h-[4.5rem] items-center rounded-[1.75rem] border border-white/80 bg-white px-6 py-2 text-left shadow-[0_20px_70px_rgba(32,79,74,0.16)] transition-[border-color,box-shadow] duration-300 focus-within:border-white focus-within:shadow-[0_22px_84px_rgba(13,95,52,0.22)]">
        <label htmlFor="hero-property-input" className="sr-only">
          Property name or website
        </label>
        <input
          id="hero-property-input"
          name="tour-property-launcher"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setSelectedGmbPlace(null)
            setQuery(event.target.value)
          }}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => window.setTimeout(() => setIsInputFocused(false), 120)}
          className="min-w-0 flex-1 bg-transparent text-[1.35rem] font-semibold text-zinc-950 outline-none placeholder:text-zinc-400"
          placeholder="Type your property name or website to create your tour"
          disabled={isSubmitting}
        />
        <div className="relative ml-4 shrink-0">
          <button
            type="submit"
            className={`flex h-14 cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-[1.35rem] px-8 text-[1rem] font-bold text-white transition-[background-color,box-shadow,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              hasPropertyValue && !isSubmitting
                ? "bg-[#07551f] shadow-[0_16px_42px_rgba(7,85,31,0.34),0_0_42px_rgba(64,214,111,0.28)] hover:-translate-y-0.5 hover:bg-[#064719]"
              : hasPropertyValue
                ? "bg-[#07551f] shadow-[0_16px_42px_rgba(7,85,31,0.34),0_0_42px_rgba(64,214,111,0.28)]"
                : "bg-[#07551f] opacity-45"
            } disabled:cursor-not-allowed disabled:opacity-80`}
            aria-label="Create guided tour"
            aria-disabled={isSubmitting || !hasPropertyValue}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span className="hidden whitespace-nowrap sm:inline">Create tour</span>
                <ArrowRight className="h-5 w-5 shrink-0 -rotate-45" />
              </>
            )}
          </button>
        </div>
      </div>
      <div
        className={`absolute left-1/2 top-[5.25rem] w-full -translate-x-1/2 overflow-hidden rounded-[1.25rem] border border-black/10 bg-white text-left shadow-[0_18px_52px_rgba(15,23,42,0.16)] transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          showLauncherPopover ? "translate-y-0 opacity-100 blur-0" : "pointer-events-none -translate-y-2 opacity-0 blur-sm"
        }`}
      >
        <div className="p-3">
          {hasLockedGmbPlace ? (
            <SuggestionRow
              title={selectedGmbName}
              subtitle={selectedGmbPlace?.formattedAddress || selectedGmbPlace?.websiteUri || "Google Business Profile"}
              label="Selected"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => openCreateTourFromPlace(selectedGmbPlace, query)}
            />
          ) : normalizedWebsite ? (
            <WebsitePreviewSuggestion
              website={normalizedWebsite}
              preview={websitePreview}
              isLoading={isLoadingWebsitePreview}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery(normalizedWebsite)}
            />
          ) : isSearchingGmb ? (
            <div className="flex items-center gap-3 rounded-xl px-3 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
              <span className="text-base font-semibold text-zinc-600">Finding matching properties...</span>
            </div>
          ) : gmbSuggestion ? (
            <SuggestionRow
              title={gmbSuggestion?.displayName?.text || "Matched property"}
              subtitle={gmbSuggestion?.formattedAddress || gmbSuggestion?.websiteUri || "Google Business Profile"}
              label={searchLabel}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setSelectedGmbPlace(gmbSuggestion)
                setQuery(gmbSuggestion?.displayName?.text || query)
              }}
            />
          ) : hasPropertyValue ? (
            <div className="rounded-xl px-3 py-3">
              <p className="text-base font-semibold text-zinc-700">Keep typing a property name and city.</p>
              <p className="mt-1 text-sm text-zinc-500">Example: Vue53 Chicago</p>
            </div>
          ) : (
            <div className="rounded-xl px-3 py-3">
              <p className="text-base font-semibold text-zinc-700">Search by property name or paste a website.</p>
              <p className="mt-1 text-sm text-zinc-500">Tour will use Google Business data when available.</p>
            </div>
          )}
        </div>
      </div>
      {message && (
        <p className="mt-2 text-center text-xs font-medium text-zinc-600">
          {message}
        </p>
      )}
    </form>
  )
}

function SuggestionRow({
  title,
  subtitle,
  label,
  onMouseDown,
  onClick,
}: {
  title: string
  subtitle: string
  label: string
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-4 rounded-xl px-3.5 py-3 text-left transition hover:bg-zinc-100"
    >
      <span className="min-w-0">
        <span className="block truncate text-[1.05rem] font-bold leading-tight text-zinc-900">{title}</span>
        <span className="mt-1 block truncate text-[0.98rem] font-medium leading-tight text-zinc-500">{subtitle}</span>
      </span>
      <span className="shrink-0 rounded-full border border-black/10 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-zinc-400 opacity-0 transition group-hover:opacity-100">
        {label}
      </span>
    </button>
  )
}

function WebsitePreviewSuggestion({
  website,
  preview,
  isLoading,
  onMouseDown,
  onClick,
}: {
  website: string
  preview: WebsiteOgPreview | null
  isLoading: boolean
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void
  onClick: () => void
}) {
  const hostname = (() => {
    try {
      return new URL(website).hostname.replace(/^www\./, "")
    } catch {
      return website
    }
  })()
  const previewImage = preview?.imageUrl || preview?.faviconUrl || null

  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition hover:bg-zinc-100"
    >
      <span
        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/10 bg-zinc-100 text-xs font-bold uppercase text-zinc-400"
        style={previewImage ? { backgroundImage: `url(${previewImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {!previewImage && (isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : hostname.slice(0, 2))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.05rem] font-bold leading-tight text-zinc-900">
          {preview?.title || "Use this website"}
        </span>
        <span className="mt-1 block truncate text-[0.95rem] font-medium leading-tight text-zinc-500">
          {preview?.description || website}
        </span>
        <span className="mt-1 block truncate text-xs font-semibold text-zinc-400">
          {isLoading ? "Reading Open Graph preview..." : hostname}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700" />
    </button>
  )
}

function normalizeWebsiteInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    const hasDomainShape = url.hostname.includes(".") && !url.hostname.includes(" ")
    return hasDomainShape ? url.toString() : ""
  } catch {
    return ""
  }
}

function FloatingTourSquareWidget() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentButtonTextIndex, setCurrentButtonTextIndex] = useState(0)
  const [showPlayButton, setShowPlayButton] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isModalMounted, setIsModalMounted] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isAtPageBottom, setIsAtPageBottom] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)
  const [activeAssistantTab, setActiveAssistantTab] = useState<"chat" | "book-demo" | "video-call">("chat")
  const [mockResponseStatus, setMockResponseStatus] = useState<"idle" | "loading" | "streaming" | "done">("idle")
  const [streamedResponse, setStreamedResponse] = useState("")
  const [showSubtleTypingHint, setShowSubtleTypingHint] = useState(false)
  const [showFloatingSuggestionCards, setShowFloatingSuggestionCards] = useState(false)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [initialAssistantMessages] = useState(() => [
    createTourChatMessage("system", TOUR_ASSISTANT_SYSTEM_PROMPT),
  ])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const leftPanelRef = useRef<HTMLDivElement | null>(null)
  const modalCloseTimerRef = useRef<number | null>(null)
  const mockLoadingTimerRef = useRef<number | null>(null)
  const mockTypingTimerRef = useRef<number | null>(null)
  const mockStreamingTimerRef = useRef<number | null>(null)
  const subtleTypingTimerRef = useRef<number | null>(null)
  const subtleTypingQueuedRef = useRef(false)
  const shareToastTimerRef = useRef<number | null>(null)
  const activeVideo = HERO_TOUR_VIDEOS[currentIndex] ?? HERO_TOUR_VIDEOS[0]!
  const buttonTexts = ["Tour", "Explore", "View", "Amenities", "Specials", "Bedrooms", "Book"]
  /*
    Earlier suggestion set kept for later when the floating assistant supports
    richer topic routing again:
    ["Website embed", "AI answers", "Scheduler", "Attribution"]
  */
  const suggestionButtons = ["View Tour Examples", "Setup Time & Video Ads AI", "Book a Demo"]
  const generatedRecommendations = HERO_TOUR_VIDEOS.slice(0, 4)
  const isBookingPanelOpen = activeAssistantTab === "book-demo"
  const generatedCtas = [
    { label: isBookingPanelOpen ? "Chat with us" : "Book a tour", icon: isBookingPanelOpen ? MessageCircle : Calendar },
    { label: "Send this tour", icon: Share2 },
  ]
  const generatedSources = [
    {
      domain: "tour.video",
      title: "Tour.video | Guided virtual leasing tours",
      description: "Website tours, AI follow-up, CTAs, and attribution for property teams.",
    },
    {
      domain: "tour.video",
      title: "Tour.video samples | Student housing and multifamily",
      description: "Real community tours and media examples used to recommend next-step UI blocks.",
    },
    {
      domain: "tour.video",
      title: "Tour.video AI leasing assistant",
      description: "Chat, recommended actions, and conversion paths generated from renter intent.",
    },
  ]
  const widgetVisibility = isAtPageBottom ? 0 : 1
  const composerVisibility = isModalMounted ? 1 : widgetVisibility
  const chatOpacity = Math.min(1, Math.max(0, (scrollProgress - 0.28) / 0.48))
  const isFloatingComposerInteractive = scrollProgress >= 0.74 && composerVisibility > 0.99 && !isAtPageBottom
  const isComposerInteractive = isModalMounted ? isOpen : isFloatingComposerInteractive
  const miniWidgetVisibility = widgetVisibility
  const miniLabelOpacity = Math.min(1, Math.max(0, 1 - scrollProgress / 0.46))
  const miniScale = 1 - scrollProgress * 0.18
  const subtleTypingOpacity = (showSubtleTypingHint ? 1 : 0) * miniWidgetVisibility

  const openTourModal = useCallback(() => {
    if (modalCloseTimerRef.current) {
      window.clearTimeout(modalCloseTimerRef.current)
      modalCloseTimerRef.current = null
    }

    setShowSubtleTypingHint(false)
    setShowFloatingSuggestionCards(true)
    setIsModalMounted(true)
    window.requestAnimationFrame(() => setIsOpen(true))
  }, [])

  const clearMockResponseTimers = useCallback(() => {
    if (mockLoadingTimerRef.current) {
      window.clearTimeout(mockLoadingTimerRef.current)
      mockLoadingTimerRef.current = null
    }
    if (mockTypingTimerRef.current) {
      window.clearTimeout(mockTypingTimerRef.current)
      mockTypingTimerRef.current = null
    }
    if (mockStreamingTimerRef.current) {
      window.clearInterval(mockStreamingTimerRef.current)
      mockStreamingTimerRef.current = null
    }
  }, [])

  const scrollLeftPanelToBottom = useCallback((delay = 80) => {
    window.setTimeout(() => {
      const panel = leftPanelRef.current
      if (!panel) return
      panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" })
    }, delay)
  }, [])

  const {
    messages: assistantMessages,
    input: modalQuery,
    setInput: setModalQuery,
    handleSubmit: submitAssistantQuestion,
    setMessages: setAssistantMessages,
    isLoading: isAssistantLoading,
    error: assistantError,
    stop: stopAssistantResponse,
  } = useLocalTourAssistant({
    initialMessages: initialAssistantMessages,
    onFinish: () => scrollLeftPanelToBottom(80),
  })

  const visibleAssistantMessages = assistantMessages.filter(
    (message) =>
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
  )
  const lastVisibleAssistantMessage = visibleAssistantMessages[visibleAssistantMessages.length - 1]
  const shouldShowAssistantTyping =
    isAssistantLoading &&
    (!lastVisibleAssistantMessage ||
      lastVisibleAssistantMessage.role !== "assistant" ||
      lastVisibleAssistantMessage.content.trim().length === 0)

  const startMockAnswer = useCallback((label: string) => {
    const response = mockSuggestionResponses[label]
    if (!response) return

    setSelectedSuggestion(label)
    setMockResponseStatus("idle")
    setStreamedResponse("")
    setModalQuery("")
    setActiveAssistantTab("chat")
    openTourModal()
    clearMockResponseTimers()
    stopAssistantResponse()
    setAssistantMessages((messages) => [
      ...messages,
      createTourChatMessage("user", response.query),
    ])

    mockLoadingTimerRef.current = window.setTimeout(() => {
      setMockResponseStatus("loading")
      scrollLeftPanelToBottom(40)
    }, 260)

    mockTypingTimerRef.current = window.setTimeout(() => {
      setMockResponseStatus("streaming")
      let index = 0
      const text = response?.intro || "Tour is building the right response for this visitor."

      mockStreamingTimerRef.current = window.setInterval(() => {
        index = Math.min(index + 4, text.length)
        setStreamedResponse(text.slice(0, index))
        scrollLeftPanelToBottom(20)

        if (index >= text.length && mockStreamingTimerRef.current) {
          window.clearInterval(mockStreamingTimerRef.current)
          mockStreamingTimerRef.current = null
          window.setTimeout(() => {
            setAssistantMessages((messages) => [
              ...messages,
              createTourChatMessage("assistant", formatPrecalculatedTourAnswer(response)),
            ])
            setMockResponseStatus("idle")
            setStreamedResponse("")
            scrollLeftPanelToBottom(60)
          }, 260)
        }
      }, 24)
    }, 760)
  }, [clearMockResponseTimers, openTourModal, scrollLeftPanelToBottom, setAssistantMessages, setModalQuery, stopAssistantResponse])

  const handleSuggestionClick = useCallback((label: string) => {
    if (label === "View Tour Examples" || label === "Setup Time & Video Ads AI") {
      startMockAnswer(label)
      return
    }

    setSelectedSuggestion(label)
    setMockResponseStatus("idle")
    setStreamedResponse("")
    setModalQuery("")
    setActiveAssistantTab("book-demo")
    openTourModal()
    clearMockResponseTimers()
    stopAssistantResponse()

    window.setTimeout(() => {
      const panel = leftPanelRef.current
      if (!panel) return
      panel.scrollTo({ top: 0, behavior: "smooth" })
    }, 180)

  }, [clearMockResponseTimers, openTourModal, setModalQuery, startMockAnswer, stopAssistantResponse])

  const handleModalQuerySubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedQuery = modalQuery.trim()
    if (!trimmedQuery || isAssistantLoading) return

    setShowSubtleTypingHint(false)
    setShowFloatingSuggestionCards(true)
    setSelectedSuggestion(null)
    setActiveAssistantTab("chat")
    clearMockResponseTimers()
    submitAssistantQuestion(event)
    scrollLeftPanelToBottom(40)
  }, [clearMockResponseTimers, isAssistantLoading, modalQuery, scrollLeftPanelToBottom, submitAssistantQuestion])

  const handlePrimaryTourCtaClick = useCallback(() => {
    if (isBookingPanelOpen) {
      setSelectedSuggestion(null)
      setActiveAssistantTab("chat")
      scrollLeftPanelToBottom(80)
      return
    }

    setSelectedSuggestion("Book a Demo")
    setMockResponseStatus("idle")
    setStreamedResponse("")
    setModalQuery("")
    setActiveAssistantTab("book-demo")
    clearMockResponseTimers()
    stopAssistantResponse()

    window.setTimeout(() => {
      const panel = leftPanelRef.current
      if (!panel) return
      panel.scrollTo({ top: 0, behavior: "smooth" })
    }, 120)
  }, [clearMockResponseTimers, isBookingPanelOpen, scrollLeftPanelToBottom, setModalQuery, stopAssistantResponse])

  const copyTourShareUrl = useCallback(async () => {
    const shareUrl = new URL(window.location.href)
    const tourSlug = getTourShareSlug(activeVideo.label)
    shareUrl.searchParams.set("tour", tourSlug)

    try {
      await navigator.clipboard.writeText(shareUrl.toString())
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = shareUrl.toString()
      textarea.setAttribute("readonly", "true")
      textarea.style.position = "fixed"
      textarea.style.top = "-9999px"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }

    setShowSubtleTypingHint(false)
    setShowFloatingSuggestionCards(true)
    setShareToast(`Tour URL copied with ?tour=${tourSlug}`)

    if (shareToastTimerRef.current) {
      window.clearTimeout(shareToastTimerRef.current)
    }

    shareToastTimerRef.current = window.setTimeout(() => {
      setShareToast(null)
      shareToastTimerRef.current = null
    }, 2600)
  }, [activeVideo.label])

  const closeTourModal = useCallback(() => {
    setIsOpen(false)

    if (modalCloseTimerRef.current) {
      window.clearTimeout(modalCloseTimerRef.current)
    }

    modalCloseTimerRef.current = window.setTimeout(() => {
      setIsModalMounted(false)
      modalCloseTimerRef.current = null
    }, 320)
  }, [])

  useEffect(() => {
    const tourParam = new URLSearchParams(window.location.search).get("tour")
    const tourIndex = getTourIndexFromSlug(tourParam)
    setCurrentIndex(tourIndex >= 0 ? tourIndex : getRandomVideoIndex(HERO_TOUR_VIDEOS.length))
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const scrollElement = document.scrollingElement || document.documentElement
      const progress = Math.min(1, Math.max(0, (window.scrollY - 180) / 520))
      const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight
      setScrollProgress(progress)
      setIsAtPageBottom(scrollElement.scrollTop >= maxScrollTop - 8)
    }

    handleScroll()
    window.addEventListener("resize", handleScroll)
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("resize", handleScroll)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  useEffect(() => {
    if (subtleTypingQueuedRef.current || scrollProgress < 0.74) return

    subtleTypingQueuedRef.current = true
    setShowFloatingSuggestionCards(false)
    setShowSubtleTypingHint(true)

    subtleTypingTimerRef.current = window.setTimeout(() => {
      setShowSubtleTypingHint(false)
      setShowFloatingSuggestionCards(true)
      playNotificationBlimp()
      subtleTypingTimerRef.current = null
    }, 2000)
  }, [scrollProgress])

  useEffect(() => {
    const playButtonTimer = window.setTimeout(() => setShowPlayButton(true), 500)
    const textTimer = window.setInterval(() => {
      setCurrentButtonTextIndex((prev) => (prev + 1) % buttonTexts.length)
    }, 5000)

    return () => {
      window.clearTimeout(playButtonTimer)
      window.clearInterval(textTimer)
      if (modalCloseTimerRef.current) {
        window.clearTimeout(modalCloseTimerRef.current)
      }
      if (shareToastTimerRef.current) {
        window.clearTimeout(shareToastTimerRef.current)
      }
      if (subtleTypingTimerRef.current) {
        window.clearTimeout(subtleTypingTimerRef.current)
      }
      clearMockResponseTimers()
    }
  }, [buttonTexts.length, clearMockResponseTimers])

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return

    if (videoEl.getAttribute("src") !== activeVideo.src) {
      videoEl.src = activeVideo.src
      videoEl.load()
    }

    tryAutoplay(videoEl)
  }, [activeVideo.src])

  useEffect(() => {
    if (!isModalMounted) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTourModal()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeTourModal, isModalMounted])

  return (
    <>
      <style>{`
        .tour-floating-mini {
          animation: tour-mini-float 3s ease-in-out infinite;
        }
        @keyframes tour-mini-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .tour-floating-play {
          animation: tour-play-fade-in-up 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .tour-chat-fade-in-down {
          animation: tour-chat-fade-in-down 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .tour-subtle-typing-pill {
          animation: tour-subtle-typing-pill 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .tour-typing-dot {
          animation: tour-typing-dot 1.18s ease-in-out infinite;
        }
        .tour-typing-dot:nth-child(2) {
          animation-delay: 0.14s;
        }
        .tour-typing-dot:nth-child(3) {
          animation-delay: 0.28s;
        }
        @keyframes tour-play-fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes tour-chat-fade-in-down {
          0% {
            opacity: 0;
            transform: translate(-50%, -26px) scale(0.96);
            filter: blur(8px);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes tour-subtle-typing-pill {
          0% {
            transform: translate(-50%, -6px) scale(0.88);
          }
          100% {
            transform: translate(-50%, 0) scale(1);
          }
        }
        @keyframes tour-typing-dot {
          0%, 80%, 100% {
            opacity: 0.34;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-3px);
          }
        }
      `}</style>

      <button
        type="button"
        data-tour-floating-mini
        onClick={openTourModal}
        className="group fixed bottom-8 left-4 z-[2147483647] flex h-[72px] w-[72px] items-center justify-center overflow-visible bg-transparent transition-[opacity,transform] duration-300 ease-out hover:scale-105 sm:bottom-10"
        style={{
          opacity: miniWidgetVisibility,
          pointerEvents: miniWidgetVisibility > 0.15 ? "auto" : "none",
          transform: `translate3d(calc(${scrollProgress} * (50vw - (min(760px, calc(100vw - 32px)) / 2) - 16px)), ${scrollProgress * 7 + (isAtPageBottom ? 28 : 0)}px, 0) scale(${miniScale})`,
          transformOrigin: "left bottom",
        }}
        aria-label={`Open ${activeVideo.label} tour preview`}
      >
        <span className="tour-floating-mini relative h-[72px] w-[72px] overflow-hidden rounded-[20px] border-2 border-white shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_15px_rgba(79,70,229,0.18)] transition duration-300 group-hover:border-4">
          <video
            ref={videoRef}
            src={HERO_TOUR_VIDEOS[0]!.src}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
          <span className="absolute inset-0 z-10 bg-[linear-gradient(135deg,transparent_0%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.3)_100%)]" />
          {showPlayButton && (
            <span className="tour-floating-play absolute inset-0 z-20 flex items-center justify-center">
              <span className="rounded-full bg-white/90 p-2.5 shadow-md backdrop-blur-sm transition duration-300 group-hover:scale-110 group-hover:bg-white">
                <span className="block h-0 w-0 translate-x-0.5 border-y-[8px] border-l-[13px] border-y-transparent border-l-gray-800" />
              </span>
            </span>
          )}
        </span>

        <span
          className="absolute top-[76px] h-[30px] min-w-[86px] overflow-hidden rounded-full border border-white bg-[#4d8ae5] px-4 shadow-[0_2px_12px_rgba(0,0,0,0.1),0_0_10px_rgba(79,70,229,0.16)] transition-opacity duration-200"
          style={{
            opacity: showSubtleTypingHint ? 0 : miniLabelOpacity * miniWidgetVisibility,
            pointerEvents: !showSubtleTypingHint && miniLabelOpacity > 0.2 && miniWidgetVisibility > 0.15 ? "auto" : "none",
          }}
        >
          {buttonTexts.map((text, index) => (
            <span
              key={text}
              className={`absolute inset-0 flex items-center justify-center text-sm font-semibold text-white transition-all duration-500 ${
                index === currentButtonTextIndex
                  ? "translate-y-0 opacity-100"
                  : index === (currentButtonTextIndex - 1 + buttonTexts.length) % buttonTexts.length
                    ? "-translate-y-full opacity-0"
                    : "translate-y-full opacity-0"
              }`}
            >
              {text}
            </span>
          ))}
        </span>

        {/* Option 2: compact typing indicator under the video thumbnail. */}
        <span
          className="tour-subtle-typing-pill absolute left-1/2 top-[78px] flex h-[24px] w-[62px] items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white/95 shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-opacity duration-200"
          style={{
            opacity: subtleTypingOpacity,
            pointerEvents: "none",
          }}
          aria-hidden={subtleTypingOpacity < 0.1}
        >
          <span className="tour-typing-dot h-2 w-2 rounded-full bg-zinc-400" />
          <span className="tour-typing-dot h-2 w-2 rounded-full bg-zinc-400" />
          <span className="tour-typing-dot h-2 w-2 rounded-full bg-zinc-400" />
        </span>
      </button>

      <div
        data-tour-floating-chat
        className="fixed bottom-5 left-1/2 z-[2147483645] flex w-[min(760px,calc(100vw-32px))] flex-col items-center gap-3 transition-[opacity,filter,transform] duration-300 ease-out sm:bottom-8"
        style={{
          opacity: isModalMounted ? 1 : chatOpacity * composerVisibility,
          filter: isModalMounted ? "blur(0)" : `blur(${(1 - chatOpacity) * 8}px)`,
          pointerEvents: isComposerInteractive ? "auto" : "none",
          transform: isModalMounted
            ? "translate(-50%, 0) scale(1)"
            : `translate(-50%, ${(1 - chatOpacity) * -26 + (isAtPageBottom ? 28 : 0)}px) scale(${0.96 + chatOpacity * 0.04})`,
        }}
      >
        {/*
          Notification/typing bubble kept for later. This can become the
          notification log surface when generated UI events are added.
          <div
            data-tour-typing-bubble
            className="w-full max-w-[720px] overflow-hidden rounded-[28px] border border-black/10 bg-white/95 px-5 py-4 text-left shadow-[0_14px_42px_rgba(0,0,0,0.18)] backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={openTourModal}
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
                aria-label={`Open ${activeVideo.label} tour preview`}
              >
                <video
                  src={activeVideo.src}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold leading-none text-zinc-950">Navi</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-zinc-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </div>
                <div className="mt-2 flex h-5 items-center gap-1.5 text-zinc-500" aria-label="Navi is typing">
                  <span className="tour-typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  <span className="tour-typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  <span className="tour-typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
                </div>
              </div>
            </div>
          </div>
        */}
        <TourAssistantComposer
          activeVideo={activeVideo}
          idPrefix={isModalMounted ? "tour-modal" : "tour-floating"}
          mode={isModalMounted ? "modal" : "floating"}
          query={modalQuery}
          suggestionButtons={suggestionButtons}
          showSuggestions={isModalMounted || showFloatingSuggestionCards}
          isInteractive={isComposerInteractive}
          onOpen={openTourModal}
          onQueryChange={setModalQuery}
          onSubmit={handleModalQuerySubmit}
          onSuggestionClick={handleSuggestionClick}
        />
      </div>

      {shareToast && (
        <div className="fixed bottom-28 right-5 z-[2147483647] inline-flex max-w-[calc(100vw-40px)] items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{shareToast}</span>
        </div>
      )}

      {isModalMounted && (
        <div
          data-tour-floating-modal
          className="fixed inset-0 z-[2147483644] flex items-start justify-center bg-black/55 p-4 pt-6 backdrop-blur-md transition-[opacity,backdrop-filter] duration-300 ease-out sm:pt-8"
          style={{
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
          }}
          onClick={closeTourModal}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.35)] transition-[opacity,transform,filter] duration-300"
            style={{
              opacity: isOpen ? 1 : 0,
              filter: isOpen ? "blur(0)" : "blur(12px)",
              transform: isOpen ? "translateY(0) scale(1)" : "translateY(-22px) scale(0.92)",
              transformOrigin: "center top",
              transitionTimingFunction: isOpen
                ? "cubic-bezier(0.16, 1, 0.3, 1)"
                : "cubic-bezier(0.32, 0, 0.67, 0)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-sm font-semibold text-zinc-500">Tour.video assistant</p>
                <h3 className="text-xl font-semibold text-black">Ask questions while watching {activeVideo.label}</h3>
              </div>
              <button
                type="button"
                onClick={closeTourModal}
                className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                aria-label="Close tour preview"
              >
                <span className="relative block h-5 w-5">
                  <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current" />
                  <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
                </span>
              </button>
            </div>
            <div className="grid max-h-[min(720px,calc(100vh-170px))] overflow-hidden bg-[#f5f6f8] lg:grid-cols-[0.9fr_1.1fr]">
              <div ref={leftPanelRef} className="max-h-[min(720px,calc(100vh-170px))] overflow-y-auto border-r border-black/10 px-5 py-5 sm:px-6">
                <div className="mb-5 flex flex-wrap gap-2">
                  {[
                    { id: "chat" as const, label: "Chat" },
                    { id: "book-demo" as const, label: "Book a demo" },
                    { id: "video-call" as const, label: "Video call" },
                  ].map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => setActiveAssistantTab(action.id)}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                        activeAssistantTab === action.id
                          ? "bg-black text-white"
                          : "border border-black/10 bg-white text-zinc-700 hover:border-black/20"
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                {activeAssistantTab === "book-demo" || activeAssistantTab === "video-call" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-black text-white">
                          <Calendar className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-zinc-950">
                            {activeAssistantTab === "video-call" ? "Book a video call" : "Book a Tour.video demo"}
                          </p>
                          <p className="text-xs leading-5 text-zinc-500">
                            {selectedSuggestion
                              ? `Opened from "${selectedSuggestion}".`
                              : "Pick a time and the demo will use your property as the example."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                      <iframe
                        title="Book a Tour.video demo"
                        src={BOOK_DEMO_EMBED_URL}
                        className="h-[620px] w-full"
                        loading="eager"
                      />
                    </div>
                  </div>
                ) : (
                <div className="space-y-4">
                  <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-black/10 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-zinc-100">
                        <video
                          src={activeVideo.src}
                          className="h-full w-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="metadata"
                        />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-950">Tour assistant</p>
                        <p className="text-xs text-emerald-700">Ready to answer</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-700">
                      Use this panel to ask how Tour.video works, what the website widget can show, and how the video tour can guide a visitor toward the right next step.
                    </p>
                  </div>

                  <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-sm bg-black px-4 py-3 text-sm leading-6 text-white">
                    What can this Tour.video widget answer for a website visitor?
                  </div>

                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-black/10 bg-white px-4 py-3 shadow-sm">
                    <p className="text-sm leading-6 text-zinc-700">
                      It can answer questions about the tour, explain the property media, point to related examples, and offer actions like scheduling, floor plans, or follow-up.
                    </p>
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Sources</p>
                      <div className="mt-2 flex gap-1.5">
                        {generatedSources.map((source, index) => (
                          <span key={source.title} className="group/source relative">
                            <button
                              type="button"
                              className="grid h-8 w-8 place-items-center rounded-md border border-black/10 bg-white text-sm font-semibold text-zinc-600 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
                              aria-label={`Preview source ${index + 1}: ${source.title}`}
                            >
                              {index + 1}
                            </button>
                            <span className="pointer-events-none absolute bottom-[calc(100%+14px)] left-0 z-20 w-[min(320px,calc(100vw-48px))] translate-y-1 rounded-xl bg-[#171717] p-4 text-left text-white opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition duration-150 group-hover/source:translate-y-0 group-hover/source:opacity-100">
                              <span className="flex items-start gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-black ring-1 ring-white/10">
                                  <Image
                                    src="/images/tour logo TYG dark.svg"
                                    alt=""
                                    width={28}
                                    height={28}
                                    className="h-5 w-5 object-contain"
                                  />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold text-white/60">{source.domain}</span>
                                  <span className="mt-1 block text-base font-semibold leading-snug text-white">{source.title}</span>
                                  <span className="mt-2 block text-xs leading-5 text-white/55">{source.description}</span>
                                </span>
                              </span>
                              <span className="absolute left-4 top-full h-3 w-3 -translate-y-1/2 rotate-45 bg-[#171717]" />
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {visibleAssistantMessages.map((message, index) => {
                    if (message.role === "user") {
                      return (
                        <div key={message.id} className="ml-auto max-w-[78%] rounded-2xl rounded-tr-sm bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-800 shadow-sm">
                          {message.content}
                        </div>
                      )
                    }

                    const isStreamingMessage =
                      isAssistantLoading &&
                      index === visibleAssistantMessages.length - 1 &&
                      message.role === "assistant"

                    return (
                      <div key={message.id} className="max-w-[94%] rounded-2xl rounded-tl-sm border border-black/10 bg-white px-4 py-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-zinc-100">
                              <video
                                src={activeVideo.src}
                                className="h-full w-full object-cover"
                                autoPlay
                                loop
                                muted
                                playsInline
                                preload="metadata"
                              />
                            </span>
                            <p className="text-sm font-semibold text-zinc-950">Tour assistant</p>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400" aria-hidden="true">
                            <Copy className="h-4 w-4" />
                            <ThumbsUp className="h-4 w-4" />
                            <ThumbsDown className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                          {message.content}
                          {isStreamingMessage && (
                            <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-zinc-400" />
                          )}
                        </p>
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Sources</p>
                          <div className="mt-2 flex gap-1.5">
                            {generatedSources.map((source, sourceIndex) => (
                              <span key={source.title} className="group/source relative">
                                <button
                                  type="button"
                                  className="grid h-8 w-8 place-items-center rounded-md border border-black/10 bg-white text-sm font-semibold text-zinc-600 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
                                  aria-label={`Preview source ${sourceIndex + 1}: ${source.title}`}
                                >
                                  {sourceIndex + 1}
                                </button>
                                <span className="pointer-events-none absolute bottom-[calc(100%+14px)] left-0 z-20 w-[min(320px,calc(100vw-48px))] translate-y-1 rounded-xl bg-[#171717] p-4 text-left text-white opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition duration-150 group-hover/source:translate-y-0 group-hover/source:opacity-100">
                                  <span className="flex items-start gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-black ring-1 ring-white/10">
                                      <Image
                                        src="/images/tour logo TYG dark.svg"
                                        alt=""
                                        width={28}
                                        height={28}
                                        className="h-5 w-5 object-contain"
                                      />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block text-sm font-semibold text-white/60">{source.domain}</span>
                                      <span className="mt-1 block text-base font-semibold leading-snug text-white">{source.title}</span>
                                      <span className="mt-2 block text-xs leading-5 text-white/55">{source.description}</span>
                                    </span>
                                  </span>
                                  <span className="absolute left-4 top-full h-3 w-3 -translate-y-1/2 rotate-45 bg-[#171717]" />
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {(mockResponseStatus === "loading" || mockResponseStatus === "streaming" || shouldShowAssistantTyping) && (
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-black/10 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-zinc-100">
                          <video
                            src={activeVideo.src}
                            className="h-full w-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="metadata"
                          />
                        </span>
                        <p className="text-sm font-semibold text-zinc-950">Tour assistant is typing</p>
                        <span className="flex h-5 items-center gap-1">
                          <span className="tour-typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
                          <span className="tour-typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
                          <span className="tour-typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" />
                        </span>
                      </div>
                      {mockResponseStatus === "loading" || shouldShowAssistantTyping ? (
                        <div className="mt-4 space-y-2">
                          <div className="h-2.5 w-full animate-pulse rounded-full bg-zinc-200" />
                          <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-zinc-200" />
                        </div>
                      ) : (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                          {streamedResponse}
                          <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-zinc-400" />
                        </p>
                      )}
                    </div>
                  )}

                  {assistantError && (
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 shadow-sm">
                      I could not reach the AI assistant for that question. Check the chat API configuration and try again.
                    </div>
                  )}

                  <div />
                </div>
                )}
              </div>

              <div className="max-h-[min(720px,calc(100vh-170px))] overflow-y-auto bg-white px-5 py-5 sm:px-6">
                <div className="overflow-hidden rounded-[22px] bg-black shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
                  <video
                    src={activeVideo.src}
                    className="aspect-video w-full object-cover"
                    controls
                    autoPlay
                    playsInline
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  {generatedCtas.map((cta, index) => {
                    const Icon = cta.icon

                    return (
                      <button
                        key={cta.label}
                        type="button"
                        onClick={index === 0 ? handlePrimaryTourCtaClick : copyTourShareUrl}
                        className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition ${
                          index === 0
                            ? "bg-black text-white hover:bg-zinc-800"
                            : "border border-black/10 bg-white text-black hover:border-black/20"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {cta.label}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Tour.video examples</p>
                      <h4 className="mt-1 text-xl font-semibold text-zinc-950">More tours to explore</h4>
                    </div>
                    <Link href="/samples" className="hidden text-sm font-semibold text-[#0f5f55] hover:underline sm:inline-flex">
                      View samples
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {generatedRecommendations.map((video, index) => (
                      <button
                        key={video.label}
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        className={`group overflow-hidden rounded-lg border text-left transition ${
                          index === currentIndex
                            ? "border-[#2563eb] bg-[#eff6ff]"
                            : "border-black/10 bg-white hover:border-black/20"
                        }`}
                      >
                        <div className="relative aspect-video bg-black">
                          <video
                            src={video.src}
                            className="h-full w-full object-cover opacity-85 transition group-hover:scale-[1.03]"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-black">
                            <PlayCircle className="h-3.5 w-3.5" />
                            Preview
                          </span>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-zinc-950">{video.label}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Preview how Tour.video can present another property experience.
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <Link
                    href="/samples"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0f5f55] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0b4b43]"
                  >
                    Show another tour example
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </>
  )
}

function TourAssistantComposer({
  activeVideo,
  idPrefix,
  mode,
  query,
  suggestionButtons,
  showSuggestions,
  isInteractive,
  onOpen,
  onQueryChange,
  onSubmit,
  onSuggestionClick,
}: {
  activeVideo: (typeof HERO_TOUR_VIDEOS)[number]
  idPrefix: string
  mode: "floating" | "modal"
  query: string
  suggestionButtons: string[]
  showSuggestions: boolean
  isInteractive: boolean
  onOpen: () => void
  onQueryChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onSuggestionClick: (label: string) => void
}) {
  const isModal = mode === "modal"
  const inputId = `${idPrefix}-query`
  const [dictationError, setDictationError] = useState<string | null>(null)

  return (
    <div
      data-tour-modal-composer={isModal ? true : undefined}
      data-tour-shared-composer={mode}
      className="flex w-full flex-col items-center gap-1"
      onClick={(event) => {
        if (isModal) event.stopPropagation()
      }}
    >
      <div
        className="w-full overflow-visible px-3 pb-0 pt-1 transition-[opacity,transform] duration-300 ease-out"
        style={{
          opacity: showSuggestions ? 1 : 0,
          pointerEvents: showSuggestions && isInteractive ? "auto" : "none",
          transform: showSuggestions ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <div className="flex justify-center gap-2 overflow-x-auto px-7 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {showSuggestions &&
            suggestionButtons.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onSuggestionClick(label)}
                className="shrink-0 rounded-full border border-black/10 bg-zinc-100/95 px-5 py-3 text-sm font-semibold text-zinc-700 shadow-[0_1px_4px_rgba(0,0,0,0.10)] backdrop-blur-3xl transition hover:border-black/15 hover:bg-zinc-200/95"
              >
                {label}
              </button>
            ))}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex w-full items-center gap-3"
        style={{ pointerEvents: isInteractive ? "auto" : "none" }}
      >
        {/*
          Constant square avatar experiment. Keeping it commented so we can
          restore it if we decide the input width should remain identical
          between floating and modal states.
          <button
            type="button"
            onClick={onOpen}
            className="relative hidden h-[59px] w-[59px] shrink-0 overflow-hidden rounded-[16px] border-2 border-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] sm:block"
            aria-label={`Open ${activeVideo.label} tour preview`}
          >
            <video
              src={activeVideo.src}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
            <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(0,0,0,0.08)_50%,rgba(0,0,0,0.24)_100%)]" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white/90 p-2 shadow-md">
                <span className="block h-0 w-0 translate-x-0.5 border-y-[7px] border-l-[11px] border-y-transparent border-l-gray-800" />
              </span>
            </span>
          </button>
        */}
        <div className="pointer-events-none hidden h-[72px] w-[72px] shrink-0 sm:block" aria-hidden="true" />
        <div className="relative min-w-0 flex-1 rounded-full bg-gradient-to-r from-[#f5d56b] via-[#e7a4d9] to-[#82d4c4] p-[2px] shadow-[0_0_28px_rgba(0,0,0,0.34),0_0_42px_rgba(231,164,217,0.32)]">
          <div className="flex h-[58px] w-full items-center overflow-hidden rounded-full bg-white">
            <Search className="ml-6 h-5 w-5 shrink-0 text-zinc-600" />
            <label htmlFor={inputId} className="sr-only">
              Ask Tour.video anything
            </label>
            <input
              id={inputId}
              name={inputId}
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onFocus={() => {
                if (!isModal) onOpen()
              }}
              onClick={() => {
                if (!isModal) onOpen()
              }}
              placeholder="Are you looking for anything specific?"
              className={`min-w-0 flex-1 bg-transparent px-5 text-lg font-normal text-zinc-500 outline-none placeholder:text-zinc-500 ${
                isModal ? "" : "cursor-pointer"
              }`}
              readOnly={!isModal}
              autoComplete="off"
            />
            <ElevenLabsDictationButton
              variant="landing"
              disabled={!isInteractive}
              onBeforeStart={() => {
                if (!isModal) onOpen()
              }}
              onError={setDictationError}
              onTranscript={(text) => onQueryChange(appendDictationText(query, text))}
            />
          </div>
        </div>
      </form>
      {dictationError ? (
        <p className="px-4 text-center text-xs font-semibold text-red-600" role="alert">
          {dictationError}
        </p>
      ) : null}
    </div>
  )
}

function TrustRow() {
  return (
    <section className="border-y border-black/10 bg-[#f8fafc] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl text-center">
        <p className="text-sm font-semibold text-zinc-600">Powering virtual leasing for modern property teams</p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm font-semibold text-zinc-500 sm:grid-cols-4 lg:grid-cols-6">
          {["Student housing", "Multifamily", "Luxury lease-up", "Senior living", "Single-family", "Mixed-use"].map((item) => (
            <div key={item} className="rounded-lg border border-black/10 bg-white px-4 py-4">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CustomerProofSection() {
  const [activeIndex, setActiveIndex] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [trackOffset, setTrackOffset] = useState(-100)
  const [trackTransition, setTrackTransition] = useState(true)
  const [slideDirection, setSlideDirection] = useState<"previous" | "next" | null>(null)
  const [featuredSlideIndex, setFeaturedSlideIndex] = useState(1)
  const featuredTimerRef = useRef<number | null>(null)
  const activeStory = testimonialStories[activeIndex] ?? testimonialStories[0]!
  const previousStory = testimonialStories[(activeIndex - 1 + testimonialStories.length) % testimonialStories.length] ?? testimonialStories[0]!
  const nextStory = testimonialStories[(activeIndex + 1) % testimonialStories.length] ?? testimonialStories[0]!
  const visibleStories = [previousStory, activeStory, nextStory]
  const isSliding = slideDirection !== null

  const slideTo = (direction: "previous" | "next") => {
    if (isSliding) return
    if (featuredTimerRef.current) {
      window.clearTimeout(featuredTimerRef.current)
    }
    setPlaying(false)
    setFeaturedSlideIndex(1)
    setSlideDirection(direction)
    setTrackTransition(true)
    setTrackOffset(direction === "next" ? -200 : 0)
    featuredTimerRef.current = window.setTimeout(() => {
      setFeaturedSlideIndex(direction === "next" ? 2 : 0)
    }, 90)
  }

  const completeSlide = () => {
    if (!slideDirection) return
    if (featuredTimerRef.current) {
      window.clearTimeout(featuredTimerRef.current)
      featuredTimerRef.current = null
    }
    const nextIndex = slideDirection === "next" ? activeIndex + 1 : activeIndex - 1
    setTrackTransition(false)
    setActiveIndex((nextIndex + testimonialStories.length) % testimonialStories.length)
    setTrackOffset(-100)
    setSlideDirection(null)
    setFeaturedSlideIndex(1)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTrackTransition(true))
    })
  }

  useEffect(() => {
    return () => {
      if (featuredTimerRef.current) {
        window.clearTimeout(featuredTimerRef.current)
      }
    }
  }, [])

  const previous = () => slideTo("previous")
  const next = () => slideTo("next")

  return (
    <section className="overflow-hidden bg-black py-24 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-[clamp(2.35rem,4.4vw,4.25rem)] font-medium leading-none tracking-normal">
          Properties that grow with Tour
        </h2>
      </div>

      <div className="relative mt-12 overflow-x-clip overflow-y-visible">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[18vw] bg-gradient-to-r from-black to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[18vw] bg-gradient-to-l from-black to-transparent" />

        <div className="relative mx-auto max-w-[66rem] px-4">
          <TestimonialPreviewCard story={previousStory} align="left" onClick={previous} />
          <TestimonialPreviewCard story={nextStory} align="right" onClick={next} />
          <div className="relative z-20 min-h-[700px] overflow-hidden md:min-h-[520px]" style={{ contain: "paint" }}>
            <div
              className={`absolute inset-0 flex ${trackTransition ? "transition-transform duration-[820ms] ease-[cubic-bezier(0.16,0.82,0.24,1)]" : ""}`}
              style={{ transform: `translate3d(${trackOffset}%, 0, 0)` }}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget && event.propertyName === "transform") {
                  completeSlide()
                }
              }}
            >
              {visibleStories.map((story, index) => (
                <div key={`${story.title}-${index}`} className="w-full shrink-0 px-0 md:px-4">
                  <TestimonialStoryCard
                    story={story}
                    active={index === featuredSlideIndex}
                    playing={index === 1 && playing}
                    onPlay={() => {
                      if (index === 1) setPlaying(true)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="mx-auto mt-10 flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/samples" className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition hover:text-white">
            View all stories
            <ArrowRight className="h-4 w-4" />
          </a>
          <div className="flex items-center gap-3">
            <button type="button" onClick={previous} className="group grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 transition hover:border-white/25 hover:bg-white/[0.11] hover:text-white disabled:opacity-40" aria-label="Previous story" disabled={isSliding}>
              <ChevronLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" strokeWidth={1.75} />
            </button>
            <button type="button" onClick={next} className="group grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 transition hover:border-white/25 hover:bg-white/[0.11] hover:text-white disabled:opacity-40" aria-label="Next story" disabled={isSliding}>
              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function TestimonialPreviewCard({
  story,
  align,
  onClick,
}: {
  story: (typeof testimonialStories)[number]
  align: "left" | "right"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1/2 z-10 hidden h-[380px] w-[21rem] -translate-y-1/2 overflow-hidden rounded-lg bg-[#1d1d1d] opacity-25 transition-opacity duration-300 hover:opacity-40 lg:block ${
        align === "left" ? "left-4 -translate-x-[88%]" : "right-4 translate-x-[88%]"
      }`}
      aria-label={`${align === "left" ? "Previous" : "Next"} testimonial preview`}
    >
      <Image src={story.img} alt={story.title} fill className="object-cover grayscale" />
      <span className="absolute inset-0 bg-black/60" />
      <span className="absolute bottom-6 left-6 right-6 text-left">
        <span className="block text-4xl font-medium leading-none text-white">{story.metric}</span>
        <span className="mt-2 block text-sm text-white/55">{story.metricLabel}</span>
      </span>
    </button>
  )
}

function TestimonialStoryCard({
  story,
  active,
  playing,
  onPlay,
}: {
  story: (typeof testimonialStories)[number]
  active: boolean
  playing: boolean
  onPlay: () => void
}) {
  return (
    <div className={`grid h-full overflow-hidden rounded-lg bg-[#282828] p-4 transition-opacity duration-[820ms] ease-[cubic-bezier(0.16,0.82,0.24,1)] md:grid-cols-[1.38fr_0.78fr] md:p-5 ${active ? "opacity-100" : "opacity-25"}`}>
      <div className="relative min-h-[340px] overflow-hidden rounded-md bg-black md:min-h-[405px]">
        {playing ? (
          <video src={story.src} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <button type="button" onClick={onPlay} className="group absolute inset-0 h-full w-full">
            <Image src={story.img} alt={`${story.title} customer story`} fill className="object-cover opacity-80 transition duration-500 group-hover:scale-[1.02]" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span className="absolute left-6 top-6 text-base font-semibold tracking-[0.22em] text-white/45 grayscale">{story.logo}</span>
            <span className="absolute left-1/2 top-1/2 grid h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_14px_48px_rgba(255,255,255,0.34)] transition duration-300 group-hover:scale-[1.04] group-hover:bg-white">
              <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-black" />
            </span>
            <span className="absolute bottom-6 left-6 text-left">
              <span className="block text-5xl font-medium leading-none tracking-normal">{story.metric}</span>
              <span className="mt-1 block text-base text-white/70">{story.metricLabel}</span>
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-col justify-between p-6 md:p-8">
        <div>
          <div className="text-base font-semibold tracking-[0.24em] text-white/38 grayscale">{story.logo}</div>
          <blockquote className="mt-7 max-w-sm text-[clamp(1.25rem,1.7vw,1.7rem)] font-medium leading-[1.18] tracking-normal text-white">
            “{story.quote}”
          </blockquote>
          <div className="mt-7">
            <p className="text-sm font-semibold text-white">{story.person}</p>
            <p className="mt-1 text-sm text-white/50">{story.title}</p>
          </div>
        </div>
        <a href="/samples" className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">
          Read the story
        </a>
      </div>
    </div>
  )
}

function FeatureOverview() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase text-[#2563eb]">Core features</p>
          <h2 className="mt-4 text-5xl font-semibold leading-tight tracking-normal sm:text-6xl">
            The virtual leasing agent stack
          </h2>
          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Tour combines the renter-facing experience, AI assistance, team workflow, and performance data in one place.
          </p>
        </div>
        <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{feature.text}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ProductSection({
  eyebrow,
  title,
  text,
  imageSlug,
  imageAlt,
  points,
  reverse = false,
}: {
  eyebrow: string
  title: string
  text: string
  imageSlug: string
  imageAlt: string
  points: string[]
  reverse?: boolean
}) {
  return (
    <section className="border-t border-black/10 px-4 py-20 sm:px-6 lg:px-8">
      <div className={`mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 ${reverse ? "lg:[&>div:first-child]:order-2" : ""}`}>
        <div>
          <p className="text-sm font-semibold uppercase text-[#2563eb]">{eyebrow}</p>
          <h2 className="mt-4 max-w-xl text-5xl font-semibold leading-tight tracking-normal sm:text-6xl">{title}</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600">{text}</p>
          <div className="mt-8 space-y-3">
            {points.map((point) => (
              <div key={point} className="flex items-center gap-3 text-sm font-semibold">
                <CheckCircle2 className="h-5 w-5 text-[#2563eb]" />
                {point}
              </div>
            ))}
          </div>
        </div>
        <GeneratedImageFrame slug={imageSlug} alt={imageAlt} compact />
      </div>
    </section>
  )
}

function SetupSection() {
  return (
    <section className="border-t border-black/10 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-[#2563eb]">Launch path</p>
            <h2 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-normal sm:text-6xl">
              Launch Tour.video without rebuilding your site
            </h2>
          </div>
          <Link href="/book-demo" className="inline-flex h-12 w-fit items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white hover:bg-zinc-800">
            Talk to launch team
          </Link>
        </div>
        <GeneratedImageFrame slug="tour-setup-flow" alt="Tour.video setup flow generated with gpt-image-2" />
      </div>
    </section>
  )
}

function CaseStudyMetricsSection() {
  const examples = tourExamplesTYG.slice(2, 8)
  const [activeExampleIndex, setActiveExampleIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveExampleIndex((current) => (current + 1) % examples.length)
    }, 2600)

    return () => window.clearInterval(timer)
  }, [examples.length])

  return (
    <section className="border-t border-black/10 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-[#2563eb]">Case studies</p>
            <h2 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-normal sm:text-6xl">
              Proof across real communities
            </h2>
          </div>
          <Link href="/samples" className="inline-flex h-12 w-fit items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-semibold text-black hover:border-black/20">
            View samples
          </Link>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {examples.map((example, index) => {
            const isActive = index === activeExampleIndex

            return (
              <article
                key={example.communityName}
                onMouseEnter={() => setActiveExampleIndex(index)}
                className={`group relative overflow-hidden rounded-lg bg-white p-[2px] transition duration-500 ${
                  isActive
                    ? "border border-transparent shadow-[0_18px_42px_rgba(24,24,27,0.16)]"
                    : "border border-black/10 shadow-none"
                }`}
              >
                <div
                  className={`pointer-events-none absolute -inset-[2px] z-10 rounded-[10px] transition-opacity duration-500 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="absolute inset-0 animate-[spin_5s_linear_infinite] rounded-[10px] bg-[conic-gradient(from_0deg,rgba(255,255,255,0.92),rgba(185,191,197,0.52),rgba(247,198,145,0.72),rgba(170,183,197,0.55),rgba(255,255,255,0.92))]" />
                  <div className="absolute inset-[2px] rounded-lg bg-white" />
                </div>
                <div className="relative z-20 h-56 overflow-hidden rounded-[7px]">
                  <Image
                    src={example.cover}
                    alt={example.communityName}
                    fill
                    className={`object-cover transition duration-700 group-hover:scale-[1.03] ${
                      isActive ? "scale-[1.02]" : ""
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5">
                    <p className="text-2xl font-semibold leading-tight text-white">{example.caption}</p>
                    <p className="mt-2 text-sm text-white/70">{example.communityName}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-lg bg-black px-6 py-16 text-center text-white sm:px-10">
        <h2 className="mx-auto max-w-4xl text-5xl font-semibold leading-tight tracking-normal sm:text-6xl">
          Give every renter the tour they came for
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">
          Launch guided video tours, AI answers, follow-up, and attribution from one Tour.video workspace.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/demo" className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-zinc-100">
            Start free
          </Link>
          <Link href="/book-demo" className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white hover:bg-white/10">
            Book a demo
          </Link>
        </div>
      </div>
      <CustomerExamplesStrip />
    </section>
  )
}

function CustomerExamplesStrip() {
  const featuredCaption = "7.4k Tours + $850k Revenue Generated"

  return (
    <div className="mx-[calc(50%-50vw)] mt-12 overflow-hidden border-y border-black/10 bg-white py-8">
      <div className="flex gap-4 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {customerExampleStrip.map((example) => {
          const isFeatured = example.caption === featuredCaption

          return (
            <article
              key={`${example.communityName}-${example.caption}`}
              className="group relative h-[150px] w-[242px] shrink-0 overflow-hidden rounded-lg bg-zinc-100 shadow-sm"
            >
              <Image
                src={example.cover}
                alt={example.communityName}
                fill
                sizes="242px"
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/10 to-transparent" />
              {isFeatured && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-white shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
                    <Image src={example.agent} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                  <p className="mt-2 text-sm font-semibold drop-shadow">{example.caption}</p>
                  <Link
                    href="/demo"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-zinc-100"
                  >
                    Build Tour
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
              {!isFeatured && (
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="text-sm font-semibold leading-tight drop-shadow">{example.caption}</p>
                  <p className="mt-1 text-xs text-white/75">{example.communityName}</p>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className={`${interFont.className} bg-black px-4 pb-12 text-white sm:px-6 lg:px-8`}>
      <div className="mx-auto grid max-w-7xl gap-10 border-t border-white/10 pt-12 lg:grid-cols-[1fr_2fr]">
        <div>
          <Image src="/images/tour logo TYG dark.svg" alt="Tour.video" width={142} height={54} className="h-9 w-auto" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/55">
            The guided virtual leasing platform for property websites, AI follow-up, and attribution.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-4">
          {[
            ["Product", "Features", "Samples", "Pricing", "Generate Hub"],
            ["Solutions", "Student housing", "Multifamily", "Lease-up", "Marketing"],
            ["Resources", "Book demo", "Case studies", "Support", "Docs"],
            ["Company", "About", "Careers", "Privacy", "Terms"],
          ].map(([title, ...links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold">{title}</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/55">
                {links.map((link) => (
                  <li key={link}>
                    <a href={link === "Generate Hub" ? "/generate/hub" : link === "Privacy" ? "/privacy-policy" : "#"} className="hover:text-white">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}

function GeneratedImageFrame({
  slug,
  alt,
  compact = false,
  priority = false,
}: {
  slug: string
  alt: string
  compact?: boolean
  priority?: boolean
}) {
  const src = generatedAssets[slug]

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white p-2 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
      <div className={`relative overflow-hidden rounded-md bg-[#f1f5f9] ${compact ? "aspect-[3/2]" : "aspect-[3/2]"}`}>
        {src ? (
          <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        ) : (
          <FallbackProductMock />
        )}
      </div>
    </div>
  )
}

function FallbackProductMock() {
  return (
    <div className="grid h-full grid-cols-[220px_1fr_240px] bg-white text-left">
      <div className="border-r border-black/10 bg-[#f8fafc] p-4">
        <div className="mb-5 flex gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-blue-200" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        {["Inbound", "Tours", "Availability", "Analytics"].map((item, index) => (
          <div key={item} className={`mb-2 rounded-md px-3 py-2 text-xs font-semibold ${index === 1 ? "bg-white text-black" : "text-zinc-500"}`}>
            {item}
          </div>
        ))}
      </div>
      <div className="p-5">
        <div className="mb-5 flex items-center justify-between border-b border-black/10 pb-4">
          <div>
            <p className="text-sm font-semibold">Guided tour conversation</p>
            <p className="text-xs text-zinc-500">Prospect is watching the B2 balcony route</p>
          </div>
          <span className="rounded-full bg-[#2563eb] px-3 py-1 text-xs font-semibold text-white">Live</span>
        </div>
        <div className="space-y-3">
          <div className="max-w-[80%] rounded-lg bg-[#f1f5f9] p-3 text-xs text-zinc-600">Can I see the kitchen and pet amenities?</div>
          <div className="ml-auto max-w-[82%] rounded-lg bg-black p-3 text-xs text-white">Here is a guided tour with those moments queued first.</div>
          <div className="rounded-lg border border-black/10 bg-[#eff6ff] p-3 text-xs font-semibold">High intent: scheduler recommended</div>
        </div>
      </div>
      <div className="border-l border-black/10 bg-[#f8fafc] p-4">
        <p className="text-sm font-semibold">Lead profile</p>
        <div className="mt-4 space-y-3">
          {["Google Ads", "B2 balcony", "$1,900 budget", "Book tour"].map((item) => (
            <div key={item} className="rounded-md border border-black/10 bg-white p-3 text-xs font-semibold text-zinc-600">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
