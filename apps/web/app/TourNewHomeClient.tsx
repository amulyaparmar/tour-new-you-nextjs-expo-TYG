"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Code2,
  Database,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Play,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  Star,
  Video,
  Wand2,
  Workflow
} from "lucide-react";

type AudienceTab = "businesses" | "creators" | "talent";

type GmbPlace = {
  id?: string;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  displayName?: {
    text?: string;
  };
};

type PlaceDetails = {
  place_id: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  editorial_summary?: string;
  reviews: Array<{
    author_name: string;
    rating: number;
    text: string;
    relative_time_description?: string;
  }>;
};

type ScriptKey = "introduction" | "floorPlans" | "amenities" | "closing";

type ScriptSection = {
  key: ScriptKey;
  label: string;
  helper: string;
  markdown: string;
};

const customerLogos = [
  "PeakMade",
  "GMH",
  "Campus Life & Style",
  "Caliber Living",
  "The Essential",
  "Quad",
  "Marshall",
  "HWH",
  "Latitude",
  "One Park"
];

const featureCards = [
  {
    icon: Video,
    title: "Guided Video Tours",
    text: "Turn amenities, floor plans, model units, and neighborhood clips into a path that feels like your best in-person tour.",
    wide: true
  },
  {
    icon: MessageCircle,
    title: "AI Renter Answers",
    text: "Answer pricing, pet, parking, availability, amenity, and policy questions directly inside the tour experience."
  },
  {
    icon: Building2,
    title: "Property Pages",
    text: "Build branded property experiences that route every visitor to the right tour, CTA, or leasing handoff."
  },
  {
    icon: Workflow,
    title: "Conversion Paths",
    text: "Trigger follow-up, scheduling, forms, and team handoffs from real renter intent signals.",
    wide: true
  },
  {
    icon: FileText,
    title: "Lead Capture",
    text: "Collect contact details with context: what they watched, asked, clicked, and wanted next."
  },
  {
    icon: RefreshCw,
    title: "CRM Handoff",
    text: "Send tour activity and prospect intent into the leasing workflow your team already uses."
  },
  {
    icon: BarChart3,
    title: "Attribution",
    text: "Connect website video engagement to appointments, qualified leads, and leasing outcomes."
  },
  {
    icon: Code2,
    title: "Embeds",
    text: "Launch Tour on your homepage, floor plan pages, paid landing pages, and portfolio templates."
  },
  {
    icon: Split,
    title: "Campaign Testing",
    text: "Test hooks, CTAs, tour routes, and video cuts across traffic sources."
  },
  {
    icon: ShieldCheck,
    title: "Portfolio Controls",
    text: "Manage brand settings, content, access, and reporting across every community."
  }
];

const posts = [
  {
    category: "Product",
    title: "How AI video tours turn website traffic into leasing conversations",
    text: "A practical look at how guided media, renter answers, and scheduling work together on high-intent property pages.",
    date: "May 20, 2026"
  },
  {
    category: "Customer Stories",
    title: "What leasing teams need from a virtual tour in 2026",
    text: "Video is only the start. The next layer is context, automation, and proof that the tour actually moved a renter forward.",
    date: "May 12, 2026"
  },
  {
    category: "Playbooks",
    title: "Where to place Tour.video on a property website",
    text: "Homepage, floor plans, availability, paid ads, and resident referrals all need a slightly different guided path.",
    date: "April 28, 2026"
  }
];

const audienceTabs: Array<{
  id: AudienceTab;
  label: string;
  placeholder: string;
  button: string;
  emptyText: string;
}> = [
  {
    id: "businesses",
    label: "Businesses",
    placeholder: "Search your business or paste your website",
    button: "Create",
    emptyText: "Tour can use public business context to create the first guided experience."
  },
  {
    id: "creators",
    label: "Creators",
    placeholder: "I want to create videos for local businesses",
    button: "Start",
    emptyText: "Build around filming tours, ads, interviews, and guided brand moments."
  },
  {
    id: "talent",
    label: "Talent",
    placeholder: "I want to become a guided spokesperson",
    button: "Join",
    emptyText: "Help businesses explain what they do through clear, natural on-camera guidance."
  }
];

const widgetSlides = [
  {
    label: "Tour.video website widget demo 1",
    src: "https://static.tour.video/landingTYG/Website%20LM%20widget%201_nb_2025_TYG.webm"
  },
  {
    label: "Tour.video website widget demo 3",
    src: "https://static.tour.video/landingTYG/Website%20LM%20widget%203_nb_2025_TYG.webm"
  },
  {
    label: "Tour.video website widget demo 2",
    src: "https://static.tour.video/landingTYG/Website%20LM%20widget%202_nb_2025_TYG.webm"
  },
  {
    label: "Tour.video website widget demo 4",
    src: "https://static.tour.video/landingTYG/Website%20LM%20widget%204_nb_2025_TYG.webm"
  },
  {
    label: "Tour.video website widget demo 5",
    src: "https://static.tour.video/landingTYG/Website%20LM%20widget%205_nb_2025_TYG.webm"
  },
  {
    label: "Tour.video website widget demo 6",
    src: "https://static.tour.video/landingTYG/Website%20LM%20widget%206_nb_2025_TYG.webm"
  }
];

const heroVideo =
  "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/intro_revamp_intro/27_North_intro_2024_mp4_1.mp4#t=8";
const agentsVideo =
  "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/541/intro_main/Ivy_Row_LA_Teach_intro_2025__1__mp4_1.mp4#t=4";
const testimonialVideo =
  "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com//testmonials/peak_made.mp4";

const scriptBlueprints: Array<Pick<ScriptSection, "key" | "label" | "helper">> = [
  {
    key: "introduction",
    label: "Introduction",
    helper: "Open with property fit, location, and why the viewer should keep watching."
  },
  {
    key: "floorPlans",
    label: "Floor Plans",
    helper: "Explain layout options and help prospects imagine the right home."
  },
  {
    key: "amenities",
    label: "Amenities",
    helper: "Connect features to daily lifestyle, convenience, and resident experience."
  },
  {
    key: "closing",
    label: "Closing",
    helper: "Summarize value and give a clear next step for booking or applying."
  }
];

function normalizeWebsiteInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function formatHostname(value?: string) {
  if (!value) return "";

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || value;
  }
}

function sentenceFromReviews(details: PlaceDetails) {
  const bestReview = details.reviews
    .filter((review) => review.text && review.rating >= 4)
    .sort((a, b) => b.text.length - a.text.length)[0];

  if (!bestReview) {
    return "Residents and prospects should be guided through the strongest lifestyle benefits with concrete, visual examples.";
  }

  return `A resident review highlights: "${bestReview.text.slice(0, 180)}${bestReview.text.length > 180 ? "..." : ""}"`;
}

function buildScriptSections(details: PlaceDetails): ScriptSection[] {
  const propertyName = details.name || "the property";
  const address = details.formatted_address || "the local neighborhood";
  const website = details.website ? ` The website to reference is ${details.website}.` : "";
  const reviewSignal = sentenceFromReviews(details);
  const ratingLine = details.rating
    ? `${propertyName} has a ${details.rating.toFixed(1)} star Google rating from ${details.user_ratings_total || 0} reviews.`
    : `${propertyName} has Google Business Profile context available for the tour script.`;

  const copy: Record<ScriptKey, string> = {
    introduction: `# Introduction\n\nWelcome to ${propertyName}. Today, we are taking a clear, practical look at what life here feels like, starting with the location at ${address}.\n\n${ratingLine} ${reviewSignal}\n\nAs we move through the tour, focus on three things: how the space supports your daily routine, what amenities make life easier, and what next step makes sense if this feels like a fit.${website}`,
    floorPlans: `# Floor Plans\n\nWhen reviewing floor plans at ${propertyName}, start with how the home will actually be used. Think about where you will work, relax, host, store essentials, and reset at the end of the day.\n\nFor each layout, call out natural light, storage, kitchen flow, bedroom separation, and how the living area supports the renter's routine. Use the website or leasing team details to connect each plan to the right prospect profile.`,
    amenities: `# Amenities\n\nThe amenities at ${propertyName} should be presented as lifestyle solutions, not just a checklist. Frame each feature around the resident moment it improves: easier mornings, better workouts, smoother hosting, pet convenience, package pickup, study time, or work-from-home comfort.\n\nTie every amenity back to the neighborhood context around ${address}.`,
    closing: `# Closing\n\nThat is the quick tour of ${propertyName}. If the location, home style, and resident experience match what you are looking for, the next step is simple: confirm availability, ask the leasing team about current options, and schedule a visit or application conversation.\n\nA strong close should make the prospect feel informed, not pressured: "If this feels like the right fit, I can help you compare available layouts and choose the best next step today."`
  };

  return scriptBlueprints.map((section) => ({
    ...section,
    markdown: copy[section.key]
  }));
}

export function TourNewHomeClient() {
  const generatorRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<GmbPlace | null>(null);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const propertyName = details?.name || place?.displayName?.text || "Your property";
  const websiteInput = normalizeWebsiteInput(query);
  const canSave = details && sections.length > 0;

  const reviewHighlights = useMemo(() => {
    return (details?.reviews || [])
      .filter((review) => review.text)
      .slice(0, 3);
  }, [details]);

  const scrollToGenerator = () => {
    window.setTimeout(() => {
      generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const searchBusiness = async (searchValue = query) => {
    const rawQuery = searchValue.trim();
    if (!rawQuery || isSearching) return false;

    setQuery(rawQuery);
    setIsSearching(true);
    setError("");
    setStatus("");
    setPlace(null);
    setDetails(null);
    setSections([]);

    try {
      const response = await fetch(`/api/gmb/search?query=${encodeURIComponent(rawQuery)}&extra=false`);
      const data = await response.json();

      if (!response.ok || !data?.data?.id) {
        throw new Error(data?.error || "No matching Google Business Profile found.");
      }

      setPlace(data.data);
      setStatus("Business found. Generate a script package when ready.");
      return true;
    } catch (searchError: any) {
      if (normalizeWebsiteInput(rawQuery)) {
        setStatus("Website detected. Add a Google Business Profile name and city for richer script context.");
      } else {
        setError(searchError?.message || "Could not search this business.");
      }
      return false;
    } finally {
      setIsSearching(false);
      scrollToGenerator();
    }
  };

  const generateScripts = async () => {
    if (!place?.id || isGenerating) return;

    setIsGenerating(true);
    setError("");
    setStatus("Loading GMB details, reviews, and property context...");

    try {
      const response = await fetch(`/api/gmb/place-details?place_id=${encodeURIComponent(place.id)}&fields=photos,reviews&review_sort=positive`);
      const data = await response.json();

      if (!response.ok || !data?.result) {
        throw new Error(data?.error || "Could not load GMB details.");
      }

      setDetails(data.result);
      setSections(buildScriptSections(data.result));
      setStatus("Generated Introduction, Floor Plans, Amenities, and Closing sections.");
    } catch (generationError: any) {
      setError(generationError?.message || "Could not generate script package.");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSection = (key: ScriptKey, markdown: string) => {
    setSections((current) => current.map((section) => section.key === key ? { ...section, markdown } : section));
  };

  const copyAllScripts = async () => {
    const combined = sections.map((section) => `${section.label}\n${section.markdown}`).join("\n\n");
    await navigator.clipboard.writeText(combined);
    setStatus("Copied all generated scripts.");
  };

  const saveScriptDocument = async () => {
    if (!details || !canSave || isSaving) return;

    setIsSaving(true);
    setError("");
    setStatus("Saving script document to GenProjectsTYG...");

    try {
      const response = await fetch("/api/create-tour/script-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: details.place_id,
          source: "tour-new-home",
          property_name: details.name,
          property_website: details.website,
          property_data: details,
          research_agent: {
            property: details,
            review_research: {
              highlights: reviewHighlights
            }
          },
          sections: sections.map((section) => ({
            key: section.key,
            label: section.label,
            helper: section.helper,
            markdown: section.markdown,
            prompt: `Generate the ${section.label} section for ${details.name}.`,
            model: "local-template",
            core_elements: [details.name, details.formatted_address, details.website || ""].filter(Boolean)
          })),
          models: Object.fromEntries(sections.map((section) => [section.key, "local-template"]))
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Could not save script document.");
      }

      setStatus(data.id ? `Saved script document to GenProjectsTYG ${data.id}.` : "Saved script document.");
    } catch (saveError: any) {
      setError(saveError?.message || "Could not save script document.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratorSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void searchBusiness(query);
  };

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#241f1f]">
      <div className="border-b border-neutral-200 bg-[#fbfaf7] px-4 py-3 text-center text-sm">
        <a href="#generator" className="group inline-flex items-center gap-3">
          <span className="rounded-sm border border-neutral-300 px-1.5 py-px text-[10px] uppercase tracking-wider text-neutral-500">
            New
          </span>
          <span className="text-neutral-500">Tour.new GMB script generation is live</span>
          <span className="inline-flex items-center gap-1 underline-offset-4 group-hover:underline">
            Try it
            <ArrowRight className="h-3 w-3" />
          </span>
        </a>
      </div>

      <header className="sticky top-0 z-50 border-b border-white/15 bg-black/25 text-white backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center">
            <img src="/images/tour logo TYG dark.svg" alt="Tour.video" className="h-8 w-auto" />
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {["Product", "Solutions", "Generator"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="px-3 py-2 text-sm text-white/75 hover:text-white">
                {item}
              </a>
            ))}
            <a href="#customers" className="px-3 py-2 text-sm text-white/75 hover:text-white">
              Customers
            </a>
            <a href="#concierge" className="px-3 py-2 text-sm text-white/75 hover:text-white">
              Concierge
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/tour-ridealong" className="hidden text-sm text-white/75 hover:text-white sm:inline">
              Ridealong
            </Link>
            <Link
              href="/tour-record"
              className="rounded-full border border-[#4d8ae5] bg-[#4d8ae5] px-4 py-1.5 text-sm tracking-wide text-white shadow-[inset_0_0_2px_rgba(255,255,255,0.8),inset_0_-8px_20px_rgba(255,255,255,0.15)] hover:brightness-110"
            >
              Record
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative -mt-[57px] flex min-h-[72vh] flex-col overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={heroVideo}
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/15" />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-32 md:py-44">
          <div className="max-w-2xl text-center md:text-left">
            <h1 className="text-balance text-[38px] leading-[1.04] tracking-normal text-white md:text-[64px]">
              Turn real business stories into guided video experiences
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-white/75 md:mx-0">
              Tour helps businesses, creators, and on-camera talent turn real video into interactive
              tours, ads, and concierge experiences that guide every visitor toward the next step.
            </p>
            <BusinessHeroSearch isSearching={isSearching} onSearch={searchBusiness} />
          </div>
        </div>
        <a
          href="#generator"
          aria-label="Create a Tour.new script"
          className="absolute bottom-6 left-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
        >
          <Play className="ml-0.5 h-5 w-5" />
        </a>
      </section>

      <section className="border-y border-neutral-200 bg-[#fbfaf7]">
        <div className="mx-auto max-w-6xl border-neutral-200 px-5 py-12 md:border-x">
          <p className="text-center text-sm leading-relaxed text-neutral-500">
            Used by teams replacing static virtual tours, basic website chat, and manual leasing follow-up.
          </p>
          <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-5">
            {customerLogos.map((logo) => (
              <div key={logo} className="flex items-center justify-center">
                <span className="text-center text-sm font-semibold tracking-normal text-neutral-500 grayscale">
                  {logo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="bg-[#fbfaf7]">
        <div className="mx-auto max-w-6xl border-neutral-200 px-5 pt-16 md:border-x md:pt-24">
          <div className="mb-12 grid gap-6 md:grid-cols-2 md:items-start md:gap-12">
            <h2 className="text-balance text-3xl tracking-normal md:text-5xl">
              AI agents for leasing teams.
            </h2>
            <div className="md:max-w-md md:justify-self-end">
              <p className="text-pretty text-base leading-7 text-neutral-600">
                Tour agents answer questions, recommend next steps, qualify intent, and create
                follow-up from every renter interaction. Same website, stronger conversion path.
              </p>
              <div className="mt-6">
                <ButtonLink href="#generator">Build from GMB</ButtonLink>
              </div>
            </div>
          </div>
          <div className="-mx-5 border-t border-neutral-200" />
          <div className="-mx-5 bg-white px-5 py-14">
            <div className="mx-auto max-w-3xl rounded-lg border border-neutral-200 bg-[#fbfaf7] p-3 shadow-sm">
              <div className="rounded-md border border-neutral-200 bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
                  <Sparkles className="h-3.5 w-3.5 text-[#4d8ae5]" />
                  Tour agent
                </div>
                <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  What should I show a renter who asks about pets, parking, and two-bedroom availability?
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_170px]">
                  <div className="space-y-3 text-sm text-neutral-600">
                    <p className="rounded-md border border-neutral-200 bg-white p-3">
                      Recommend the pet-friendly amenity clip, show available two-bedroom tours, and
                      offer a scheduler handoff after the parking answer.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Follow-up ready
                    </div>
                  </div>
                  <div className="rounded-md border border-neutral-200 bg-neutral-950 p-3 text-white">
                    <div className="mb-2 flex items-center gap-2 text-xs text-white/60">
                      <Play className="h-3.5 w-3.5" />
                      Suggested clips
                    </div>
                    <div className="space-y-2 text-xs">
                      {["Pet spa", "Garage parking", "B2 model tour"].map((item) => (
                        <div key={item} className="rounded border border-white/10 bg-white/5 px-2 py-1.5">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <video
            src={agentsVideo}
            className="-mx-5 aspect-video w-[calc(100%+40px)] object-cover"
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
          />
        </div>
      </section>

      <section id="solutions" className="overflow-hidden border-y border-neutral-200 bg-[#efede8]">
        <div className="mx-auto max-w-6xl border-neutral-200 px-5 md:border-x">
          <div className="max-w-xl py-16 md:py-24">
            <LandingPill>Platform</LandingPill>
            <h2 className="mt-4 text-balance text-3xl tracking-normal md:text-5xl">
              Everything you need in a modern leasing path
            </h2>
            <p className="mt-4 text-pretty text-base leading-7 text-neutral-600">
              A unified platform that replaces disconnected tour videos, basic chat widgets,
              forms, and reporting gaps with one AI-powered renter experience.
            </p>
          </div>
          <div className="-mx-5 border-t border-neutral-200" />
          <div className="-mx-5 grid overflow-hidden bg-[#fbfaf7] md:min-h-96 md:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col justify-between p-8">
              <div>
                <Database className="mb-8 h-5 w-5 text-neutral-500" />
                <h3 className="text-xl font-medium tracking-normal">Renter Context Model</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-600">
                  Unify video engagement, website clicks, AI questions, selected floor plans,
                  and scheduling intent into one usable context layer for leasing.
                </p>
              </div>
              <div className="mt-6">
                <ButtonLink href="#generator" invert>
                  Create script
                </ButtonLink>
              </div>
            </div>
            <div className="relative flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(77,138,229,0.24),transparent_35%),linear-gradient(135deg,#191817,#6f5a32)] p-6 md:p-12">
              <div className="absolute inset-0 opacity-40 [background-image:repeating-linear-gradient(-45deg,rgba(255,255,255,.18)_0,rgba(255,255,255,.18)_1px,transparent_1px,transparent_8px)]" />
              <div className="relative w-full max-w-lg rounded-2xl bg-white/70 p-1.5 shadow-2xl backdrop-blur-xl">
                <div className="rounded-xl border border-white/70 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between text-xs text-neutral-500">
                    <span>Live renter session</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">High intent</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      ["Watched", "2 bed model tour", "92%"],
                      ["Asked", "Is garage parking included?", "AI"],
                      ["Clicked", "Schedule in-person visit", "CTA"],
                      ["Saved", "B2 floor plan", "CRM"]
                    ].map(([a, b, c]) => (
                      <div key={b} className="grid grid-cols-[78px_1fr_48px] gap-2 rounded border border-neutral-200 px-3 py-2 text-xs">
                        <span className="text-neutral-400">{a}</span>
                        <span className="text-neutral-700">{b}</span>
                        <span className="text-right text-[#4d8ae5]">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="-mx-5 border-t border-neutral-200" />
          <div className="grid grid-cols-1 py-5 md:grid-cols-12">
            {featureCards.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`group relative -mr-px -mb-px min-h-56 border border-neutral-200 bg-[#fbfaf7] p-6 transition hover:bg-white ${
                    feature.wide ? "md:col-span-7" : index % 3 === 0 ? "md:col-span-4" : "md:col-span-5"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 [background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.08)_0,rgba(0,0,0,.08)_1px,transparent_1px,transparent_60px),repeating-linear-gradient(90deg,rgba(0,0,0,.08)_0,rgba(0,0,0,.08)_1px,transparent_1px,transparent_60px)]" />
                  <Icon className="relative mb-12 h-5 w-5 text-neutral-500" />
                  <h3 className="relative text-sm font-medium">{feature.title}</h3>
                  <p className="relative mt-2 max-w-lg text-pretty text-sm leading-6 text-neutral-600">
                    {feature.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="generator" ref={generatorRef} className="scroll-mt-20 bg-[#fbfaf7]">
        <div className="mx-auto max-w-6xl border-neutral-200 px-5 py-16 md:border-x md:py-24">
          <div className="mb-10 grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-end">
            <div>
              <LandingPill>Tour.new</LandingPill>
              <h2 className="mt-4 text-balance text-3xl tracking-normal md:text-5xl">
                Create a tour script from Google Business Profile context
              </h2>
            </div>
            <p className="text-pretty text-base leading-7 text-neutral-600">
              Search a business, pull Google Places context and review signals, then generate editable
              script sections for a leasing tour. Save the result to Supabase when it is ready.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)]">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <form onSubmit={handleGeneratorSubmit}>
                  <label className="text-sm font-semibold text-neutral-700" htmlFor="tour-new-search">
                    Business name, city, or website
                  </label>
                  <div className="mt-2 flex min-h-14 items-center rounded-2xl border border-neutral-300 bg-white px-4 shadow-sm focus-within:border-[#4d8ae5] focus-within:ring-4 focus-within:ring-[#4d8ae5]/15">
                    <Search className="mr-3 h-5 w-5 text-neutral-500" />
                    <input
                      id="tour-new-search"
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-neutral-400"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Rambler Atlanta apartments"
                      value={query}
                    />
                    <button
                      className="ml-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#07551f] px-4 text-sm font-semibold text-white hover:bg-[#064719] disabled:cursor-not-allowed disabled:bg-neutral-300"
                      disabled={isSearching || !query.trim()}
                      type="submit"
                    >
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Search
                    </button>
                  </div>
                  {websiteInput ? (
                    <p className="mt-2 text-xs font-medium text-neutral-500">
                      Website detected: {formatHostname(websiteInput)}. A business name plus city gives richer GMB results.
                    </p>
                  ) : null}
                </form>

                {error ? <Alert tone="error">{error}</Alert> : null}
                {status ? <Alert tone="success">{status}</Alert> : null}
              </section>

              <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Building2 className="h-5 w-5 text-[#4d8ae5]" />
                  GMB match
                </h3>

                {place ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xl font-semibold">{place.displayName?.text || "Matched business"}</p>
                      <p className="mt-2 flex gap-2 text-sm leading-6 text-neutral-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        {place.formattedAddress || "Address unavailable"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        {place.rating ? <GeneratorPill><Star className="h-3.5 w-3.5 fill-current" /> {place.rating} rating</GeneratorPill> : null}
                        {place.userRatingCount ? <GeneratorPill>{place.userRatingCount} reviews</GeneratorPill> : null}
                        {place.websiteUri ? <GeneratorPill>{formatHostname(place.websiteUri)}</GeneratorPill> : null}
                      </div>
                    </div>
                    <button
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                      disabled={isGenerating}
                      onClick={generateScripts}
                      type="button"
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {isGenerating ? "Generating..." : "Generate script package"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-500">
                    Search for a property or local business to start the GMB lookup.
                  </p>
                )}
              </section>

              {details ? (
                <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <MessageSquareText className="h-5 w-5 text-[#4d8ae5]" />
                    Review context
                  </h3>
                  <div className="mt-4 space-y-3">
                    {reviewHighlights.length > 0 ? reviewHighlights.map((review) => (
                      <blockquote className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-600" key={`${review.author_name}-${review.text.slice(0, 12)}`}>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-500">
                          <Star className="h-3.5 w-3.5 fill-[#4d8ae5] text-[#4d8ae5]" />
                          {review.rating} stars from {review.author_name}
                        </div>
                        {review.text}
                      </blockquote>
                    )) : (
                      <p className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">No written reviews returned for this place.</p>
                    )}
                  </div>
                </section>
              ) : null}
            </div>

            <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Script document</p>
                  <h3 className="mt-1 text-2xl font-semibold">{propertyName}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
                    disabled={sections.length === 0}
                    onClick={copyAllScripts}
                    type="button"
                  >
                    <Clipboard className="h-4 w-4" />
                    Copy all
                  </button>
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#4d8ae5] px-3 text-sm font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:bg-neutral-300"
                    disabled={!canSave || isSaving}
                    onClick={saveScriptDocument}
                    type="button"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>

              {sections.length > 0 ? (
                <div className="mt-6 space-y-5">
                  {sections.map((section, index) => (
                    <article className="grid gap-4 rounded-[24px] border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-[44px_minmax(0,1fr)]" key={section.key}>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-semibold text-[#4d8ae5] ring-1 ring-neutral-200">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-semibold">{section.label}</h4>
                            <p className="mt-1 text-sm leading-6 text-neutral-500">{section.helper}</p>
                          </div>
                          <button
                            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                            onClick={() => navigator.clipboard.writeText(section.markdown)}
                            type="button"
                          >
                            <Clipboard className="h-3.5 w-3.5" />
                            Copy
                          </button>
                        </div>
                        <textarea
                          className="mt-4 min-h-[190px] w-full resize-y rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-7 text-neutral-700 outline-none focus:border-[#4d8ae5] focus:ring-4 focus:ring-[#4d8ae5]/15"
                          onChange={(event) => updateSection(section.key, event.target.value)}
                          value={section.markdown}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex min-h-[460px] flex-col items-center justify-center rounded-[24px] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-neutral-300" />
                  <h3 className="mt-4 text-xl font-semibold">No script generated yet</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                    Search a business, confirm the GMB match, then generate the Tour.new script sections here.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>

      <section id="customers" className="overflow-hidden bg-[#fbfaf7] [background-image:repeating-linear-gradient(-45deg,rgba(0,0,0,.08)_0,rgba(0,0,0,.08)_1px,transparent_1px,transparent_8px)]">
        <div className="mx-auto max-w-6xl border-neutral-200 bg-[#fbfaf7] px-5 py-16 md:border-x md:py-24">
          <div className="mb-10 flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <LandingPill>Customers</LandingPill>
              <h2 className="mt-4 text-balance text-3xl tracking-normal md:text-5xl">
                Trusted by leasing teams that move fast
              </h2>
            </div>
            <ButtonLink href="#generator">Create your script</ButtonLink>
          </div>
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-950">
            <video
              className="aspect-video w-full object-cover"
              src={testimonialVideo}
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
            />
          </div>
          <div className="mt-4">
            <p className="text-base font-medium">PeakMade Real Estate</p>
            <p className="text-sm text-neutral-500">Portfolio operator using Tour.video for leasing conversion</p>
          </div>
        </div>
      </section>

      <section id="concierge" className="relative overflow-hidden bg-neutral-950 text-white">
        <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_50%_0%,rgba(255,255,255,.16),transparent_32%),repeating-linear-gradient(-45deg,rgba(255,255,255,.08)_0,rgba(255,255,255,.08)_1px,transparent_1px,transparent_8px)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl tracking-normal md:text-5xl">
              Integrate your videos into a video-first concierge
            </h2>
            <p className="mt-4 text-pretty text-base leading-7 text-white/60">
              Guide renters through real community video, answer questions in context, and
              route high-intent visitors to the right tour, floor plan, or leasing handoff.
            </p>
            <div className="mt-8">
              <ButtonLink href="/tour-ridealong">Open ridealong</ButtonLink>
            </div>
          </div>
          <SecurityWidgetSlider />
          <div className="mt-16 grid border border-white/10 md:grid-cols-3">
            {[
              {
                icon: Video,
                title: "Video-first guidance",
                text: "Let visitors explore model units, amenities, floor plans, and local context through guided video paths."
              },
              {
                icon: Bot,
                title: "Context-aware answers",
                text: "The agent responds with property-specific detail and recommends the next best clip or action."
              },
              {
                icon: Workflow,
                title: "Leasing handoff",
                text: "Move qualified prospects into scheduling, guest cards, calls, or CRM follow-up with their video intent attached."
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="-mr-px -mb-px border border-white/10 p-8">
                  <div className="flex aspect-square items-center justify-center">
                    <Icon className="h-12 w-12 text-white/40" />
                  </div>
                  <h3 className="text-lg font-medium">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="resources" className="overflow-hidden bg-[#fbfaf7] [background-image:repeating-linear-gradient(-45deg,rgba(0,0,0,.08)_0,rgba(0,0,0,.08)_1px,transparent_1px,transparent_8px)]">
        <div className="mx-auto max-w-6xl border-neutral-200 bg-[#fbfaf7] px-5 py-16 md:border-x md:py-24">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <LandingPill>Resources</LandingPill>
              <h2 className="mt-4 text-3xl tracking-normal md:text-5xl">Relevant resources</h2>
            </div>
            <ButtonLink href="#generator">Start from GMB</ButtonLink>
          </div>
          <div className="-mx-5 mt-12 grid border-t border-neutral-200 md:grid-cols-2">
            <article className="border-b border-neutral-200 px-5 py-8 md:border-r md:border-b-0 md:py-10">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">{posts[0]!.category}</p>
              <h3 className="text-balance text-2xl tracking-normal">{posts[0]!.title}</h3>
              <p className="mt-3 text-pretty text-sm leading-6 text-neutral-600">{posts[0]!.text}</p>
              <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-400">
                <span>{posts[0]!.date}</span>
                <span>6 min read</span>
              </div>
            </article>
            <div>
              {posts.slice(1).map((post, index) => (
                <article key={post.title} className={`px-5 py-8 md:py-10 ${index === 0 ? "border-b border-neutral-200" : ""}`}>
                  <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">{post.category}</p>
                  <h3 className="text-balance text-2xl tracking-normal">{post.title}</h3>
                  <p className="mt-3 text-pretty text-sm leading-6 text-neutral-600">{post.text}</p>
                  <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-400">
                    <span>{post.date}</span>
                    <span>4 min read</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-neutral-950 py-24 text-white md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(247,202,91,.45),transparent_28%),linear-gradient(120deg,#344733,#b08922_45%,#161616)] opacity-85" />
        <div className="absolute inset-0 opacity-50 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.12)_0,rgba(255,255,255,.12)_1px,transparent_1px,transparent_36px),repeating-linear-gradient(90deg,rgba(255,255,255,.12)_0,rgba(255,255,255,.12)_1px,transparent_1px,transparent_36px)]" />
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-balance text-3xl tracking-normal md:text-5xl">
              See what AI-native leasing looks like
            </h2>
            <p className="mt-4 text-balance text-base leading-7 text-white/80">
              Use the imported Tour.new flow, then move into recording or ridealong from the same Next.js app.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="#generator"
                className="inline-flex items-center gap-1.5 border border-white/15 bg-white/10 px-6 py-3 text-sm tracking-wide text-white shadow-[inset_0_0_3px_rgba(255,255,255,0.4),0_0_30px_rgba(255,255,255,0.2)] transition hover:bg-white/15"
              >
                Create a script
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/tour-record"
                className="inline-flex items-center gap-1.5 border border-white/15 bg-white px-6 py-3 text-sm tracking-wide text-neutral-950 transition hover:bg-white/90"
              >
                Record tour
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-[#fbfaf7]">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="shrink-0 lg:w-1/3">
              <img src="/images/tour logo TYG.svg" alt="Tour.video" className="h-9 w-auto" />
              <p className="mt-4 max-w-xs text-sm leading-6 text-neutral-600">
                The AI-native video leasing platform built for modern multifamily and student housing teams.
              </p>
            </div>
            <div className="grid grow grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
              {[
                ["Product", "Video Tours", "AI Answers", "Scheduling", "Attribution"],
                ["Solutions", "Multifamily", "Student Housing", "Lease-ups", "Marketing Teams"],
                ["Create", "GMB Generator", "Tour Record", "Ridealong", "Supabase"],
                ["Company", "About", "Careers", "Privacy", "Terms"]
              ].map(([heading, ...links]) => (
                <div key={heading}>
                  <h3 className="mb-3 text-sm font-medium">{heading}</h3>
                  <ul className="space-y-2">
                    {links.map((item) => (
                      <li key={item}>
                        <Link href={footerHref(item)} className="text-sm text-neutral-500 hover:text-neutral-950">
                          {item}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
            © 2026 Tour.video. All rights reserved.
          </div>
        </div>
        <div className="flex justify-center overflow-hidden px-5 pb-8">
          <div className="text-[20vw] font-semibold leading-none tracking-normal text-neutral-950/[0.04]">
            Tour.video
          </div>
        </div>
      </footer>
    </main>
  );
}

function BusinessHeroSearch({
  isSearching,
  onSearch
}: {
  isSearching: boolean;
  onSearch: (value: string) => Promise<boolean>;
}) {
  const [activeAudience, setActiveAudience] = useState<AudienceTab>("businesses");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const activeConfig = audienceTabs.find((tab) => tab.id === activeAudience) || audienceTabs[0]!;
  const hasValue = query.trim().length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (activeAudience !== "businesses") {
      setMessage(activeConfig.emptyText);
      document.querySelector("#generator")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const found = await onSearch(query);
    setMessage(found ? "Business found. Continue in the generator below." : "Try a business name with city, or paste the website.");
  };

  return (
    <form onSubmit={handleSubmit} className="relative mt-7 w-full max-w-[45rem]">
      <fieldset className="mb-5 grid max-w-[31rem] grid-cols-3 rounded-full border border-white/30 bg-white/30 p-1.5 backdrop-blur-md">
        <legend className="sr-only">Choose audience</legend>
        {audienceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeAudience === tab.id}
            onClick={() => {
              setActiveAudience(tab.id);
              setQuery("");
              setMessage("");
            }}
            className={`h-12 rounded-full text-sm font-semibold transition ${
              activeAudience === tab.id
                ? "bg-neutral-950 text-white shadow-[0_10px_26px_rgba(0,0,0,0.24)]"
                : "text-white hover:bg-white/15"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </fieldset>

      <div className="flex min-h-[3.75rem] items-center rounded-full border border-white/90 bg-white px-4 py-1.5 shadow-[0_18px_54px_rgba(0,0,0,0.26)] transition focus-within:border-white focus-within:shadow-[0_22px_70px_rgba(77,138,229,0.26)] sm:px-5">
        <Search className="mr-3 h-5 w-5 shrink-0 text-neutral-400" />
        <label htmlFor="business-tour-search" className="sr-only">
          {activeConfig.label} search
        </label>
        <input
          id="business-tour-search"
          name="business-tour-search"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={activeConfig.placeholder}
          disabled={isSearching}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-neutral-950 outline-none placeholder:text-neutral-400 sm:text-base"
        />
        <button
          type="submit"
          disabled={isSearching || !hasValue}
          className={`ml-3 flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white transition sm:px-5 ${
            hasValue && !isSearching
              ? "bg-[#07551f] shadow-[0_12px_32px_rgba(7,85,31,0.34)] hover:-translate-y-0.5 hover:bg-[#064719]"
              : "bg-[#07551f] opacity-45"
          } disabled:cursor-not-allowed`}
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className="hidden whitespace-nowrap sm:inline">{activeConfig.button}</span>
              <ArrowRight className="h-4 w-4 -rotate-45" />
            </>
          )}
        </button>
        <Link
          href="/tour-record"
          className="group/call ml-2 hidden h-11 w-[7.75rem] shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-950 px-5 text-sm font-bold text-white transition-[width,background-color] duration-300 hover:w-[9rem] hover:bg-neutral-800 md:flex"
        >
          <span className="whitespace-nowrap">Record</span>
          <ArrowRight className="ml-0 h-4 w-4 -rotate-45 opacity-0 transition-[margin,opacity,transform] duration-300 group-hover/call:ml-2 group-hover/call:translate-x-0.5 group-hover/call:opacity-100" />
        </Link>
      </div>

      {message && <p className="mt-2 text-left text-xs font-medium text-white/70">{message}</p>}
    </form>
  );
}

function SecurityWidgetSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % widgetSlides.length);
    }, 9000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const nextSrc = widgetSlides[activeIndex]!.src;
    if (videoEl.getAttribute("src") !== nextSrc) {
      videoEl.src = nextSrc;
      videoEl.load();
    }

    videoEl.play().catch(() => {});
  }, [activeIndex]);

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + widgetSlides.length) % widgetSlides.length);
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % widgetSlides.length);
  };

  return (
    <div className="mx-auto mt-12 w-full max-w-5xl md:mt-16">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-2xl shadow-black/35">
        <div className="aspect-[16/10] w-full bg-black sm:aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={widgetSlides[0]!.src}
            aria-label={widgetSlides[activeIndex]!.label}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
          />
        </div>
        <button
          type="button"
          onClick={goToPrevious}
          aria-label="Show previous widget demo"
          className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur transition hover:bg-black/55 md:left-5"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={goToNext}
          aria-label="Show next widget demo"
          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur transition hover:bg-black/55 md:right-5"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-5 flex items-center justify-center gap-2">
        {widgetSlides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Show ${slide.label}`}
            className={`h-2.5 rounded-full border border-white/40 transition ${
              activeIndex === index ? "w-7 bg-white" : "w-2.5 bg-white/25 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ButtonLink({
  href,
  children,
  invert = false
}: {
  href: string;
  children: ReactNode;
  invert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm tracking-wide transition ${
        invert
          ? "border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800"
          : "border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-100"
      }`}
    >
      {children}
      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
    </Link>
  );
}

function LandingPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 shadow-sm">
      {children}
    </span>
  );
}

function Alert({ children, tone }: { children: string; tone: "success" | "error" }) {
  return (
    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
      tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700"
    }`}>
      {children}
    </div>
  );
}

function GeneratorPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-neutral-600 ring-1 ring-neutral-200">
      {children}
    </span>
  );
}

function footerHref(item: string) {
  if (item === "Privacy") return "/privacy-policy";
  if (item === "Tour Record") return "/tour-record";
  if (item === "Ridealong") return "/tour-ridealong";
  if (item === "GMB Generator" || item === "Supabase") return "#generator";
  return "#";
}
