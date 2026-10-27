import { Images } from "lucide-react";
import { AppPageSkeleton, GridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppPageSkeleton icon={<Images size={20} />} back={{ href: "/perfil?tab=galeria", label: "Galeria" }}>
      <GridSkeleton count={9} />
    </AppPageSkeleton>
  );
}
