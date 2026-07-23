import { css } from "@/lib/design/css";
import { InfoPageShell } from "./InfoPageShell";
import { Markdown } from "./Markdown";

const SOURCE = `# Contact Us

Feel free to contact us regarding anything related to Commonplace and our services.

## Frequently Asked Questions

### How this works: Buying with Commonplace

- **Buy now or place a bid** – Lock in a deal instantly or submit an offer on select listings.
- **Optional pre-pickup inspection** – Request a check-in with our team to confirm the item's condition before delivery.
- **Pay securely online** – Checkout with your credit card or PayPal—safe and simple.
- **Fast delivery scheduling** – We arrange delivery within 1–3 days of your order.
- **Inspect at delivery** – Check the item in person upon arrival to make sure it matches the listing.
- **Buyer Protection** – You'll have the chance to test it out during delivery to ensure it meets your expectations.

*Making local marketplaces great again—one smooth delivery at a time.*

### How this works: Selling with Commonplace

1. **List your item for free** – Fill out a short form with your item details and phone number—no account needed.
2. **Buyers browse your listing** – Once live, interested local buyers can view and purchase or bid on your item directly.
3. **Pickup is scheduled** – A trained driver contacts you to coordinate a convenient pickup time.
4. **Item is inspected on-site** – The driver checks your item to confirm it matches the listing description.
5. **You get paid** – Payment is sent via Venmo, PayPal, or Bank Transfer/Cash App after inspection.

### Do you offer a warranty?

Yes! Our extended warranty (optional, not included in the purchase price) covers repairs or replacement if your equipment breaks from normal use. Exact terms depend on the item—details are provided at checkout.

### What does "Commonplace Verified" mean on a listing?

Commonplace Verified is included with every purchase on the marketplace. Our trained team inspects the item to make sure that it is working and matches the seller description, ensuring it meets quality standards before delivery.

### How much does delivery cost, and is it included?

Delivery starts at **$150** and is calculated at checkout based on the distance between the buyer and seller.

We offer **white glove service**, which means our team handles **pickup, transport, and full in-home setup** — so you don't lift a finger.

### How can I cancel/edit my listings?

Go to your dashboard located in the top right corner of your screen and navigate to "My listings." You can press the **pencil** icon to update details or the **trash** icon to remove the listing entirely.

### What is the return policy?

All sales are final, however, our buyer protection ensures full coverage if the item does not meet the described condition, or is damaged during transit. You can inspect, test, and use your product upon delivery. If anything is wrong at that time, we'll swap it out for free. After delivery, products are no longer eligible for returns or swaps.

If you receive a defective, damaged, or incorrect item, contact us immediately so we can make it right.

### What is the cancellation policy?

Cancellations are subject to a 10% restocking fee. However, if your order hasn't arrived within 2 weeks, you can cancel for a full refund—no fee.

## Still need help? Get in touch with us

- **Email:** service@trycommonplace.com
- **Phone:** 858-997-4008
- **Hours:** Sunday – Friday, 9 AM – 9 PM ET`;

const LABEL = "display:block;font-size:0.82rem;font-weight:600;color:var(--ink);margin:0 0 6px";
const FIELD =
  "width:100%;box-sizing:border-box;padding:11px 13px;border:1px solid var(--line);border-radius:11px;background:var(--paper);color:var(--ink);font-family:inherit;font-size:0.95rem;outline:none";

function Field({
  id,
  label,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
}) {
  return (
    <div style={css("margin:0 0 16px")}>
      <label htmlFor={id} style={css(LABEL)}>
        {label}
      </label>
      <input id={id} name={id} type={type} placeholder={placeholder} style={css(FIELD)} />
    </div>
  );
}

function ContactForm() {
  return (
    <section
      style={css(
        "margin:34px 0 0;padding:26px 24px;background:var(--paper);border:1px solid var(--line);border-radius:18px",
      )}
    >
      <h3
        style={css(
          "font-family:'Newsreader',serif;font-weight:600;font-size:1.35rem;color:var(--ink);margin:0 0 4px",
        )}
      >
        Send us a message
      </h3>
      <p style={css("margin:0 0 20px;font-size:0.95rem;line-height:1.6;color:var(--muted)")}>
        We usually reply within one business day.
      </p>

      <form>
        <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:0 16px")}>
          <Field id="name" label="Full name" placeholder="Jordan Rivera" />
          <Field id="phone" label="Phone" type="tel" placeholder="(858) 555-0142" />
        </div>
        <Field id="email" label="Email" type="email" placeholder="you@email.com" />
        <Field id="subject" label="Subject" placeholder="How can we help?" />

        <div style={css("margin:0 0 20px")}>
          <label htmlFor="message" style={css(LABEL)}>
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            placeholder="Tell us a bit about what you need…"
            style={css(FIELD + ";resize:vertical;min-height:120px;line-height:1.55")}
          />
        </div>

        <button
          type="button"
          style={css(
            "appearance:none;border:none;cursor:pointer;padding:13px 26px;border-radius:12px;background:var(--maroon);color:#fff;font-family:inherit;font-size:0.95rem;font-weight:600;letter-spacing:0.01em",
          )}
        >
          Send message
        </button>
        <p style={css("margin:14px 0 0;font-size:0.8rem;color:var(--muted)")}>
          Prefer email? Reach us any time at service@trycommonplace.com.
        </p>
      </form>
    </section>
  );
}

export function ContactPage() {
  return (
    <InfoPageShell>
      <Markdown source={SOURCE} />
      <ContactForm />
    </InfoPageShell>
  );
}
