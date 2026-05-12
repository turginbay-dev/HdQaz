import { redirect } from "next/navigation";

type LegacyMoviePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function LegacyMoviePage({ params }: LegacyMoviePageProps) {
  const { slug } = await params;

  redirect(`/${slug}`);
}
