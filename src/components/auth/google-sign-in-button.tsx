import { signInWithGoogle } from "@/app/auth/actions";

type GoogleSignInButtonProps = {
  disabled?: boolean;
};

export function GoogleSignInButton({ disabled = false }: GoogleSignInButtonProps) {
  return (
    <form action={signInWithGoogle}>
      <button
        disabled={disabled}
        className="cinema-sweep inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-6 text-sm font-semibold text-black shadow-[0_18px_70px_rgba(255,255,255,0.18)] transition hover:bg-[#f3ead5] disabled:cursor-not-allowed disabled:opacity-55"
        type="submit"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-sm font-black text-black">
          G
        </span>
        Google арқылы кіру
      </button>
    </form>
  );
}
