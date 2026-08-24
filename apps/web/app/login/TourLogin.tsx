"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  AtSign,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import styles from "./login.module.css";

type LoginStep = "email" | "code" | "property" | "profile" | "claim" | "register" | "signup-code";

type WorkspaceCommunity = {
  id: string;
  name: string;
  companyName: string | null;
  alias: string | null;
};

type Workspace = {
  user: { email: string; fullName: string | null; title?: string | null; phone?: string | null };
  teamMember?: { alias?: string | null; title?: string | null; phone?: string | null };
  community: WorkspaceCommunity;
  communities: WorkspaceCommunity[];
};

type BusinessOption = {
  id: string;
  name: string;
  companyName: string;
  alias: string | null;
};

type DiscoveredBusiness = {
  placeId: string;
  name: string;
  formattedAddress: string;
  website: string | null;
  existingTeam: {
    communityId: string;
    communityName: string;
    companyName: string;
  } | null;
};

type SignupMode = "join" | "create";

const PERSONAL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function TourLogin() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [propertyQuery, setPropertyQuery] = useState("");
  const [propertyResults, setPropertyResults] = useState<BusinessOption[] | null>(null);
  const [propertySearchLoading, setPropertySearchLoading] = useState(false);
  const [propertySearchError, setPropertySearchError] = useState<string | null>(null);
  const [selectedPropertyName, setSelectedPropertyName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAlias, setProfileAlias] = useState("");
  const [profileTitle, setProfileTitle] = useState("");
  const [claimQuery, setClaimQuery] = useState("");
  const [claimResults, setClaimResults] = useState<DiscoveredBusiness[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<DiscoveredBusiness | null>(null);
  const [signupMode, setSignupMode] = useState<SignupMode>("join");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [signupRequestId, setSignupRequestId] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [searchingClaim, setSearchingClaim] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "back">("forward");

  useEffect(() => {
    fetch("/api/admin/auth/me", { credentials: "same-origin" })
      .then((response) => {
        if (response.ok) router.replace(postLoginPath());
      })
      .catch(() => {});
  }, [router]);

  const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
  const emailLooksValid = Boolean(email.includes("@") && emailDomain && !PERSONAL_DOMAINS.has(emailDomain));
  const visibleWorkspaceCommunities = propertyResults !== null
    ? propertyResults
    : workspace?.communities ?? [];

  useEffect(() => {
    if (!workspace || step !== "property") return;
    const query = propertyQuery.trim();
    if (!query) {
      setPropertySearchLoading(false);
      setPropertySearchError(null);
      setPropertyResults(workspace.communities.map((community) => ({
        id: community.id,
        name: community.name,
        companyName: community.companyName ?? "Property team",
        alias: community.alias,
      })));
      return;
    }
    const timer = window.setTimeout(async () => {
      setPropertySearchLoading(true);
      setPropertySearchError(null);
      try {
        const params = new URLSearchParams({
          email: workspace.user.email,
          limit: "50",
        });
        if (query) params.set("q", query);
        const response = await fetch(`/api/admin/auth/businesses?${params.toString()}`, {
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(body.businesses)) {
          throw new Error(body.error ?? "Could not search properties.");
        }
        setPropertyResults(body.businesses);
      } catch (caught) {
        setPropertySearchError(caught instanceof Error ? caught.message : "Could not search properties.");
        setPropertyResults(query ? [] : workspace.communities.map((community) => ({
          id: community.id,
          name: community.name,
          companyName: community.companyName ?? "Property team",
          alias: community.alias,
        })));
      } finally {
        setPropertySearchLoading(false);
      }
    }, query ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [propertyQuery, step, workspace]);

  function go(next: LoginStep, direction: "forward" | "back" = "forward") {
    setError(null);
    setTransitionDirection(direction);
    setStep(next);
  }

  async function sendCode() {
    if (!emailLooksValid || submitting) return;
    setSubmitting(true);
    setError(null);
    setChallengeId("");
    try {
      const response = await fetch("/api/admin/auth/otp/start", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = await response.json().catch(() => ({}));
      const nextChallengeId = typeof body.challengeId === "string"
        ? body.challengeId.trim()
        : "";
      if (!response.ok || !nextChallengeId) {
        if (!response.ok && response.status === 429 && nextChallengeId) {
          setEmail(body.email ?? email.trim().toLowerCase());
          setChallengeId(nextChallengeId);
          setCode("");
          go("code");
          return;
        }
        throw new Error(body.error ?? "Could not send a sign-in code.");
      }
      setEmail(body.email ?? email.trim().toLowerCase());
      setChallengeId(nextChallengeId);
      setCode("");
      go("code");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send a sign-in code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    const normalized = code.replace(/\D/g, "");
    if (normalized.length !== 6 || !challengeId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/otp/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          challengeId,
          code: normalized,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not verify this email.");
      if (body.verified === true && body.onboardingRequired === true) {
        setChallengeId("");
        setCode("");
        go("claim");
        return;
      }
      if (!body.workspace) throw new Error(body.error ?? "Could not verify this email.");
      setWorkspace(body.workspace);
      setPropertyQuery("");
      setPropertyResults((body.workspace.communities ?? []).map((community: WorkspaceCommunity) => ({
        id: community.id,
        name: community.name,
        companyName: community.companyName ?? "Property team",
        alias: community.alias,
      })));
      if ((body.workspace.communities?.length ?? 0) > 1) go("property");
      else window.location.assign(postLoginPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify this email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseProperty(communityId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/community", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not open this property.");
      if (body.workspace) setWorkspace(body.workspace);
      if (body.needsContactCard) {
        const selected = visibleWorkspaceCommunities.find((community) => community.id === communityId);
        const nextWorkspace = body.workspace as Workspace;
        const nextName = nextWorkspace.user.fullName?.trim() || email.split("@")[0] || "";
        setSelectedPropertyName(selected?.name ?? nextWorkspace.community.name);
        setFullName(nextName);
        setProfilePhone(nextWorkspace.user.phone ?? nextWorkspace.teamMember?.phone ?? "");
        setProfileTitle(nextWorkspace.user.title ?? nextWorkspace.teamMember?.title ?? "Leasing Agent");
        setProfileAlias(
          nextWorkspace.teamMember?.alias?.replace(/^@/, "")
          || aliasFromName(nextName || email.split("@")[0] || "team-member")
        );
        go("profile");
        return;
      }
      window.location.assign(postLoginPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this property.");
    } finally {
      setSubmitting(false);
    }
  }

  async function savePropertyCard() {
    if (submitting || fullName.trim().length < 2 || profilePhone.replace(/\D/g, "").length < 7 || !profileAlias) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/community/profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          phone: profilePhone.trim(),
          alias: profileAlias,
          title: profileTitle.trim(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not create your property card.");
      window.location.assign(postLoginPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your property card.");
    } finally {
      setSubmitting(false);
    }
  }

  async function searchClaim() {
    if (claimQuery.trim().length < 2) return;
    setSearchingClaim(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/auth/signup/discover?q=${encodeURIComponent(claimQuery.trim())}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not search properties.");
      setClaimResults(body.businesses ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not search properties.");
    } finally {
      setSearchingClaim(false);
    }
  }

  function selectClaim(business: DiscoveredBusiness) {
    setSelectedClaim(business);
    setSignupMode(business.existingTeam ? "join" : "create");
    setCompanyName(business.existingTeam?.companyName ?? business.name);
    go("register");
  }

  async function startRegistration() {
    if (!selectedClaim || !emailLooksValid || !fullName.trim() || password.length < 8 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/signup/start", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          fullName,
          mode: signupMode,
          placeId: selectedClaim.placeId,
          communityId: signupMode === "join" ? selectedClaim.existingTeam?.communityId : null,
          companyName,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not start onboarding.");
      if (body.verified) {
        window.location.assign(postLoginPath());
        return;
      }
      setSignupRequestId(body.requestId);
      setSignupCode("");
      go("signup-code");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifySignup() {
    if (!signupRequestId || signupCode.replace(/\s+/g, "").length < 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/signup/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: signupRequestId,
          email: email.trim().toLowerCase(),
          token: signupCode,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not verify onboarding.");
      window.location.assign(postLoginPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.videoStage} aria-hidden="true">
        <video className={styles.ambientVideo} autoPlay muted loop playsInline preload="auto">
          <source src="/videos/login-bg.mp4" type="video/mp4" />
        </video>
        <video className={styles.heroVideo} autoPlay muted loop playsInline preload="auto">
          <source src="/videos/login-bg.mp4" type="video/mp4" />
        </video>
        <div className={styles.sideShade} />
        <div className={styles.verticalShade} />
        <div className={styles.ambientGlow} />
      </div>

      <div className={styles.layout}>
        <aside className={styles.story}>
          <Image
            className={styles.storyLogo}
            src="/images/tour%20logo%20TYG%20dark.svg"
            alt="Tour"
            width={139}
            height={50}
            priority
          />
          <p className={styles.storyEyebrow}>The leasing workspace</p>
          <h2>Every great business deserves a great tour.</h2>
          <p className={styles.storyCopy}>
            Bring sessions, follow-up, team insights, and your best tour materials into one focused workspace.
          </p>
          <div className={styles.storyTrust}>
            <span><ShieldCheck size={16} /> Property-aware access</span>
            <span className={styles.storyDot} />
            <span>Built for leasing teams</span>
          </div>
        </aside>

        <section className={styles.shell} aria-label="Tour sign in">
          <header className={styles.header}>
            <div className={styles.brand}>
              <Image
                src="/images/tour%20logo%20TYG.svg"
                alt="Tour"
                width={111}
                height={40}
                priority
              />
              <span>Property-team workspace</span>
            </div>
            <span className={styles.stepLabel}>{stepLabel(step)}</span>
          </header>

          <div className={styles.progress} data-steps={step === "profile" ? "4" : "3"} aria-hidden="true">
            <span data-active="true" />
            <span data-active={step !== "email" ? "true" : "false"} />
            <span data-active={["property", "profile", "claim", "register", "signup-code"].includes(step) ? "true" : "false"} />
            {step === "profile" && <span data-active="true" />}
          </div>

          <div className={styles.content}>
          {step === "email" && (
            <div className={`${styles.businessStep} ${transitionDirection === "back" ? styles.stepBack : styles.stepForward}`}>
              <div className={styles.intro}>
                <span className={styles.eyebrow}>Access</span>
                <h1>Start with your work email</h1>
                <p>We’ll verify your email first, then show your properties or help you claim your community.</p>
              </div>

              <label className={styles.search}>
                <Mail size={16} />
                <input
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setChallengeId("");
                    setError(null);
                  }}
                  placeholder="you@company.com"
                  aria-label="Work email"
                  type="email"
                  autoComplete="email"
                />
              </label>

              {email.includes("@") && PERSONAL_DOMAINS.has(emailDomain) && (
                <div className={styles.error}>Use the work email connected to your property team.</div>
              )}

              {emailLooksValid && (
                <div className={styles.statusCard}>
                  <ShieldCheck size={18} />
                  <span>We’ll verify this email before showing any property access.</span>
                </div>
              )}

              {error && <div className={styles.error}>{error}</div>}

              <button
                type="button"
                className={styles.primaryButton}
                disabled={!emailLooksValid || submitting}
                onClick={() => void sendCode()}
              >
                {submitting ? "Sending code..." : "Email me a sign-in code"} <ArrowRight size={17} />
              </button>
            </div>
          )}

          {step === "code" && (
            <div className={`${styles.signInStep} ${styles.stepForward}`}>
              <BackButton label="Use a different email" onClick={() => go("email", "back")} />
              <div className={styles.intro}>
                <span className={styles.eyebrow}>Verification</span>
                <h1>Check your email</h1>
                <p>Enter the 6-digit code sent to {email}.</p>
              </div>
              <label className={styles.field}>
                <span>Verification code</span>
                <div><Mail size={16} /><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" autoComplete="one-time-code" autoFocus /></div>
              </label>
              {error && <div className={styles.error}>{error}</div>}
              <button type="button" className={styles.primaryButton} disabled={code.length !== 6 || submitting} onClick={() => void verifyCode()}>
                {submitting ? "Verifying..." : "Verify and continue"}
              </button>
            </div>
          )}

          {step === "property" && workspace && (
            <div className={`${styles.businessStep} ${transitionDirection === "back" ? styles.stepBack : styles.stepForward}`}>
              <BackButton label="Back to email" onClick={() => go("email", "back")} />
              <div className={styles.intro}>
                <span className={styles.eyebrow}>Property</span>
                <h1>Choose where you’re working today</h1>
                <p>Your sessions, assets, rubrics, and integrations will match this property.</p>
              </div>
              <label className={styles.search}>
                <Search size={16} />
                <input
                  value={propertyQuery}
                  onChange={(event) => setPropertyQuery(event.target.value)}
                  placeholder="Search properties"
                  aria-label="Search properties"
                  autoFocus
                />
              </label>
              <div className={styles.resultCount}>
                {propertySearchLoading ? "Searching properties…" : `${visibleWorkspaceCommunities.length} matching properties`}
              </div>
              <div className={styles.businessList}>
                {visibleWorkspaceCommunities.map((community) => (
                  <button
                    key={community.id}
                    type="button"
                    className={styles.businessRow}
                    data-selected={workspace.community.id === community.id}
                    disabled={submitting}
                    onClick={() => void chooseProperty(community.id)}
                  >
                    <span className={styles.businessIcon}><Building2 size={17} /></span>
                    <span className={styles.businessText}>
                      <strong>{community.name}</strong>
                      <small>{community.companyName ?? "Property team"}</small>
                    </span>
                  </button>
                ))}
                {visibleWorkspaceCommunities.length === 0 && (
                  <div className={styles.empty}>{propertySearchError ?? "No matching properties."}</div>
                )}
              </div>
              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}

          {step === "profile" && workspace && (
            <div className={`${styles.signInStep} ${styles.stepForward}`}>
              <BackButton label="Choose another property" onClick={() => go("property", "back")} />
              <div className={styles.selectedBusiness}>
                <span className={styles.selectedIcon}><Building2 size={18} /></span>
                <span>
                  <strong>{selectedPropertyName || workspace.community.name}</strong>
                  <small>Your new property contact card</small>
                </span>
              </div>
              <div className={styles.intro}>
                <span className={styles.eyebrow}>Contact card</span>
                <h1>Confirm how visitors see you</h1>
                <p>This is saved to this property’s team and prefilled the next time you create a property card.</p>
              </div>
              <label className={styles.field}>
                <span>Full name</span>
                <div><UserRound size={16} /><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" autoFocus /></div>
              </label>
              <label className={styles.field}>
                <span>Phone number</span>
                <div><Phone size={16} /><input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="(555) 555-0123" /></div>
              </label>
              <label className={styles.field}>
                <span>Username</span>
                <div><AtSign size={16} /><input value={profileAlias} onChange={(event) => setProfileAlias(aliasFromName(event.target.value))} autoComplete="username" /></div>
              </label>
              <label className={styles.field}>
                <span>Title</span>
                <div><Sparkles size={16} /><input value={profileTitle} onChange={(event) => setProfileTitle(event.target.value)} placeholder="Leasing Agent" /></div>
              </label>
              <div className={styles.statusCard}>
                <ShieldCheck size={18} />
                <span>{email} is verified. These details will be tied to this property only.</span>
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button
                type="button"
                className={styles.primaryButton}
                disabled={fullName.trim().length < 2 || profilePhone.replace(/\D/g, "").length < 7 || !profileAlias || submitting}
                onClick={() => void savePropertyCard()}
              >
                {submitting ? "Creating your card…" : "Create property card"} <ArrowRight size={17} />
              </button>
            </div>
          )}

          {step === "claim" && (
            <div className={`${styles.businessStep} ${transitionDirection === "back" ? styles.stepBack : styles.stepForward}`}>
              <BackButton label="Back to email" onClick={() => go("email", "back")} />
              <div className={styles.intro}>
                <span className={styles.eyebrow}>Claim property</span>
                <h1>Find your community</h1>
                <p>Search by property name and city. We’ll use Google Business data to verify and connect the workspace.</p>
              </div>
              <label className={styles.search}>
                <Search size={16} />
                <input value={claimQuery} onChange={(event) => setClaimQuery(event.target.value)} placeholder="The Parker Austin, TX" onKeyDown={(event) => { if (event.key === "Enter") void searchClaim(); }} />
              </label>
              <button type="button" className={styles.primaryButton} disabled={claimQuery.trim().length < 2 || searchingClaim} onClick={() => void searchClaim()}>
                {searchingClaim ? "Searching..." : "Search properties"}
              </button>
              <div className={styles.businessList}>
                {claimResults.map((business) => (
                  <button key={business.placeId} type="button" className={styles.businessRow} onClick={() => selectClaim(business)}>
                    <span className={styles.businessIcon}><MapPin size={17} /></span>
                    <span className={styles.businessText}>
                      <strong>{business.name}</strong>
                      <small>{business.existingTeam ? `Existing team · ${business.existingTeam.companyName}` : business.formattedAddress}</small>
                    </span>
                  </button>
                ))}
                {!searchingClaim && claimResults.length === 0 && <div className={styles.empty}>Search for your property to continue.</div>}
              </div>
              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}

          {step === "register" && selectedClaim && (
            <div className={`${styles.signInStep} ${transitionDirection === "back" ? styles.stepBack : styles.stepForward}`}>
              <BackButton label="Choose another property" onClick={() => go("claim", "back")} />
              <div className={styles.selectedBusiness}>
                <span className={styles.selectedIcon}><Building2 size={18} /></span>
                <span>
                  <strong>{selectedClaim.name}</strong>
                  <small>{selectedClaim.existingTeam ? "Join existing team" : "Create a new team claim"}</small>
                </span>
              </div>
              <div className={styles.intro}>
                <span className={styles.eyebrow}>Onboarding</span>
                <h1>{signupMode === "join" ? "Request team access" : "Claim this property"}</h1>
                <p>We’ll verify your email and create your property workspace access.</p>
              </div>
              <label className={styles.field}><span>Full name</span><div><Sparkles size={16} /><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></div></label>
              <label className={styles.field}><span>Password</span><div><ShieldCheck size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /></div></label>
              {signupMode === "create" && <label className={styles.field}><span>Company / management group</span><div><Building2 size={16} /><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></div></label>}
              {error && <div className={styles.error}>{error}</div>}
              <button type="button" className={styles.primaryButton} disabled={!fullName.trim() || password.length < 8 || submitting} onClick={() => void startRegistration()}>
                {submitting ? "Starting..." : signupMode === "join" ? "Request access" : "Start property claim"}
              </button>
            </div>
          )}

          {step === "signup-code" && (
            <div className={`${styles.signInStep} ${styles.stepForward}`}>
              <BackButton label="Back" onClick={() => go("register", "back")} />
              <div className={styles.intro}>
                <span className={styles.eyebrow}>Final check</span>
                <h1>Verify your account</h1>
                <p>Enter the signup verification code sent to {email}.</p>
              </div>
              <label className={styles.field}><span>Signup code</span><div><Mail size={16} /><input value={signupCode} onChange={(event) => setSignupCode(event.target.value.replace(/\s+/g, ""))} inputMode="numeric" autoComplete="one-time-code" /></div></label>
              {error && <div className={styles.error}>{error}</div>}
              <button type="button" className={styles.primaryButton} disabled={signupCode.length < 6 || submitting} onClick={() => void verifySignup()}>
                {submitting ? "Verifying..." : "Finish onboarding"}
              </button>
            </div>
          )}
          </div>
        </section>
      </div>
    </main>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.backButton} onClick={onClick}>
      <ArrowLeft size={16} /> {label}
    </button>
  );
}

function stepLabel(step: LoginStep) {
  if (step === "email") return "Step 1 of 3";
  if (step === "code") return "Step 2 of 3";
  if (step === "property") return "Step 3 of 3";
  if (step === "profile") return "Step 4 of 4";
  if (step === "claim") return "Claim access";
  if (step === "register") return "Verify property";
  return "Finish setup";
}

function aliasFromName(value: string) {
  return value
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function postLoginPath() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/api/") || next.startsWith("/login")) {
    return "/";
  }
  return next;
}
