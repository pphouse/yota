import { Avatar } from "@/components/Avatar";
import { NarrationIcon } from "@/components/icons";
import { callName, type Persona } from "@/lib/characters";
import { parseStory, toBeats, toBlocks, type Block } from "@/lib/story";

const AVATAR = 38;

/**
 * キャラの返答。台詞とその人物の動作（斜体）を、話者のアイコンつきの吹き出しにまとめる。
 * 情景（場所の空気や周りの人の反応）は、吹き出しの外にナレーションとして置く。
 */
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
  const blocks = toBlocks(
    toBeats(
      text,
      personas.map((p) => p.name),
    ),
    personas.length === 1,
  );
  return (
    <div className="space-y-3.5">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} personas={personas} watch={watch} />
      ))}
    </div>
  );
}

/** 情景・プロローグ。三本線の印と斜体の文で、吹き出しの外に置く */
export function SceneNarration({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 px-1">
      <NarrationIcon size={17} className="mt-[0.3rem] shrink-0 text-mist/80" />
      <p className="break-phrase whitespace-pre-wrap text-[0.9rem] italic leading-[1.85] text-mist">{text}</p>
    </div>
  );
}

function BlockView({ block, personas, watch }: { block: Block; personas: Persona[]; watch?: boolean }) {
  if (block.kind === "scene") return <SceneNarration text={block.text} />;
  if (block.kind === "note") {
    return (
      <p className="py-1 text-center">
        <span className="inline-block rounded-full bg-night-2/90 px-3 py-1 text-[0.7rem] leading-5 text-mist">{block.text}</span>
      </p>
    );
  }
  const persona = block.speaker === undefined ? undefined : personas[block.speaker];
  const right = watch && block.speaker === 1;
  return (
    <div className={`flex items-start gap-2.5 ${right ? "flex-row-reverse" : ""}`}>
      {persona ? <Avatar persona={persona} size={AVATAR} /> : <span className="shrink-0" style={{ width: AVATAR }} />}
      <div className={`flex min-w-0 max-w-[82%] flex-col ${right ? "items-end" : "items-start"}`}>
        {persona && (
          <span className="mb-1 px-1 text-[0.74rem] font-bold" style={{ color: persona.color }}>
            {callName(persona)}
          </span>
        )}
        <div
          className={`space-y-2 rounded-[1.25rem] bg-night-3 px-4 py-3 ${right ? "rounded-tr-[0.4rem]" : "rounded-tl-[0.4rem]"}`}
        >
          {block.items.map((item, i) =>
            item.kind === "narration" ? (
              <p key={i} className="break-phrase whitespace-pre-wrap text-[0.88rem] italic leading-[1.8] text-mist">
                {item.text}
              </p>
            ) : (
              <p key={i} className="whitespace-pre-wrap text-[0.97rem] leading-[1.75] text-paper">
                {item.text}
                {item.open && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-paper/70" />}
              </p>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function Typing({ persona }: { persona: Persona }) {
  return (
    <div className="flex items-center gap-2.5" aria-label={`${callName(persona)}が返事を書いています`}>
      <Avatar persona={persona} size={AVATAR} />
      <p className="typing flex gap-1.5 rounded-[1.25rem] rounded-tl-[0.4rem] bg-night-3 px-4 py-3 text-[0.6rem] text-mist">
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </p>
      <span className="text-xs text-mist">{callName(persona)}が書いています</span>
    </div>
  );
}

/** あなたの発言。主人公モードはグラデーションの吹き出し、見守りモードは「見たい展開」のメモとして中央に置く。 */
export function UserMessage({ text, watch }: { text: string; watch?: boolean }) {
  const parts = parseStory(text);
  if (watch) {
    return (
      <div className="mx-auto w-fit max-w-[88%] rounded-2xl bg-night-2/85 px-4 py-2 text-center ring-1 ring-brand">
        <p className="text-[0.68rem] font-bold text-brand">あなたが見たい展開</p>
        <p className="break-phrase mt-0.5 text-[0.88rem] leading-6 text-paper">{parts.map((p) => p.text).join(" ")}</p>
      </div>
    );
  }
  return (
    <div className="bg-brand-grad ml-auto w-fit max-w-[80%] rounded-[1.25rem] rounded-br-[0.4rem] px-4 py-2.5 text-[0.95rem] leading-7 text-white">
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
