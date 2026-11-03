import type { Article } from "@/lib/blog";
import yumeShosetsuAi from "./yume-shosetsu-ai";
import zetaHikkoshi from "./zeta-hikkoshi";
import zetaNenrei from "./zeta-nenrei";
import zetaNitaAppErabikata from "./zeta-nita-app-erabikata";
import zetaRyokin from "./zeta-ryokin";

/** 読みものの記事。新しい記事は、ファイルを足してここに並べる */
export const ARTICLES: Article[] = [zetaHikkoshi, zetaRyokin, zetaNenrei, zetaNitaAppErabikata, yumeShosetsuAi];
