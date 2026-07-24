import { type ComponentType } from "react";
import { AboutPage } from "./AboutPage";
import { ContactPage } from "./ContactPage";
import { ReferPage } from "./ReferPage";
import { TermsPage } from "./TermsPage";
import { WarrantyPage } from "./WarrantyPage";
import { ReturnPolicyPage } from "./ReturnPolicyPage";
import { PrivacyPage } from "./PrivacyPage";
import { InformationSecurityPage } from "./InformationSecurityPage";

export {
  AboutPage,
  ContactPage,
  ReferPage,
  TermsPage,
  WarrantyPage,
  ReturnPolicyPage,
  PrivacyPage,
  InformationSecurityPage,
};
export { InfoPageShell } from "./InfoPageShell";
export { Markdown } from "./Markdown";

/** Canonical slugs for the locally-ported info/marketing pages. */
export type InfoPageSlug =
  | "about"
  | "contact"
  | "refer"
  | "terms"
  | "warranty"
  | "return-policy"
  | "privacy"
  | "information-security";

export interface InfoPageEntry {
  /** Human-readable page name, used for nav links, tab titles, etc. */
  title: string;
  /** Zero-prop page component rendering the full page (shell + content). */
  Component: ComponentType;
  /** Extra slugs that should resolve to this same page. */
  aliases?: string[];
}

/**
 * Registry of every info page keyed by canonical slug. The orchestrator can
 * route `/[slug]` (and any listed alias) to the matching Component.
 */
export const INFO_PAGES: Record<InfoPageSlug, InfoPageEntry> = {
  about: { title: "About Us", Component: AboutPage, aliases: ["about-us"] },
  contact: { title: "Contact Us", Component: ContactPage, aliases: ["contact-us"] },
  refer: { title: "Referral Program", Component: ReferPage, aliases: ["referral", "referrals"] },
  terms: {
    title: "Terms & Conditions",
    Component: TermsPage,
    aliases: ["terms-and-conditions", "terms-conditions"],
  },
  warranty: { title: "Warranty", Component: WarrantyPage },
  "return-policy": {
    title: "Return Policy",
    Component: ReturnPolicyPage,
    aliases: ["returns", "return"],
  },
  privacy: {
    title: "Privacy Policy",
    Component: PrivacyPage,
    aliases: ["privacy-policy"],
  },
  "information-security": {
    title: "Information Security Policy",
    Component: InformationSecurityPage,
    aliases: ["information-security-policy", "infosec", "security-policy"],
  },
};

/** Resolve a canonical slug or any registered alias to its page entry. */
export function resolveInfoPage(slug: string): InfoPageEntry | undefined {
  const key = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (key in INFO_PAGES) return INFO_PAGES[key as InfoPageSlug];
  for (const entry of Object.values(INFO_PAGES)) {
    if (entry.aliases?.includes(key)) return entry;
  }
  return undefined;
}
