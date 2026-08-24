"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type {
  FormEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  RefObject
} from "react";
import {
  Check,
  CheckCircle2,
  Download,
  Globe2,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Send,
  UserRound,
  X
} from "lucide-react";

import type { CheckInQuestion, RepCard } from "@/lib/reps";

import styles from "./check-in-card.module.css";

type CheckInCardProps = {
  card: RepCard;
  vCardUrl: string;
  offlineQrUrl: string;
  /** Open check-in form immediately (e.g. QR `?check-in=true`). */
  initialSheet?: "none" | "contact";
  /** Explicit session binding carried by a session check-in QR. */
  sessionId?: string | null;
};

type Sheet = "none" | "qr" | "contact" | "questions" | "done";
type Notification = { id: number; message: string; exiting: boolean };
type FloatingInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "placeholder"> & {
  fieldClassName?: string;
  inputClassName?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
};

const EMAIL_DOMAINS = ["gmail.com", "icloud.com", "yahoo.com", "outlook.com", "hotmail.com"];

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  const first = digits.slice(0, 3);
  const second = digits.slice(3, 6);
  const third = digits.slice(6, 10);

  if (digits.length <= 3) return first;
  if (digits.length <= 6) return `${first} ${second}`;
  return `${first} ${second} ${third}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function emailSuggestions(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.includes(" ")) return [];

  const [local, domain = ""] = trimmed.split("@");
  if (!local || trimmed.includes("@", trimmed.indexOf("@") + 1)) return [];

  return EMAIL_DOMAINS.filter((candidate) => candidate.startsWith(domain))
    .map((candidate) => `${local}@${candidate}`)
    .filter((candidate) => candidate !== trimmed)
    .slice(0, 5);
}

function FloatingInput({
  fieldClassName,
  inputClassName,
  inputRef,
  label,
  value,
  defaultValue,
  ...props
}: FloatingInputProps) {
  const hasValue =
    typeof value === "string"
      ? value.length > 0
      : typeof value === "number" || Boolean(defaultValue);
  const fieldClass = [
    styles.floatingField,
    hasValue ? styles.floatingFieldFilled : "",
    fieldClassName ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={fieldClass}>
      <input
        ref={inputRef}
        className={[styles.floatingInput, inputClassName ?? ""].filter(Boolean).join(" ")}
        placeholder=" "
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
      <span className={styles.floatingLabel}>{label}</span>
    </label>
  );
}

function EmailSuggestionList({ id, suggestions }: { id: string; suggestions: string[] }) {
  return (
    <datalist id={id}>
      {suggestions.map((suggestion) => (
        <option key={suggestion} value={suggestion} />
      ))}
    </datalist>
  );
}

export function CheckInCard({
  card,
  vCardUrl,
  offlineQrUrl,
  initialSheet = "none",
  sessionId = null,
}: CheckInCardProps) {
  const { rep, property, questions } = card;
  const [sheet, setSheet] = useState<Sheet>(initialSheet === "contact" ? "contact" : "none");
  const [checkedIn, setCheckedIn] = useState(false);
  const [sharedCheckInAnswers, setSharedCheckInAnswers] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isSaveDockFloating, setIsSaveDockFloating] = useState(false);
  const saveSlotRef = useRef<HTMLDivElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const exitTimer = useRef<number | null>(null);
  const removeTimer = useRef<number | null>(null);

  function clearNotificationTimers() {
    if (exitTimer.current) window.clearTimeout(exitTimer.current);
    if (removeTimer.current) window.clearTimeout(removeTimer.current);
  }

  function showToast(message: string) {
    clearNotificationTimers();
    const id = Date.now();
    setNotification({ id, message, exiting: false });
    exitTimer.current = window.setTimeout(() => {
      setNotification((current) =>
        current?.id === id ? { ...current, exiting: true } : current
      );
    }, 2200);
    removeTimer.current = window.setTimeout(() => {
      setNotification((current) => (current?.id === id ? null : current));
    }, 2500);
  }

  useEffect(() => clearNotificationTimers, []);

  useEffect(() => {
    if (initialSheet === "contact") {
      setSheet("contact");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const checkIn = params.get("check-in");
    if (checkIn === "true" || checkIn === "1" || checkIn === "yes") {
      setSheet("contact");
    }
  }, [initialSheet]);

  useEffect(() => {
    function updateSaveDockState() {
      const slot = saveSlotRef.current;
      const button = saveButtonRef.current;
      if (!slot || !button) return;

      const slotRect = slot.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const naturalButtonTop = slotRect.top + 38;
      const floatingButtonTop = window.innerHeight - buttonRect.height - 12;
      setIsSaveDockFloating(naturalButtonTop > floatingButtonTop + 1);
    }

    updateSaveDockState();
    window.addEventListener("scroll", updateSaveDockState, { passive: true });
    window.addEventListener("resize", updateSaveDockState);

    return () => {
      window.removeEventListener("scroll", updateSaveDockState);
      window.removeEventListener("resize", updateSaveDockState);
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <section className={styles.card}>
          <div className={styles.header}>
            {property.mediaUrl ? (
              property.mediaKind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img aria-hidden="true" alt="" src={property.mediaUrl} className={styles.headerVideo} />
              ) : (
                <video
                  aria-hidden="true"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  src={property.mediaUrl}
                  className={styles.headerVideo}
                />
              )
            ) : null}
            <div className={styles.headerOverlay} />
            <span className={styles.brand}>tour.you</span>
            <div className={styles.avatar}>
              {rep.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rep.avatarUrl} alt={rep.name} />
              ) : (
                <span>{rep.initials}</span>
              )}
            </div>
          </div>

          <div className={styles.body}>
            <h1 className={styles.name}>{rep.name}</h1>
            <p className={styles.title}>{rep.title}</p>
            <p className={styles.company}>{property.name}</p>

            <div className={styles.fields}>
              {rep.email ? (
                <ContactField href={`mailto:${rep.email}`} icon={<Mail size={16} />}>
                  {rep.email}
                </ContactField>
              ) : null}
              {rep.phoneValue ? (
                <ContactField href={`tel:${rep.phoneValue}`} icon={<Phone size={16} />}>
                  {rep.phoneDisplay}
                </ContactField>
              ) : null}
              {rep.website ? (
                <ContactField href={rep.website} icon={<Globe2 size={16} />}>
                  {rep.websiteDisplay ?? rep.website}
                </ContactField>
              ) : null}
              {rep.linkedin ? (
                <ContactField href={rep.linkedin} icon={<Linkedin size={16} />}>
                  {rep.linkedinDisplay ?? rep.linkedin}
                </ContactField>
              ) : null}
            </div>

            <div
              ref={saveSlotRef}
              className={styles.saveSlot}
              // Floating dock must not sit over open sheets (steals form submit taps).
              aria-hidden={sheet !== "none"}
              style={sheet !== "none" ? { visibility: "hidden", pointerEvents: "none" } : undefined}
            >
              <div
                className={`${styles.saveDock} ${
                  isSaveDockFloating ? styles.saveDockFloating : ""
                }`}
              >
                <button
                  ref={saveButtonRef}
                  type="button"
                  className={`${styles.primaryBtn} ${styles.saveBtn} ${checkedIn ? styles.checkedStateBtn : ""}`}
                  disabled={checkedIn}
                  onClick={() => setSheet("contact")}
                >
                  {checkedIn ? <><Check size={18} strokeWidth={3} /> Checked in</> : "Check In"}
                </button>
                {checkedIn ? (
                  <button type="button" className={styles.backgroundAddAnotherBtn} onClick={() => setSheet("contact")}>
                    <UserRound size={17} /> Add another person / check in
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.actionChips}>
              <a
                className={styles.ghostBtn}
                href={vCardUrl}
                download={`${rep.slug}-contact.vcf`}
                onClick={() => showToast("Contact saved")}
              >
                <Download size={16} /> Save Contact
              </a>
              <button type="button" className={styles.ghostBtn} onClick={() => setSheet("qr")}>
                <QrCode size={16} /> Show QR
              </button>
            </div>

            <p className={styles.footerBrand}>
              <span>Powered by</span>
              <Image
                src="/images/tour%20logo%20TYG.svg"
                alt="Tour"
                width={139}
                height={50}
              />
            </p>
          </div>
        </section>

        {sheet === "qr" ? (
          <QrSheet name={rep.name} qrSvg={offlineQrUrl} onClose={() => setSheet("none")} />
        ) : null}

        {sheet === "contact" ? (
          <ContactSheet
            card={card}
            initialAnswers={sharedCheckInAnswers}
            sessionId={sessionId}
            onClose={() => setSheet("none")}
            onDone={(answers) => {
              setCheckedIn(true);
              const sharedQuestionIds = new Set(
                questions
                  .filter((question) => /hear.*about|how.*find|referral/i.test(question.label))
                  .map((question) => question.id),
              );
              setSharedCheckInAnswers(Object.fromEntries(
                Object.entries(answers).filter(([id, value]) => sharedQuestionIds.has(id) && value),
              ));
              setSheet("done");
            }}
          />
        ) : null}

        {sheet === "done" ? (
          <DoneSheet
            card={card}
            onClose={() => setSheet("none")}
            onAddAnother={() => setSheet("contact")}
          />
        ) : null}

        {notification ? (
          <div
            className={`${styles.toast} ${notification.exiting ? styles.toastExit : ""}`}
            role="status"
            aria-live="polite"
          >
            <span className={styles.toastIcon}>
              <Check size={13} strokeWidth={3} />
            </span>
            <span>{notification.message}</span>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ContactField({ children, href, icon }: { children: string; href: string; icon: ReactNode }) {
  return (
    <a className={styles.field} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      <span className={styles.fieldIcon}>{icon}</span>
      <span className={styles.fieldLabel}>{children}</span>
    </a>
  );
}

function QrSheet({ name, qrSvg, onClose }: { name: string; qrSvg: string; onClose: () => void }) {
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <button className={styles.sheetClose} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <p className={styles.sheetTitle}>Scan to save {name}&apos;s Tour contact</p>
        <div className={styles.qrWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSvg} alt={`QR code for ${name}`} />
        </div>
      </div>
    </div>
  );
}

function ContactSheet({
  card,
  initialAnswers,
  sessionId,
  onClose,
  onDone
}: {
  card: RepCard;
  initialAnswers: Record<string, string>;
  sessionId: string | null;
  onClose: () => void;
  onDone: (answers: Record<string, string>) => void;
}) {
  const { rep, property, questions } = card;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState(`Tour ${property.name}`);
  const [wantsSummary, setWantsSummary] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [step, setStep] = useState<"contact" | "questions">("contact");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailListId = useId();
  const suggestions = emailSuggestions(email);

  useEffect(() => {
    firstNameRef.current?.focus();
    firstNameRef.current?.select();
  }, []);

  async function submitLead() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: phone.replace(/\D/g, ""),
          wantsSummary,
          reason,
          questionAnswers: answers,
          repSlug: rep.slug || null,
          repName: rep.slug ? rep.name : null,
          propertyName: property.name,
          propertyId: property.id ?? null,
          sessionId,
        })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }

      if (phone.trim() && rep.slug) {
        void fetch(`/api/p/${rep.slug}/text-contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone })
        }).catch(() => {});
      }

      onDone(answers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!firstName.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email.");
      return;
    }
    if (questions.length > 0) {
      setStep("questions");
      return;
    }
    void submitLead();
  }

  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
  }

  function submitQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitLead();
  }

  if (step === "questions") {
    return (
      <div className={styles.scrim} onClick={onClose}>
        <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <p className={styles.sheetTitle}>
            {firstName ? `${firstName}, ` : ""}one last thing before your tour
          </p>
          <form onSubmit={submitQuestions} action="#" method="post">
            {questions.map((question) =>
              question.type === "select" ? (
                <label key={question.id} className={styles.floatingField}>
                  <span className={styles.selectLabel}>{question.label}</span>
                  <select
                    className={styles.selectInput}
                    value={answers[question.id] ?? ""}
                    required={question.required}
                    onChange={(e) =>
                      setAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                    }
                  >
                    <option value="" disabled>
                      {question.placeholder ?? "Select one"}
                    </option>
                    {(question.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <FloatingInput
                  key={question.id}
                  label={question.label}
                  value={answers[question.id] ?? ""}
                  required={question.required}
                  onChange={(e) =>
                    setAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                  }
                />
              )
            )}

            <label className={styles.toggleRow}>
              <span>Send me follow-up notes after the tour</span>
              <input
                type="checkbox"
                checked={wantsSummary}
                onChange={(e) => setWantsSummary(e.target.checked)}
              />
            </label>

            {error ? (
              <p className={styles.fieldError} role="alert">
                {error}
              </p>
            ) : null}

            <div className={styles.buttonRow}>
              <button type="button" className={styles.backBtn} onClick={() => setStep("contact")}>
                Back
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                {submitting ? <Loader2 size={16} className={styles.spin} /> : <Send size={16} />}
                {submitting ? "Checking in..." : "Check in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.formHeadRow}>
          <div className={styles.formHeadAvatar}>
            {rep.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rep.avatarUrl} alt={rep.name} />
            ) : (
              <UserRound size={18} />
            )}
          </div>
          <div className={styles.formHeadText}>
            Check in for your tour
            <br />
            with {rep.name.split(" ")[0]}
          </div>
        </div>

        <form onSubmit={submitContact} action="#" method="post" noValidate>
          <div className={styles.row2}>
            <FloatingInput
              inputRef={firstNameRef}
              fieldClassName={styles.floatingFieldFlush}
              label="First name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <FloatingInput
              fieldClassName={styles.floatingFieldFlush}
              label="Last name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <FloatingInput
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            list={emailListId}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={submitOnEnter}
          />
          <EmailSuggestionList id={emailListId} suggestions={suggestions} />

          <div className={styles.phoneRow}>
            <span className={styles.phoneCc} aria-label="United States country code +1">
              <span className={styles.phoneFlag} aria-hidden="true">
                🇺🇸
              </span>
              <span>+1</span>
            </span>
            <FloatingInput
              fieldClassName={styles.phoneInputField}
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />
          </div>

          <FloatingInput
            label="Reason for visit"
            autoComplete="off"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          {questions.length === 0 ? (
            <label className={styles.toggleRow}>
              <span>Send me follow-up notes after the tour</span>
              <input
                type="checkbox"
                checked={wantsSummary}
                onChange={(e) => setWantsSummary(e.target.checked)}
              />
            </label>
          ) : null}

          {error ? (
            <p className={styles.fieldError} role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className={styles.primaryBtn} disabled={submitting}>
            {submitting ? <Loader2 size={16} className={styles.spin} /> : <Send size={16} />}
            {questions.length > 0 ? "Next" : submitting ? "Checking in..." : "Check in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function DoneSheet({ card, onClose, onAddAnother }: { card: RepCard; onClose: () => void; onAddAnother: () => void }) {
  const { rep, property } = card;

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.confetti} aria-hidden="true">
          {Array.from({ length: 20 }, (_, index) => (
            <span key={index} style={{ left: `${5 + index * 4.7}%`, animationDelay: `${index * 45}ms` }} />
          ))}
        </div>
        <button className={styles.sheetClose} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <CheckCircle2 size={54} className={styles.doneIcon} />
        <p className={styles.sheetTitle}>You&apos;re checked in</p>
        <p className={styles.doneText}>
          Thanks for visiting {property.name}. {rep.name.split(" ")[0]} has your
          contact details and will be with you shortly.
        </p>
        <div className={styles.doneActions}>
          <button type="button" className={`${styles.primaryBtn} ${styles.checkedButton}`} onClick={onClose}>
            <Check size={18} strokeWidth={3} /> Checked in
          </button>
          <button type="button" className={styles.addAnotherButton} onClick={onAddAnother}>
            <UserRound size={17} /> Add another person / check in
          </button>
        </div>
      </div>
    </div>
  );
}
