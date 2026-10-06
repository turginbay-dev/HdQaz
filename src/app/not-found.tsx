import Link from "next/link";
export default function NotFound() {
  return <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center"><h1 className="text-2xl font-bold">Бұл бет табылмады.</h1><Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-white px-6 text-black">Басты бетке</Link></main>;
}
