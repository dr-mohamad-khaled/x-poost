import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service | X-Poost" },
    { name: "description", content: "Terms of Service for the X-Poost Shopify App" },
  ];
};

export default function TermsOfService() {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "40px auto", padding: "0 20px", lineHeight: "1.6", color: "#333" }}>
      <h1 style={{ borderBottom: "2px solid #eaeaea", paddingBottom: "10px" }}>Terms of Service</h1>
      <p><strong>Last Updated: September 29, 2026</strong></p>

      <p>
        These Terms of Service ("Terms") govern your access to and use of the <strong>X-Poost</strong> application ("the App"), operated by the developers of X-Poost ("we," "us," or "our"). 
        By installing or using the App in your Shopify store, you agree to be bound by these Terms.
      </p>

      <h2>1. Use of the App</h2>
      <p>
        The App provides conversion optimization tools, including quantity breaks, in-cart upsells, and scarcity timers, designed for use on the Shopify platform. 
        You are granted a limited, non-exclusive, non-transferable license to use the App in connection with your Shopify store. 
        You agree not to use the App for any illegal or unauthorized purpose.
      </p>

      <h2>2. Account and Data</h2>
      <p>
        To use the App, you must have an active Shopify account. The App will access certain data from your Shopify account (such as store details and product information) as outlined in our <a href="/privacy" style={{ color: "#0066cc" }}>Privacy Policy</a>. 
        You are responsible for ensuring that your use of the App complies with all applicable privacy laws regarding your customers' data.
      </p>

      <h2>3. Fees and Billing</h2>
      <p>
        The App is billed through Shopify’s billing system. By installing the App and selecting a premium plan (if applicable), you agree to pay the associated subscription fees. 
        All payments are handled directly by Shopify, and their billing policies apply. We reserve the right to change our pricing upon giving you notice.
      </p>

      <h2>4. Warranties and Limitation of Liability</h2>
      <p>
        The App is provided "as is" and "as available" without warranties of any kind, either express or implied. 
        We do not guarantee that the App will be uninterrupted, error-free, or completely secure. 
        To the maximum extent permitted by law, we shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from your use or inability to use the App, including but not limited to lost profits or data.
      </p>

      <h2>5. Termination</h2>
      <p>
        You may terminate these Terms at any time by uninstalling the App from your Shopify store. 
        We may suspend or terminate your access to the App if you violate these Terms or for any other reason at our sole discretion, without prior notice or liability.
      </p>

      <h2>6. Changes to the Terms</h2>
      <p>
        We reserve the right to modify these Terms at any time. We will notify users of any significant changes by updating the "Last Updated" date at the top of this page. 
        Your continued use of the App after such changes constitutes your acceptance of the new Terms.
      </p>

      <h2>7. Contact Us</h2>
      <p>
        If you have any questions about these Terms, please contact us via the support contact information provided on our Shopify App Store listing.
      </p>
    </div>
  );
}
