import { parseStory } from "@/lib/story";

/** キャラの返答を、地の文は控えめに、台詞ははっきり組む */
export function StoryText({ text }: { text: string }) {
  const parts = parseStory(text);
  return (
    <div className="space-y-2.5 font-mincho text-[1.02rem] leading-[1.95]">
      {parts.map((p, i) =>
        p.kind === "narration" ? (
          <p key={i} className="text-[0.9rem] leading-[1.9] text-mist">
            {p.text}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-wrap text-paper">
            {p.text}
          </p>
        ),
      )}
    </div>
  );
}
