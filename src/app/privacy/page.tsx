import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { privacyDocument } from "@/content/legal-documents";
import { getCanonicalUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: privacyDocument.shortTitle,
  description: privacyDocument.description,
  alternates: {
    canonical: getCanonicalUrl("/privacy")
  },
  openGraph: {
    url: getCanonicalUrl("/privacy")
  }
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={privacyDocument} />;
}
