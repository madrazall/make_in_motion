"use client";

export function DeleteContentPostButton({ action }: { action: () => void }) {
  function handleSubmit(e: React.FormEvent) {
    if (!confirm("Delete this post idea? Can't be undone.")) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <button className="rounded-lg border-2 border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10">
        Delete
      </button>
    </form>
  );
}
