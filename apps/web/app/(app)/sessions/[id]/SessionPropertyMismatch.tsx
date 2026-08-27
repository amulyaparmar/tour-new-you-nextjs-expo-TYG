"use client";

import { ArrowRight, Building2, LockKeyhole, X } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./session-detail.module.css";

export function SessionPropertyMismatch({
  currentPropertyName,
  targetPropertyId,
  targetPropertyName,
  canSwitch,
  sessionId,
  isAuthenticated = true,
}: {
  currentPropertyName: string | null;
  targetPropertyId: string | null;
  targetPropertyName: string;
  canSwitch: boolean;
  sessionId: string;
  isAuthenticated?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function switchProperty() {
    if (!targetPropertyId || switching) return;
    setSwitching(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/community", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId: targetPropertyId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not switch properties.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not switch properties.");
      setSwitching(false);
    }
  }

  async function requestAccess() {
    if (requesting || requested) return;
    setRequesting(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/request-access`, {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not request access.");
      setRequested(true);
      if (body.emailConfigured === false) {
        setRequestNotice("Your request was saved. Email delivery still needs to be configured by an administrator.");
      } else if ((body.emailsDelivered ?? 0) === 0) {
        setRequestNotice("Your request was saved, but the notification email could not be delivered. The property team can still see it.");
      } else {
        setRequestNotice(`Request sent to ${body.emailsDelivered} property team member${body.emailsDelivered === 1 ? "" : "s"}.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request access.");
    } finally {
      setRequesting(false);
    }
  }

  const primaryAction = !isAuthenticated ? (
    <a className="btn btn-primary" href={`/login?next=${encodeURIComponent(`/sessions/${sessionId}`)}`}>
      Sign in for full access
      <ArrowRight size={16} aria-hidden="true" />
    </a>
  ) : canSwitch && targetPropertyId ? (
    <button type="button" className="btn btn-primary" disabled={switching} onClick={() => void switchProperty()}>
      {switching ? "Switching…" : `Switch to ${targetPropertyName}`}
      {!switching && <ArrowRight size={16} aria-hidden="true" />}
    </button>
  ) : (
    <button type="button" className="btn btn-primary" disabled={requesting || requested} onClick={() => void requestAccess()}>
      {requesting ? "Sending request…" : requested ? "Access requested" : "Request team access"}
      {!requesting && !requested && <ArrowRight size={16} aria-hidden="true" />}
    </button>
  );

  return (
    <>
      <aside className={styles.readOnlySessionBanner} aria-label="Session access status">
        <LockKeyhole size={15} aria-hidden="true" />
        <span>
          {!isAuthenticated
            ? "Public session · Sign in to comment or make changes."
            : canSwitch
            ? `This session belongs to ${targetPropertyName}. Switch properties for its team context.`
            : `External session · Join ${targetPropertyName} to change its property-owned settings.`}
        </span>
        <button type="button" onClick={() => setOpen(true)}>View access</button>
      </aside>

      {open && (
        <div className={styles.propertyAccessOverlay} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className={styles.propertyMismatchCard} role="dialog" aria-modal="true" aria-labelledby="property-access-title">
            <button type="button" className={styles.propertyMismatchClose} onClick={() => setOpen(false)} aria-label="Close access notice">
              <X size={18} />
            </button>
            <span className={styles.propertyMismatchIcon}><Building2 size={22} /></span>
            <div>
              <p className={styles.propertyMismatchEyebrow}>{!isAuthenticated ? "Public session" : canSwitch ? "Different property" : "External session"}</p>
              <h1 id="property-access-title">{!isAuthenticated ? "You’re viewing this session as a guest" : `This session belongs to ${targetPropertyName}`}</h1>
              <p>
                {!isAuthenticated
                  ? "You can review the recording, transcript, scores, and feedback. Sign in to leave comments or make changes."
                  : <>You’re currently working in {currentPropertyName}. {canSwitch
                  ? "Switch properties to load the matching team, rubric, and assets. You may also close this notice and keep reviewing."
                  : "You can close this notice and review the session. Request team access for property-owned changes."}</>}
              </p>
            </div>
            <div className={styles.propertyMismatchActions}>
              {primaryAction}
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Continue to session</button>
            </div>
            {isAuthenticated && !canSwitch && <p className={styles.propertyMismatchAccess}>All existing property-team members will be notified.</p>}
            {requestNotice && <p className={styles.propertyMismatchSuccess}>{requestNotice}</p>}
            {error && <p className={styles.propertyMismatchError}>{error}</p>}
          </section>
        </div>
      )}
    </>
  );
}
