// Dark mode inverts the whole app via a CSS filter (see NavShell / globals.css
// .dark-mode), which also inverts emoji glyphs into odd colours since they're
// just coloured pixels to the filter. Splits arbitrary text on emoji
// characters and wraps each one in a span that cancels the inversion out —
// same trick used for photos and the cocktail glass illustrations.
const EMOJI_RE = /(\p{Extended_Pictographic}️?)/gu;

export function EmojiText({ text }: { text: string }) {
  const parts = text.split(EMOJI_RE).filter((part) => part !== "");
  return (
    <>
      {parts.map((part, i) =>
        /\p{Extended_Pictographic}/u.test(part) ? (
          <span key={i} className="dark-mode-invert">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
