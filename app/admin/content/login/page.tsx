import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  checkContentPassword,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export const metadata = { title: "Content calendar", robots: { index: false } };

export default async function ContentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    const target = String(formData.get("next") ?? "/admin/content");

    if (!(await checkContentPassword(password))) {
      redirect(`/admin/content/login?error=1&next=${encodeURIComponent(target)}`);
    }

    (await cookies()).set(
      SESSION_COOKIE,
      await createSessionToken("content"),
      sessionCookieOptions
    );
    redirect(target);
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-20">
      <h1 className="text-2xl font-bold">Content calendar</h1>
      <p className="mt-1.5 text-sm text-ink/60">
        A separate sign-in, scoped to just the content calendar — nothing else
        under admin is reachable from here.
      </p>
      <form action={login} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? "/admin/content"} />
        <input
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Password"
          className="w-full rounded-lg border border-white/15 bg-surface px-3 py-2.5 text-[16px]
                     focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20"
        />
        {error && <p className="text-sm text-clay">Wrong password.</p>}
        <button className="w-full rounded-lg bg-sage px-5 py-3 font-bold uppercase tracking-wide text-paper shadow-neon-cyan hover:bg-sage/85 transition-all">
          Sign in
        </button>
      </form>
    </div>
  );
}
