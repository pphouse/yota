import { Suspense } from "react";
import { ChatScreen } from "@/components/ChatScreen";
import { PLOTS } from "@/lib/characters";

export function generateStaticParams() {
  return PLOTS.map((p) => ({ plotId: p.id }));
}

export default function ChatPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-xl px-5 py-16 text-sm text-mist">物語を開いています</p>}>
      <ChatScreen />
    </Suspense>
  );
}
