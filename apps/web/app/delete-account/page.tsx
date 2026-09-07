import type { Metadata } from "next";

import "./delete-account.css";

export const metadata: Metadata = {
  title: "Delete your account | Tour",
  description: "Request deletion of your Tour account and associated personal data without installing or signing in to the app.",
  alternates: { canonical: "https://tour.you/delete-account" },
};

const requestUrl = `mailto:parmar.amulya@gmail.com?${new URLSearchParams({
  subject: "Tour account and personal data deletion request",
  body: "Please delete my Tour account and associated personal data.\n\nAccount email: \nName: \nProperty (optional): \n\nPlease confirm any identity-verification steps and let me know when deletion is complete, including any data that must be retained and for how long.",
}).toString()}`;

export default function DeleteAccountPage() {
  return (
    <main className="deletion-page">
      <div className="deletion-shell">
        <a className="deletion-brand" href="/">Tour</a>
        <h1>Delete your account</h1>
        <p className="deletion-lead">Request deletion of your Tour account and associated personal data. You do not need to sign in or reinstall the app.</p>

        <section aria-labelledby="request-heading">
          <h2 id="request-heading">Send a deletion request</h2>
          <p>Email us from the address associated with your Tour account. Include your name and the account email you want deleted.</p>
          <a className="deletion-action" href={requestUrl}>Email deletion request</a>
          <p className="deletion-contact">You can also write directly to <a href="mailto:parmar.amulya@gmail.com">parmar.amulya@gmail.com</a> with the subject &quot;Tour account deletion&quot;.</p>
          <p>If you no longer have access to your account email, contact us and we will help verify ownership. Please do not send passwords or sign-in codes.</p>
        </section>

        <section aria-labelledby="next-heading">
          <h2 id="next-heading">What happens next</h2>
          <p>Our support team will verify that you own the account before processing your request. We will confirm the deletion scope and timing by email, and notify you when it is complete.</p>
          <p>Your request covers your account, profile and contact information, and associated personal data, including recordings, transcripts, notes, uploaded media and chat content.</p>
          <p>If any information must be retained for legal, security or fraud-prevention reasons, we will explain which information, why it is retained and the applicable retention period. We will also explain how your request applies to content shared with a property or organization.</p>
        </section>

        <section aria-labelledby="app-heading">
          <h2 id="app-heading">From the app</h2>
          <p>You can also open Tour, go to Settings and select Delete account. For help with associated data or a previous deletion request, use the email above.</p>
        </section>
        <footer><a href="/privacy-policy">Privacy policy</a><a href="/support">Contact support</a></footer>
      </div>
    </main>
  );
}
