import type { Article } from "@/lib/blog";
import downloadNashiAiChat from "./download-nashi-ai-chat";
import oshiToHanaseruApp from "./oshi-to-hanaseru-app";
import yumeShosetsuAi from "./yume-shosetsu-ai";
import zetaHikkoshi from "./zeta-hikkoshi";
import zetaNenrei from "./zeta-nenrei";
import zetaNitaAppErabikata from "./zeta-nita-app-erabikata";
import zetaRyokin from "./zeta-ryokin";

/** 読みものの記事。新しい記事は、ファイルを足してここに並べる */
export const ARTICLES: Article[] = [zetaHikkoshi, downloadNashiAiChat, oshiToHanaseruApp, zetaRyokin, zetaNenrei, zetaNitaAppErabikata, yumeShosetsuAi];
