import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | X-Poost" },
    { name: "description", content: "Privacy Policy for the X-Poost Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "40px auto", padding: "0 20px", lineHeight: "1.6", color: "#333" }}>
      <h1 style={{ borderBottom: "2px solid #eaeaea", paddingBottom: "10px" }}>Privacy Policy</h1>
      <p><strong>Last Updated: September 29, 2026</strong></p>

      <p>
        This Privacy Policy describes how your personal information is collected, used, and shared when you install or use 
        <strong> X-Poost</strong> (the "App") in connection with your Shopify-supported store.
      </p>

      <h2>Personal Information the App Collects</h2>
      <p>
        When you install the App, we are automatically able to access certain types of information from your Shopify account:
      </p>
      <ul>
        <li><strong>Shop Information:</strong> such as your domain, store name, and email address, used to identify your store and send essential communications.</li>
        <li><strong>Products and Collections:</strong> to allow the App to function and apply conversion tools like scarcity timers or quantity breaks to your merchandise.</li>
        <li><strong>Orders and Carts:</strong> anonymized cart interactions are monitored to power features like the shipping bar and in-cart upsells.</li>
      </ul>
      <p>
        Additionally, we collect information automatically when you interact with the App using cookies and similar tracking technologies to improve performance.
      </p>

      <h2>How Do We Use Your Personal Information?</h2>
      <p>
        We use the personal information we collect from you and your customers in order to provide the App’s functionality and to operate the App. 
        Additionally, we use this personal information to:
      </p>
      <ul>
        <li>Communicate with you;</li>
        <li>Optimize or improve the App; and</li>
        <li>Provide you with information or advertising relating to our products or services.</li>
      </ul>

      <h2>Sharing Your Personal Information</h2>
      <p>
        We may share your Personal Information to comply with applicable laws and regulations, to respond to a subpoena, search warrant or other lawful request for information we receive, or to otherwise protect our rights. 
        We do not sell your personal information or your customers' data to third parties.
      </p>

      <h2>Data Retention</h2>
      <p>
        When you place an order through the Site, we will maintain your Order Information for our records unless and until you ask us to delete this information. If you uninstall the app, we retain your configuration data for a limited time in case you reinstall, after which it is permanently deleted.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this privacy policy from time to time in order to reflect, for example, changes to our practices or for other operational, legal or regulatory reasons.
      </p>

      <h2>Contact Us</h2>
      <p>
        For more information about our privacy practices, if you have questions, or if you would like to make a complaint, please contact us by email at the developer email address provided on our Shopify App Store listing.
      </p>
    </div>
  );
}
