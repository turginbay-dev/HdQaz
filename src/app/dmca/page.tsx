import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { dmcaDocument } from "@/content/legal-documents";
import { getCanonicalUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: dmcaDocument.shortTitle,
  description: dmcaDocument.description,
  alternates: {
    canonical: getCanonicalUrl("/dmca")
  },
  openGraph: {
    url: getCanonicalUrl("/dmca")
  }
};

export default function DmcaPage() {
  return <LegalDocumentPage document={dmcaDocument} />;
}
