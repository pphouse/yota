import { Avatar } from "@/components/Avatar";
import { callName, type Persona } from "@/lib/characters";
import { parseStory, toBeats, type Beat } from "@/lib/story";

const BUBBLE = "rounded-[1.25rem] bg-night-3/95 px-4 py-2.5 text-[0.98rem] leading-[1.75] text-paper shadow-[0_2px_10px_-4px_rgba(0,0,0,0.5)]";

/** キャラの返答。台詞は話者のアイコンつきの吹き出し、地の文はその間に小さく置く。 */
export function AssistantMessage({
  text,
  personas,
  streaming,
  watch,
}: {
  text: string;
  personas: Persona[];
  streaming?: boolean;
  /** 見守りモード：ふたり目の台詞を右側に置き、会話として見せる */
  watch?: boolean;
}) {
  if (streaming && !text) return <Typing persona={personas[0]} />;
  const beats = toBeats(
    text,
    personas.map((p) => p.name),
  );
  // 同じ人の台詞が続くときは、アイコンと名前を最初の一つだけにする
  const continued = beats.map((b, i) => {
    const prev = beats[i - 1];
    return b.kind === "line" && b.speaker !== undefined && prev?.kind === "line" && prev.speaker === b.speaker;
  });
  return (
    <div className="space-y-2">
      {beats.map((b, i) => (
        <BeatView key={i} beat={b} personas={personas} continued={continued[i]} watch={watch} />
      ))}
    </div>
  );
}

function BeatView({ beat, personas, continued, watch }: { beat: Beat; personas: Persona[]; continued: boolean; watch?: boolean }) {
  if (beat.kind === "narration") {
    return <p className="px-2 text-[0.88rem] leading-[1.8] text-mist">{beat.text}</p>;
  }
  if (beat.kind === "note") {
    return (
      <p className="py-1 text-center">
        <span className="inline-block rounded-full bg-night-2 px-3 py-1 text-[0.68rem] font-medium leading-5 text-mist">{beat.text}</span>
      </p>
    );
  }
  const persona = beat.speaker === undefined ? undefined : personas[beat.speaker];
  const right = watch && beat.speaker === 1;
  return (
    <div className={`flex items-start gap-2 ${right ? "flex-row-reverse" : ""}`}>
      {persona && !continued ? <Avatar persona={persona} size={38} /> : <span className="w-[38px] shrink-0" />}
      <div className={`flex min-w-0 max-w-[80%] flex-col ${right ? "items-end" : "items-start"}`}>
        {persona && !continued && (
          <span className="mb-1 px-1 text-[0.75rem] font-bold" style={{ color: persona.color }}>
            {callName(persona)}
          </span>
        )}
        <p className={`${BUBBLE} whitespace-pre-wrap ${right ? "rounded-tr-md" : "rounded-tl-md"}`}>
          {beat.text}
          {beat.open && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-paper/70" />}
        </p>
      </div>
    </div>
  );
}

function Typing({ persona }: { persona: Persona }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${callName(persona)}が返事を書いています`}>
      <Avatar persona={persona} size={38} />
      <p className={`${BUBBLE} typing flex gap-1.5 rounded-tl-md py-3 text-[0.55rem] text-mist`}>
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </p>
    </div>
  );
}

/** あなたの発言。主人公モードは右のブランド色の吹き出し、見守りモードは「見たい展開」として中央に置く。 */
export function UserMessage({ text, watch }: { text: string; watch?: boolean }) {
  const parts = parseStory(text);
  if (watch) {
    return (
      <div className="mx-auto w-fit max-w-[88%] rounded-2xl bg-night-2/90 px-4 py-2.5 text-center ring-1 ring-brand/40">
        <p className="text-brand-grad text-[0.7rem] font-bold">あなたが見たい展開</p>
        <p className="mt-0.5 text-[0.88rem] leading-6 text-paper">{parts.map((p) => p.text).join(" ")}</p>
      </div>
    );
  }
  return (
    <div
      className="ml-auto w-fit max-w-[80%] rounded-[1.25rem] rounded-br-md px-4 py-2.5 text-[0.95rem] leading-[1.7] text-white"
      style={{ background: "var(--brand-grad)" }}
    >
      {parts.map((p, i) =>
        p.kind === "narration" ? (
          <span key={i} className="block text-[0.82rem] text-white/75">
            {p.text}
          </span>
        ) : (
          <span key={i} className="block whitespace-pre-wrap">
            {p.text}
          </span>
        ),
      )}
    </div>
  );
}
