import { Medal } from "lucide-react";
import { AppPageSkeleton, CardListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppPageSkeleton title="Conquistas" icon={<Medal size={20} />} back={{ href: "/perfil", label: "Início" }}>
      <CardListSkeleton count={4} />
    </AppPageSkeleton>
  );
}
