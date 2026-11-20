"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";

/** Shown inside the app (menu stays visible) if a page hits an unexpected error. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tooLarge = /exceeded|too large|413/i.test(error.message);
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Icon name="alert" className="h-6 w-6" /></div>
      <h1 className="text-xl font-bold">{tooLarge ? "That file is too large" : "Something went wrong on this screen"}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {tooLarge
          ? "Please choose a smaller file and try again."
          : "Your data is safe. Try again – if it keeps happening, note what you clicked and send the file data\\logs\\server.log to your software provider."}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button className="btn-primary" onClick={() => reset()}>Try again</button>
        <Link className="btn-outline" href="/">Go to dashboard</Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-gray-400">Error code: {error.digest}</p>}
    </div>
  );
}
