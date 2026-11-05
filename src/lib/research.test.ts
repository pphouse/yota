import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./db";
import { deleteDataset, getDatasetJson, listDatasets, ResearchData, saveDataset, slim } from "./research";
import { renderResearchViewer } from "./research-viewer";

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yota-research-"));
  resetDbForTests(`file:${path.join(dir, "test.db")}`);
});

const sample = ResearchData.parse({
  generated_at: "2026-10-31T12:31:12+00:00",
  accounts: [
    {
      handle: "a",
      name: "A",
      avatar: "data:image/jpeg;base64,AAAA",
      avatar_url: "https://pbs.twimg.com/profile_images/1/a_200x200.jpg",
      posts: [
        { url: "https://x.com/a/status/1", text: "zeta の広告が多い </script><script>alert(1)</script>", views: 1200 },
        { url: "https://x.com/a/status/2", text: "chacha に移った", views: 300 },
      ],
    },
    { handle: "b", posts: [{ url: "https://x.com/b/status/3", text: "zeta 楽しい" }] },
  ],
});

describe("調査データ", () => {
  it("埋め込んだアイコン画像は URL に置きかえて保存し、件数と表示回数を数える", async () => {
    expect(slim(sample).accounts[0].avatar).toBe("https://pbs.twimg.com/profile_images/1/a_200x200.jpg");
    const meta = await saveDataset("zeta X調査", sample);
    expect(meta).toMatchObject({ title: "zeta X調査", accounts: 2, posts: 3, views: 1500, collectedAt: "2026-10-31T12:31:12+00:00" });
    expect((await listDatasets()).map((d) => d.id)).toEqual([meta.id]);
    const got = await getDatasetJson(meta.id);
    expect(got?.json).not.toContain("data:image");
    await deleteDataset(meta.id);
    expect(await listDatasets()).toEqual([]);
    expect(await getDatasetJson(meta.id)).toBeNull();
  });

  it("accounts がない JSON は受け付けない", () => {
    expect(ResearchData.safeParse({ accounts: [] }).success).toBe(false);
    expect(ResearchData.safeParse({ foo: 1 }).success).toBe(false);
  });

  it("ビューワーは、投稿の中の </script> で閉じられないようにデータを埋め込む", async () => {
    const meta = await saveDataset("<b>題名</b>", sample);
    const html = renderResearchViewer(meta.title, (await getDatasetJson(meta.id))!.json);
    expect(html).toContain("<title>&lt;b&gt;題名&lt;/b&gt;</title>");
    // 詳細のパネル（hidden）が最初から出ないように
    expect(html).toContain("[hidden]{display:none!important}");
    const data = html.slice(html.indexOf('<script id="zeta-data"'), html.indexOf("</script>", html.indexOf('<script id="zeta-data"')));
    expect(data).toContain("<\\/script>");
    expect(data).toContain("chacha に移った");
  });
});
