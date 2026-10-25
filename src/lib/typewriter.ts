/**
 * 返答を1文字ずつ、人が書いているような速さで見せる。
 * 文章AIは長文でも一瞬で返してくるので、届いた分を貯めておき、決まった速さで少しずつ画面に出す。
 * 届いた分より先には進まない（通信が遅ければ、そのぶん待つ）。
 */

/** 1文字あたりの時間（ミリ秒）。約50文字/秒（句読点の間を入れると、400字でおよそ10秒） */
export const CHAR_MS = 20;
/** 何ミリ秒ごとに画面を更新するか */
const TICK_MS = 30;

const SENTENCE_END = "。！？!?";
const CLOSERS = "」』）)";

/** 直前の文字のあとに置く間（ミリ秒）。句読点や改行で少し息をつく */
export function pauseAfter(prev: string, next: string): number {
  if (prev === "\n") return 180;
  if (SENTENCE_END.includes(prev)) return SENTENCE_END.includes(next) || CLOSERS.includes(next) ? 0 : 160;
  if (CLOSERS.includes(prev)) return 110;
  if (prev === "…" || prev === "―") return next === prev ? 0 : 70;
  if (prev === "、" || prev === "，") return 60;
  return 0;
}

/** text の i 文字目を出すまでにかかる時間。地の文の印（*）は画面に出ないので待たない */
export function costOf(text: string, i: number): number {
  if (i === 0) return 0;
  const ch = text[i];
  if (ch === "*") return 0;
  return CHAR_MS + pauseAfter(text[i - 1], ch);
}

type Clock = {
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (id: unknown) => void;
};

const realClock: Clock = {
  now: () => performance.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export class Typewriter {
  private target = "";
  private shown = 0;
  private budget = 0;
  private last = 0;
  private timer: unknown = null;
  private ended = false;
  private settled = false;
  private resolveDone!: () => void;
  /** 届いた文章をすべて見せ終えたら解決する（end() のあと） */
  readonly done: Promise<void>;

  constructor(
    private readonly onUpdate: (text: string) => void,
    private readonly clock: Clock = realClock,
  ) {
    this.done = new Promise((r) => (this.resolveDone = r));
  }

  /** 届いた文章を足す */
  push(chunk: string) {
    if (this.settled || !chunk) return;
    this.target += chunk;
    this.kick();
  }

  /** 全文を差し替えて、すぐに見せる（安全のための差し替えなど） */
  replace(text: string) {
    if (this.settled) return;
    this.target = text;
    this.shown = text.length;
    this.onUpdate(text);
    this.maybeFinish();
  }

  /** 全文を書き直す（日本語以外が混ざって作り直したときなど）。同じところまではそのまま、違うところから打ち直す */
  rewrite(text: string) {
    if (this.settled) return;
    let same = 0;
    const limit = Math.min(this.shown, text.length);
    while (same < limit && this.target[same] === text[same]) same++;
    this.target = text;
    this.shown = same;
    this.onUpdate(text.slice(0, same));
    this.kick();
    this.maybeFinish();
  }

  /** これ以上は届かない。見せ終えたら done が解決する */
  end() {
    this.ended = true;
    this.kick();
    this.maybeFinish();
  }

  /** 残りを一気に見せる（返答をタップしたときなど） */
  flush() {
    if (this.settled) return;
    if (this.shown < this.target.length) {
      this.shown = this.target.length;
      this.onUpdate(this.target);
    }
    this.maybeFinish();
  }

  /** 途中でやめる（エラーや画面を離れたとき）。done は解決する */
  cancel() {
    this.stop();
    this.settle();
  }

  /** まだ見せていない文字があるか */
  get pending(): boolean {
    return this.shown < this.target.length;
  }

  private kick() {
    if (this.timer !== null || this.settled || !this.pending) return;
    this.last = this.clock.now();
    this.tick();
  }

  private tick = () => {
    this.timer = null;
    const now = this.clock.now();
    this.budget += now - this.last;
    this.last = now;
    const before = this.shown;
    while (this.shown < this.target.length) {
      const cost = costOf(this.target, this.shown);
      if (this.budget < cost) break;
      this.budget -= cost;
      this.shown += 1;
      // 絵文字などのサロゲートペアは途中で切らない
      const code = this.target.charCodeAt(this.shown - 1);
      if (code >= 0xd800 && code <= 0xdbff && this.shown < this.target.length) this.shown += 1;
    }
    if (this.shown !== before) this.onUpdate(this.target.slice(0, this.shown));
    if (this.pending) {
      this.timer = this.clock.setTimer(this.tick, TICK_MS);
    } else {
      // 届くのを待つあいだに時間を貯めない（次に届いた瞬間に一気に出さないため）
      this.budget = 0;
      this.maybeFinish();
    }
  };

  private maybeFinish() {
    if (this.ended && !this.pending) {
      this.stop();
      this.settle();
    }
  }

  private stop() {
    if (this.timer !== null) this.clock.clearTimer(this.timer);
    this.timer = null;
  }

  private settle() {
    if (this.settled) return;
    this.settled = true;
    this.resolveDone();
  }
}
