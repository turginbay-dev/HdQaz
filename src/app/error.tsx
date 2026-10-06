"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center"><h1 className="text-2xl font-bold">Бірдеңе дұрыс болмады.</h1><p>Біраздан кейін қайта көріңіз.</p><button className="min-h-11 rounded-full bg-white px-6 text-black" type="button" onClick={reset}>Қайта көру</button></main>;
}
