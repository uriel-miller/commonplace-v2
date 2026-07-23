import { InfoPageShell } from "./InfoPageShell";
import { Markdown } from "./Markdown";

const SOURCE = `# Invite. Earn. Grow Together.

Join the Commonplace referral program — where you and your friends both earn rewards just for sharing the marketplace you love.

- $150 Coupon or $50 Cash
- Instant Rewards
- Secure & Verified

## Your Referral Link

Copy your unique referral link below and share it with friends — rewards are automatic when they buy or sell.

*(Please verify your phone number to view your referral link.)*

By participating, you agree to our Referral Terms & Conditions.

## Rewards

### 💵 Referrer Reward

Choose between **$50 cash** or a **$150 marketplace coupon** when your friend completes their first purchase or submits their first listing.

### 🎁 Referee Reward

Your friend receives an instant **$50 discount** on their first purchase — no hoops, just savings.

### ⚡ Fast & Easy

Rewards are credited automatically when conditions are met — no forms, no delays.

## How it works

1. **Copy your link** — Grab your referral URL from the box above and share it with people who want to buy or sell quality equipment.
2. **Friend buys or sells** — Referee completes a purchase or submits a listing using your link — the system validates automatically.
3. **Claim your reward** — Choose your reward: $50 cash or a $150 coupon. It's available to you automatically — fast and simple.

## Start sharing — start earning

Copy your referral link and help friends get $50 off while you choose your reward. It's easy, fast, and secure.`;

export function ReferPage() {
  return (
    <InfoPageShell>
      <Markdown source={SOURCE} />
    </InfoPageShell>
  );
}
