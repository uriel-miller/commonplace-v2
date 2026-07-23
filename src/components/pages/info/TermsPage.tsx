import { InfoPageShell } from "./InfoPageShell";
import { Markdown } from "./Markdown";

const SOURCE = `# Terms & Conditions

**Official Support:** service@trycommonplace.com

## 1. THE MARKETPLACE MODEL

Commonplace, Inc. ("Commonplace") operates a technology platform and logistics network connecting independent Buyers and Sellers of used home goods and fitness equipment.

- **"As-Is" Sales:** All items are used and sold "As-Is." Commonplace does not own the inventory and makes no warranties regarding the condition, safety, or fitness for a particular purpose beyond the specific 48-Hour Latent Defect Window.
- **The $1 Reservation:** To promote serious transactions, Buyers pay a $1 fee at checkout to hold an item. This is non-refundable once the item is loaded for transport at the Seller's location.

## 2. LOGISTICS & CANCELLATION

### 2.1 Delivery Fees & Distance

Commonplace calculates delivery fees based on a "Base Category Fee" plus a mileage rate of **$1.00 per mile (outbound)** and **$1.00 per mile (return to base)**.

- **Geographic Scope:** While we facilitate deliveries up to 1,000 miles, total costs are displayed transparently at checkout.
- **No Hard Cap:** If a Buyer chooses to pay the mileage for a 1,000-mile journey, the transaction is permitted, provided the driver network can support the route.

### 2.2 Pickup Documentation & "Point of No Return"

At pickup, our drivers record 6+ photos and a functionality video. This documentation is sent to the Buyer immediately via text/email.

- **Reference Only:** Delivery proceeds automatically; Buyer approval of the video is not required to move forward.
- **Cancellation Policy:** A Buyer may cancel for any reason before the item is loaded for a full refund.
- **Post-Pickup Cancellation:** Once the item is loaded and the driver departs the Seller's location, the Buyer is liable for Logistics Fees ($2.50/mile, one-way, applied beyond the free 100 miles).

### 2.3 White-Glove Delivery Standards

Our "Move and Place" service includes:

- **Included:** Carry-in (including stairs), room placement, assembly, leveling, and WiFi setup.
- **Excluded:** No electrical or plumbing. Commonplace will not perform hard-wiring or plumbing for Hot Tubs or Saunas. Buyers must hire licensed professionals for these connections.

## 3. PAYMENTS, DISBURSEMENTS, & RISK ALLOCATION

### 3.1 Buyer Payment

The remaining balance (Item + Delivery + Tax) is authorized at checkout and captured immediately when the Buyer clicks "Accept" during the delivery inspection.

### 3.2 Seller Payout (Paid at Pickup)

Sellers are paid immediately upon the delivery team successfully picking up the item.

- **Timing:** Payout is initiated once the item is loaded and the Bill of Sale is signed.
- **Methods:** Venmo/PayPal (Same-day); Bank Transfer/Cash App (1–3 business days).
- **Deductions:** Platform Fees (15–25%) and Pickup Fees ($50–$400) are deducted automatically.

#### 3.2.1 Pickup Inspection Requirements

Drivers have the sole authority to refuse a pickup if the item fails the following:

- **Listing Match:** Item must match the brand/model/color described.
- **Functionality:** Item must power on and demonstrate core functions.
- **Components:** All advertised accessories must be present.
- **Refusal Consequences:** Sale is canceled, Buyer is refunded.

#### 3.2.2 Payment Clawback & Seller Liability

Commonplace reserves the right to claw back funds (via future payout deduction, reversal, or legal collection) for:

- **Seller Fault:** Proven fraud or material misrepresentation.
- **Latent Defects:** Valid returns within the 48-hour window for hidden defects.
- **Fraud/Theft:** Items identified as stolen, counterfeit, or under active recall.

#### 3.2.3 Seller Representations & Warranties

By listing, the Seller warrants:

- **Ownership:** You are the legal owner with the right to sell.
- **Accuracy:** Your listing is 100% truthful.
- **Legal Compliance:** The item is not stolen or subject to a lien.
- **Breach:** Results in immediate payment reversal and potential criminal referral.

#### 3.2.4 Seller Indemnification

Seller agrees to indemnify Commonplace from all third-party claims, including chargebacks due to Seller fraud, stolen property claims, or personal injury caused by undisclosed defects.

### 3.3 Buyer Chargeback Policy & Account Consequences

- **Mandatory Resolution:** Buyers must contact service@trycommonplace.com and allow 5 business days for resolution before filing a bank dispute.
- **Permitted vs. Prohibited:**
  - ✓ **Permitted:** Valid latent defect return refused; duplicate billing.
  - ✗ **Prohibited:** Buyer's remorse; issues disclosed in listing; cosmetic issues visible at delivery.
- **Consequences:**
  - **Level 1:** If Commonplace wins a dispute, the Buyer is assessed a $25 Dispute Fee.
  - **Level 2:** Permanent account ban and entry into the "High-Risk Fraud Database."
  - **Level 3:** Reporting to the IC3 (FBI) and consumer reporting agencies.

## 4. THE 48-HOUR LATENT DEFECT WINDOW

This is a limited return right for hidden, material defects — not a warranty.

- **Eligibility:** You may request a return within 48 hours if a defect:
  - Was not detectable during the delivery inspection.
  - Was not disclosed in the listing description or pickup documentation.
  - Materially impairs the core function of the item.
- **Not Eligible:** Cosmetic wear consistent with a used item, issues visible at delivery, or a change of mind.
- **How to Report:** Email service@trycommonplace.com within 48 hours of delivery with photos and/or video demonstrating the defect.
- **Resolution:** Where a claim is validated, Commonplace will, at its discretion, arrange a repair, a replacement, a partial credit, or a return and refund.

## 5. LIMITATION OF LIABILITY

To the fullest extent permitted by law, Commonplace's total liability arising out of any transaction is limited to the amount paid by the Buyer for the item and its delivery. Commonplace is not liable for indirect, incidental, or consequential damages.

## 6. GOVERNING LAW & UPDATES

These Terms are governed by the laws of the United States and the state in which Commonplace, Inc. is incorporated. We may update these Terms from time to time; continued use of the platform constitutes acceptance of the current Terms. Questions? Contact service@trycommonplace.com.`;

export function TermsPage() {
  return (
    <InfoPageShell>
      <Markdown source={SOURCE} />
    </InfoPageShell>
  );
}
