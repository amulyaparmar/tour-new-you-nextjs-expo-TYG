"use client";

import { FormEvent, useState } from "react";

import "./support.css";

const categories = ["General question", "Bug report", "Account help", "Feedback", "App Review"];

export default function SupportPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "We could not send your request.");
      setStatus("sent");
      event.currentTarget.reset();
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "We could not send your request.");
    }
  }

  return (
    <main className="support-page">
      <div className="support-shell">
        <a className="support-brand" href="/">tour.you</a>
        <div className="support-grid">
          <section className="support-intro">
            <p className="support-eyebrow">Support</p>
            <h1>How can we help?</h1>
            <p>Send the Tour team a message and we’ll follow up by email. Include the property, account email, and any useful details so we can help quickly.</p>
            <div className="support-contact"><span>Prefer email?</span><a href="mailto:parmar.amulya@gmail.com">parmar.amulya@gmail.com</a></div>
          </section>
          <form className="support-card" onSubmit={submit}>
            <label className="support-honeypot">Company website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            <label>Name<input name="name" required maxLength={120} autoComplete="name" placeholder="Your name" /></label>
            <label>Email<input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
            <label>Topic<select name="category" defaultValue={categories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>How can we help?<textarea name="message" required minLength={10} maxLength={5000} rows={7} placeholder="Tell us what you need help with…" /></label>
            {status === "sent" && <p className="support-success" role="status">Thanks — your message was sent to the Tour support team.</p>}
            {status === "error" && <p className="support-error" role="alert">{error}</p>}
            <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send support request"}</button>
            <p className="support-note">By submitting this form, you agree that we may use your message and contact information to respond to your request.</p>
          </form>
        </div>
      </div>
    </main>
  );
}
