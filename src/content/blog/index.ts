import type { Article } from "@/lib/blog";
import aiChatNovel from "./ai-chat-novel";
import aiKareshiApp from "./ai-kareshi-app";
import downloadTourokuFuyou from "./download-touroku-fuyou";
import joseiMukeAiRenaiApp from "./josei-muke-ai-renai-app";
import oshiToHanaseruApp from "./oshi-to-hanaseru-app";
import zetaChachaCharapuHikaku from "./zeta-chacha-charapu-hikaku";
import yumeShosetsuAi from "./yume-shosetsu-ai";
import zetaHikkoshi from "./zeta-hikkoshi";
import zetaKutoutenBug from "./zeta-kutouten-bug";
import zetaNenrei from "./zeta-nenrei";
import zetaNitaAppErabikata from "./zeta-nita-app-erabikata";
import zetaRyokin from "./zeta-ryokin";

/** 読みものの記事。新しい記事は、ファイルを足してここに並べる */
export const ARTICLES: Article[] = [aiKareshiApp, zetaKutoutenBug, joseiMukeAiRenaiApp, zetaHikkoshi, aiChatNovel, downloadTourokuFuyou, oshiToHanaseruApp, zetaChachaCharapuHikaku, zetaRyokin, zetaNenrei, zetaNitaAppErabikata, yumeShosetsuAi];
