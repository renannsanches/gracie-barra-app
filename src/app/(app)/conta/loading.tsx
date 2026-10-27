import { Settings } from "lucide-react";
import { AppPageSkeleton, CardListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppPageSkeleton title="Minha conta" icon={<Settings size={20} />} back={{ href: "/perfil", label: "Início" }}>
      <CardListSkeleton count={4} />
    </AppPageSkeleton>
  );
}
