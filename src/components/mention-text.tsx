import { buildMentionRegex, type MentionablePerson } from "@/lib/mentions";

// Same emoji-split trick as EmojiText (see that file's comment on why dark
// mode needs it), plus a second pass bolding any "@Full Name" that matches
// the current roster — the same mentions the push notification was sent
// for when this was posted.
const EMOJI_RE = /(\p{Extended_Pictographic}️?)/gu;

export function MentionText({ text, people }: { text: string; people: MentionablePerson[] }) {
  const mentionRe = buildMentionRegex(people);
  const names = new Set(people.map((p) => p.name));
  const emojiParts = text.split(EMOJI_RE).filter((part) => part !== "");
  let key = 0;
  return (
    <>
      {emojiParts.map((part) => {
        if (/\p{Extended_Pictographic}/u.test(part)) {
          return (
            <span key={key++} className="dark-mode-invert">
              {part}
            </span>
          );
        }
        if (!mentionRe) return <span key={key++}>{part}</span>;
        return part.split(mentionRe).map((chunk) =>
          names.has(chunk) ? (
            <span key={key++} style={{ fontWeight: 600 }}>
              @{chunk}
            </span>
          ) : (
            <span key={key++}>{chunk}</span>
          )
        );
      })}
    </>
  );
}
