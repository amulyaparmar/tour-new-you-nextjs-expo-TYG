import type { Metadata } from "next";

import "./privacy-policy.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Tour.you",
  description: "How Tour.you and Host Your Voice 501(c)(3) handle personal data.",
};

const sections: Array<[string, string]> = [
  ["What this policy covers", `This Privacy Policy explains how Host Your Voice 501(c)(3) ("Host Your Voice," "we," or "us") collects, uses, shares, and protects personal data when you use Tour.you, our websites, mobile applications, and related services (collectively, the "Services").`],
  ["Personal data we collect", `Depending on how you use Tour.you, we may collect account and contact information such as your name, email address, phone number, role, organization, and profile details; information you enter into the Services; recordings, transcripts, notes, images, and other content you choose to upload; device, browser, IP address, approximate location, and usage information; and communications you send to us. We may also receive information from your organization or service providers that help us operate the Services.`],
  ["How we use personal data", `We use personal data to provide, secure, maintain, customize, and improve Tour.you; create and manage accounts; process recordings and other content you request us to process; generate transcripts, summaries, insights, coaching, and roleplay feedback; provide support; communicate with you about the Services; understand usage and develop new features; prevent fraud, misuse, and security incidents; comply with law; and carry out other purposes described when data is collected or otherwise permitted by law.`],
  ["AI processing and training choices", `Tour.you may use AI services to transcribe or analyze content and to provide coaching, summaries, insights, or roleplay experiences. You can control whether your eligible content and feedback may be used to help improve AI features through the "AI Training Data feedback" setting in the mobile app. When the setting is off, we do not use that eligible content for model-improvement training, except where necessary to provide the feature you requested, maintain security, comply with law, or protect our rights. Your organization may separately control how business content is processed under its agreement with Host Your Voice.`],
  ["How we share personal data", `We may share personal data with hosting, storage, technology, analytics, communication, security, support, and AI service providers that process data for us; with your organization or other people you authorize; when required by law or necessary to protect people, property, or the Services; and in connection with a merger, acquisition, reorganization, or similar business transfer. We do not sell personal data or share it for cross-context behavioral advertising.`],
  ["Cookies and similar technologies", `Our websites may use essential, functional, and analytics technologies to keep the Services working, remember preferences, understand traffic, and improve the experience. You can manage cookies through your browser settings. Disabling some cookies may affect website functionality.`],
  ["Data security and retention", `We use reasonable technical, organizational, and administrative safeguards appropriate to the data and the way we process it. No internet transmission or storage system is completely secure. We retain personal data for as long as needed to provide the Services, fulfill the purposes described here, resolve disputes, enforce agreements, meet legal obligations, and protect the Services. We may retain aggregated or de-identified information that cannot reasonably identify you.`],
  ["Children", `Tour.you is not directed to children under 16, and we do not knowingly collect personal data from children under 16. If you believe a child has provided personal data to us, please contact us so we can review and delete it when appropriate.`],
  ["Your privacy rights", `Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or receive a portable copy of your personal data, and to withdraw consent where processing is based on consent. You may also have the right to appeal a decision about a privacy request. To make a request, contact us using the information below. We may need to verify your identity before completing a request. If you use Tour.you through an organization, that organization may be the controller of your data; please contact it first for data processed on its behalf.`],
  ["Changes to this policy", `We may update this Privacy Policy as the Services or legal requirements change. We will post the updated version here and, when appropriate, provide additional notice. The updated policy takes effect when posted unless a later date is stated.`],
];

export default function PrivacyPolicyPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-shell">
        <a className="privacy-brand" href="/">tour.you</a>
        <article className="privacy-card">
          <p className="privacy-eyebrow">Host Your Voice 501(c)(3)</p>
          <h1>Privacy Policy</h1>
          <p className="privacy-effective">Effective date: August 24, 2026</p>
          <p className="privacy-lead">We take your privacy seriously. This policy explains what information Tour.you collects, why we use it, and the choices available to you.</p>
          <nav className="privacy-toc" aria-label="Privacy policy contents">
            {sections.map(([title]) => <a key={title} href={`#${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{title}</a>)}
          </nav>
          {sections.map(([title, body]) => {
            const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            return <section key={title} id={id}><h2>{title}</h2><p>{body}</p></section>;
          })}
          <section><h2>Contact us</h2><p>Questions or privacy requests may be sent to <a href="mailto:privacy@tour.you">privacy@tour.you</a>. You may also write to Host Your Voice 501(c)(3) through <a href="https://tour.you">tour.you</a>.</p></section>
        </article>
      </div>
    </main>
  );
}
