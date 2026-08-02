export const metadata = { title: "Privacy Policy — mvira", description: "Политика конфиденциальности платформы mvira.uz" };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px", fontFamily: "sans-serif", color: "#111", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 40 }}>Last updated: July 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>1. Information We Collect</h2>
      <p>We collect information you provide directly: name, email address, and account credentials. When you connect advertising platforms (Google Ads, Meta Ads, Yandex Direct), we receive and store OAuth access tokens to retrieve your campaign data on your behalf.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>2. How We Use Your Information</h2>
      <p>We use your information to provide and improve the mvira platform, including AI-powered content generation, landing page creation, and advertising analytics. We do not sell your personal data to third parties.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, marginTop: 32 }}>3. Third-Party Services</h2>
      <p>Our platform integrates with Google Ads API, Meta Ads API, and Yandex Direct API. Use of these services is subject to their respective privacy policies. We access only the data necessary to display your advertising statistics within mvira.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>4. Data Storage and Security</h2>
      <p>Your data is stored on secure servers. Access tokens for third-party platforms are encrypted. You can disconnect any platform integration at any time from the Integrations page, which will delete the associated access token from our systems.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>5. Your Rights</h2>
      <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us at <a href="mailto:mvi.digit@gmail.com" style={{ color: "#4F46E5" }}>mvi.digit@gmail.com</a>.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>6. Contact</h2>
      <p>mvira.uz — AI Marketing Platform<br />Email: <a href="mailto:mvi.digit@gmail.com" style={{ color: "#4F46E5" }}>mvi.digit@gmail.com</a></p>
    </div>
  );
}
