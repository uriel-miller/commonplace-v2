import { InfoPageShell } from "./InfoPageShell";
import { Markdown } from "./Markdown";

const SOURCE = `# Privacy Policy

Commonplace, Inc. ("Commonplace," "we," "us") respects your privacy. This policy explains what we collect, how we use it, and the choices you have. Questions? Email service@trycommonplace.com.

## Information We Collect

- **Contact details:** Your name, phone number, and email address when you list an item, place an order, or reach out to support.
- **Transaction information:** Items you buy or sell, delivery addresses, order history, and payout details.
- **Payment information:** Processed securely by our third-party payment providers (such as card processors, PayPal, Venmo, and Cash App). We do not store full card numbers.
- **Usage data:** Device, browser, and interaction data collected automatically to keep the marketplace secure and reliable.

## How We Use Your Information

- To create and manage listings, orders, and payouts.
- To coordinate pickup, delivery, and in-person inspection with our driver network.
- To send order updates, delivery notifications, and support responses via text and email.
- To detect and prevent fraud, and to enforce our Terms & Conditions.
- To improve the marketplace and our services.

## How We Share Your Information

- **Drivers:** We share the information needed to complete a pickup or delivery (such as name, address, and contact number) with the assigned driver.
- **Buyers and Sellers:** Limited details are shared between the two sides of a transaction so it can be completed.
- **Service providers:** Payment processors, communications platforms, and infrastructure providers that operate the marketplace on our behalf.
- **Legal:** When required by law, or to protect the rights, safety, and property of Commonplace and its users.

We do not sell your personal information.

## Communications

By providing your phone number and email, you consent to receive transactional messages about your listings and orders. You can opt out of non-essential messages at any time by contacting us.

## Cookies

We use cookies and similar technologies to keep you signed in, remember your preferences, and understand how the marketplace is used. You can control cookies through your browser settings.

## Data Retention & Security

We retain your information for as long as needed to provide our services and meet legal obligations, then delete or anonymize it. We use reasonable technical and organizational safeguards to protect your data, though no method of transmission or storage is completely secure.

## Your Choices

- Access, update, or delete your listing and account information by contacting us.
- Opt out of non-essential communications.
- Request a copy of the personal information we hold about you.

## Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be reflected here with an updated effective date.

## Contact Us

- **Email:** service@trycommonplace.com
- **Phone:** 858-997-4008
- **Hours:** Sunday – Friday, 9 AM – 9 PM ET`;

export function PrivacyPage() {
  return (
    <InfoPageShell>
      <Markdown source={SOURCE} />
    </InfoPageShell>
  );
}
