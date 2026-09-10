'use client'

/* Route-level 500 page: catches unhandled render/server errors inside the
   app shell and gives staff a human message plus a way out. */

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="root">
      <div className="scroll">
        <div className="empty">
          <span className="e-ico" role="img" aria-label="Cloche with a crack">
            🍽️
          </span>
          <h1 style={{ fontSize: 20, fontWeight: 900, marginTop: 14 }}>Something went wrong in the kitchen</h1>
          <p>
            This screen hit an unexpected error and could not load.
            <br />
            Your orders are safe. Nothing was charged twice.
          </p>
          {error?.digest && (
            <p style={{ fontSize: 11, opacity: 0.7 }}>Error ref: {error.digest}</p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => reset()}>
              Try again
            </button>
            <a className="btn btn-ghost" href="/" style={{ textDecoration: 'none' }}>
              Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
