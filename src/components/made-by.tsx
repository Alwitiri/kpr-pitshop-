/** Small software-maker credit (Spoaxio) for the login and setup screens. */
export function MadeBy({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-xs text-gray-400 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/spoaxio.png" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
      <span>
        Software by <b className="font-semibold text-gray-200">Spoaxio</b>
      </span>
    </div>
  );
}
