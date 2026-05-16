import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { termsDocument } from "@/content/legal-documents";
import { getCanonicalUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: termsDocument.shortTitle,
  description: termsDocument.description,
  alternates: {
    canonical: getCanonicalUrl("/terms")
  },
  openGraph: {
    url: getCanonicalUrl("/terms")
  }
};

export default function TermsPage() {
  return <LegalDocumentPage document={termsDocument} />;
}
