import { InfoPageShell } from "./InfoPageShell";
import { Markdown } from "./Markdown";

const SOURCE = `# Warranty

Every purchase on Commonplace is backed by protection, and an optional extended warranty is available for added peace of mind.

## Commonplace Verified

Commonplace Verified is included with every purchase on the marketplace. Our trained team inspects the item in person before delivery to make sure that it is working and matches the seller's description, ensuring it meets our quality standards.

- **In-person inspection:** Drivers confirm the brand, model, color, and included accessories against the listing.
- **Functionality check:** The item must power on and demonstrate its core functions before it is loaded.
- **Documented at pickup:** 6+ photos and a functionality video are captured and sent to you via text or email.

## Extended Warranty (Optional)

Our extended warranty is optional and is **not included in the purchase price**. When added at checkout, it covers repairs or replacement if your equipment breaks from normal use.

- **What it covers:** Mechanical or functional failure that occurs during normal, intended use.
- **What it excludes:** Cosmetic wear, misuse, accidental damage, and neglect.
- **Exact terms depend on the item.** Full coverage details for your specific purchase are provided at checkout.

## 48-Hour Latent Defect Window

Separate from the optional warranty, every order includes a limited return right for hidden, material defects that were not detectable at delivery. If a covered defect appears within 48 hours of delivery, contact us and we'll make it right.

## Need Help With a Claim?

If your item breaks or a defect appears, reach out and we'll walk you through your options.

- **Email:** service@trycommonplace.com
- **Phone:** 858-997-4008
- **Hours:** Sunday – Friday, 9 AM – 9 PM ET`;

export function WarrantyPage() {
  return (
    <InfoPageShell>
      <Markdown source={SOURCE} />
    </InfoPageShell>
  );
}
