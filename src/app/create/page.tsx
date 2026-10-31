import type { Metadata } from "next";
import { CreatePlot } from "@/components/CreatePlot";

export const metadata: Metadata = { title: "作品をつくる — yota" };

export default function CreatePage() {
  return <CreatePlot />;
}
