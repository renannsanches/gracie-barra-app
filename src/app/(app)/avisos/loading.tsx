import { Megaphone } from "lucide-react";
import { AppPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <AppPageSkeleton title="Avisos" icon={<Megaphone size={20} />} />;
}
