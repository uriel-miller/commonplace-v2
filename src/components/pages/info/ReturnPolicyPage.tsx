import { InfoPageShell } from "./InfoPageShell";
import { Markdown } from "./Markdown";

const SOURCE = `# Return Policy

All sales are final — but you are never on your own. Our buyer protection ensures full coverage if the item does not meet the described condition, or is damaged during transit.

## Inspect and Test at Delivery

You can inspect, test, and use your product upon delivery. This is the best moment to make sure everything is right.

- **Try it out:** Power it on and confirm the core functions work as described.
- **Something wrong at delivery?** We'll swap it out for free, on the spot.
- **After delivery:** Once delivery is complete, products are no longer eligible for returns or swaps.

## Defective, Damaged, or Incorrect Items

If you receive a defective, damaged, or incorrect item, contact us immediately so we can make it right. Our 48-hour latent defect window covers hidden issues that were not detectable during the delivery inspection.

## Cancellation Policy

- **Before pickup:** You may cancel for any reason before the item is loaded for a full refund.
- **Restocking fee:** Cancellations after that point are subject to a 10% restocking fee.
- **Late delivery:** If your order hasn't arrived within 2 weeks, you can cancel for a full refund — no fee.

## How to Reach Us

- **Email:** service@trycommonplace.com
- **Phone:** (516) 357-5989
- **Hours:** Sunday – Friday, 9 AM – 9 PM ET`;

export function ReturnPolicyPage() {
  return (
    <InfoPageShell>
      <Markdown source={SOURCE} />
    </InfoPageShell>
  );
}
