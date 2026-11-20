/** Shown instantly while a page's data loads, so a click always gets feedback. */
export default function Loading() {
  const bar = "animate-pulse rounded-md bg-gray-200/80";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 space-y-2">
        <div className={`${bar} h-7 w-56`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-2 p-4">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-7 w-28`} />
          </div>
        ))}
      </div>
      <div className="card space-y-3 p-5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`${bar} h-5`} style={{ width: `${92 - (i % 3) * 14}%` }} />
        ))}
      </div>
    </div>
  );
}
