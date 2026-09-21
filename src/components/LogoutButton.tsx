// Logout must be a POST: a GET link gets prefetched by Next.js and would end the
// session of anyone who merely opened a panel page (that bug logged users out
// right after their first panel page). A plain form needs no JavaScript.
export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <form action="/logout" method="post" className="inline-flex">
      <button type="submit" className={`btn btn-ghost !py-1.5 text-xs ${className}`}>
        خروج
      </button>
    </form>
  );
}
