import { ImageResponse } from "next/og";
import { getUgc } from "@/lib/ugc";
import { getXResult } from "@/lib/x-store";

export const alt = "Xから生まれる彼";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 使う文字だけを含む Noto Sans JP を Google Fonts から取る（画像の中の日本語用） */
async function loadFonts(text: string): Promise<{ name: string; data: ArrayBuffer; weight: 700 | 900 }[]> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700;900&text=${encodeURIComponent(text)}`)).text();
    const faces = [...css.matchAll(/font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/g)];
    return await Promise.all(
      faces.map(async ([, weight, url]) => ({ name: "Noto Sans JP", data: await (await fetch(url)).arrayBuffer(), weight: Number(weight) as 700 | 900 })),
    );
  } catch {
    return [];
  }
}

/** シェアされたときのカード：タイプ・ツッコミ・生まれた彼の名前 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const result = await getXResult((await params).id);
  const plot = result?.status === "ready" && result.data.plotId ? (await getUgc(result.data.plotId))?.plot : undefined;
  const he = plot?.personas[0];
  const type = result?.data.type ?? "";
  const roasts = (result?.data.roasts ?? []).slice(0, 2);
  const lines = {
    head: result ? `@${result.handle} のX診断` : "Xから生まれる彼",
    type: type ? `「${type}」` : "あなたのXから、彼をつくる。",
    footer: he ? `あなたのXから生まれた彼：${he.name}` : "Xの投稿から、あなたに刺さる彼をAIがつくります",
  };
  const fonts = await loadFonts(`${Object.values(lines).join("")}${roasts.join("")}yotachat.app/x…「」`);
  const color = he?.color ?? "#c3a6ff";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: `linear-gradient(135deg, #15111f 0%, #1d1530 60%, ${color}55 100%)`,
          color: "#f6f2ff",
          fontFamily: "Noto Sans JP",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#ff8fb1" }}>{lines.head}</div>
          <div style={{ fontSize: type.length > 10 ? 64 : 76, fontWeight: 900, marginTop: 10, lineHeight: 1.2 }}>{lines.type}</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 22, gap: 14 }}>
            {roasts.map((r) => (
              <div key={r} style={{ display: "flex", fontSize: 30, fontWeight: 700, lineHeight: 1.45, background: "#ffffff14", borderRadius: 22, padding: "14px 22px", maxWidth: 1040 }}>
                {r.length > 46 ? `${r.slice(0, 45)}…` : r}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color }}>{lines.footer}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#b9b2cc" }}>yotachat.app/x</div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
