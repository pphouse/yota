import type { Article } from "@/lib/blog";
import zetaToppatsuEvent from "./zeta-toppatsu-event";
import zetaLiveChat from "./zeta-live-chat";
import zetaSumahoNozoku from "./zeta-sumaho-nozoku";
import zetaUraSettei from "./zeta-ura-settei";
import zetaFuonBug from "./zeta-fuon-bug";
import zetaBugMatome from "./zeta-bug-matome";
import zetaKaiwaMirareru from "./zeta-kaiwa-mirareru";
import zetaKioku from "./zeta-kioku";
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
import zetaVisualNovel from "./zeta-visual-novel";
import zetaSeitekiKaiwa from "./zeta-seiteki-kaiwa";
import zetaPlotSakujo from "./zeta-plot-sakujo";
import zetaNitaAppErabikata from "./zeta-nita-app-erabikata";
import zetaRyokin from "./zeta-ryokin";

/** 読みものの記事。新しい記事は、ファイルを足してここに並べる */
export const ARTICLES: Article[] = [zetaToppatsuEvent, zetaLiveChat, zetaSumahoNozoku, zetaUraSettei, zetaFuonBug, zetaBugMatome, zetaKaiwaMirareru, zetaKioku, zetaSeitekiKaiwa, zetaVisualNovel, zetaPlotSakujo, aiKareshiApp, zetaKutoutenBug, joseiMukeAiRenaiApp, zetaHikkoshi, aiChatNovel, downloadTourokuFuyou, oshiToHanaseruApp, zetaChachaCharapuHikaku, zetaRyokin, zetaNenrei, zetaNitaAppErabikata, yumeShosetsuAi];
