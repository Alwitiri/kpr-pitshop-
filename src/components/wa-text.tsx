/** Shows a WhatsApp message the way WhatsApp formats it: *bold* and _italic_, line breaks kept. */
export function WaText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 2 && p.startsWith("*") && p.endsWith("*") ? (
          <b key={i}>{p.slice(1, -1)}</b>
        ) : p.length > 2 && p.startsWith("_") && p.endsWith("_") ? (
          <i key={i}>{p.slice(1, -1)}</i>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** WhatsApp-style green chat bubble. */
export function WaBubble({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-[#dcf8c6] p-3 text-sm leading-relaxed text-gray-900 shadow-sm">
      <WaText text={text} />
    </div>
  );
}
