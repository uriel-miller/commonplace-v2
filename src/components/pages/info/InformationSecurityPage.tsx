import { InfoPageShell } from "./InfoPageShell";
import { Markdown } from "./Markdown";

const SOURCE = `# Information Security Policy

This Information Security Policy (the "Policy") describes how Commonplace protects the confidentiality, integrity, and availability of the data it handles, including personal and financial information belonging to the buyers, sellers, and drivers who use the Commonplace marketplace.

## Purpose and Scope

This Policy applies to all systems, people, and processes that store, transmit, or handle Commonplace data — the storefront, the admin, our APIs, our payout and identity systems, and the vendors we rely on.

## Roles and Responsibilities

Commonplace designates an Information Security Officer who is accountable for this Policy, for approving access, for coordinating incident response, and for the annual review.

## Data Classification

We categorize data as **Restricted** (financial account data), **Confidential** (personal data), **Internal** (operational data), and **Public** (marketing content). Handling and access requirements scale with sensitivity.

## Plaid and Financial Data Handling

Commonplace uses Plaid solely to verify bank account ownership and to enable payouts to sellers and drivers. We do not store full bank credentials, and financial account data is treated as Restricted.

## Identity and Access Management

Commonplace uses a centralized identity and access management system with single sign-on (SSO) as the primary method, so access can be granted and revoked consistently across every connected system.

## Access Control

Personnel receive only the access required to perform their role, and nothing more (least privilege). Access is reviewed periodically and adjusted when roles change.

## Authentication and Zero-Trust Access

Multi-factor authentication (MFA) is required on every administrative, hosting, payout, identity, and email system, with no exceptions.

## Personnel Security and De-provisioning

Automated offboarding removes access across connected systems when someone leaves or changes roles, so no orphaned access remains.

## Data Encryption

All communication with the storefront, the admin, and any APIs is encrypted using TLS. Sensitive data at rest is encrypted.

## Secrets and Key Management

Secrets are never committed to source code, embedded in client-side code, or stored in plaintext. They are held in a managed secrets store with restricted access.

## Vulnerability Management

Critical vulnerabilities must be remediated within 7 days; high-severity within 30 days. Dependencies and infrastructure are monitored for known issues.

## Logging and Monitoring

Logs are protected against tampering and retained for a reasonable period to support investigation and monitoring for anomalous activity.

## Secure Development

Secrets are never written into code or configuration that is checked into source control. Changes follow review before reaching production.

## Vendor and Third-Party Management

Primary providers include Plaid, a payment processor, and a managed WordPress host. Vendors are assessed for their security posture before and during use.

## Incident Response and Breach Notification

Where personal or financial data is affected, Commonplace notifies affected individuals and the relevant parties within 72 hours of confirming a reportable breach.

## Data Retention and Deletion

Transaction records are retained for 7 years to meet financial, tax, and legal obligations. Other data is deleted or anonymized when no longer needed.

## Business Continuity and Backups

Backups are encrypted and access to them is restricted, so the marketplace can be restored after an incident.

## Policy Governance

This Policy is reviewed annually and after material changes. Questions can be directed to service@trycommonplace.com.`;

export function InformationSecurityPage() {
  return (
    <InfoPageShell>
      <Markdown source={SOURCE} />
    </InfoPageShell>
  );
}
