// Mobile photo-handoff page. The seller opens /add-photos/{code} on their phone
// (from the SMS link or by typing the code), snaps/picks photos, and they flow
// back to the desktop create-listing form. Standalone, mobile-first — no app chrome.

import type { Metadata } from "next";
import { MobilePhotoUpload } from "@/components/sell/MobilePhotoUpload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add listing photos",
  robots: { index: false, follow: false },
};

export default async function AddPhotosPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MobilePhotoUpload code={code} />;
}
