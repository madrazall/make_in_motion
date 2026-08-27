"use client";

/**
 * Only prompts when it actually matters. An event nobody's signed up for
 * deletes on the first click — no reason to make that a two-step dance.
 */
export function DeleteEventButton({
  action,
  headcount,
}: {
  action: () => void;
  headcount: number;
}) {
  function handleSubmit(e: React.FormEvent) {
    if (headcount > 0) {
      const ok = confirm(
        `${headcount} ${headcount === 1 ? "person has" : "people have"} paid to attend this event. ` +
          `Deleting it removes their orders from Make In Motion for good — Stripe still has the actual ` +
          `charge, but you won't be able to look them up here anymore. This can't be undone.\n\n` +
          `If you just want to stop it from selling, Cancel instead keeps every order on record.\n\n` +
          `Delete anyway?`
      );
      if (!ok) e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <button className="rounded-lg border-2 border-red-500/50 px-3 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10">
        Delete event
      </button>
    </form>
  );
}
