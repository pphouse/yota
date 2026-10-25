/**
 * Server-Sent Events を1イベントずつ取り出す。
 * 各イベントの data 行（複数行なら改行で連結）を返す。
 */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = findEventEnd(buffer)) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep).replace(/^(\r?\n){1,2}/, "");
        const data = parseData(raw);
        if (data !== null) yield data;
      }
    }
    buffer += decoder.decode();
    const data = parseData(buffer);
    if (data !== null) yield data;
  } finally {
    reader.releaseLock();
  }
}

function findEventEnd(buffer: string): number {
  const a = buffer.indexOf("\n\n");
  const b = buffer.indexOf("\r\n\r\n");
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function parseData(raw: string): string | null {
  const lines = raw.split(/\r?\n/).filter((l) => l.startsWith("data:"));
  if (lines.length === 0) return null;
  return lines.map((l) => l.slice(5).replace(/^ /, "")).join("\n");
}
