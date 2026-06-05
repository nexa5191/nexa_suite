import { AssetDetailClient } from "@/components/assets/asset-detail-client";
import { SEED_ASSETS } from "@/lib/assets/assets";

// Pre-render the seed register; user-created assets render on-demand (client
// reads them from localStorage).
export function generateStaticParams() {
  return SEED_ASSETS.map((a) => ({ id: a.id }));
}

export default function Page({ params }: { params: { id: string } }) {
  return <AssetDetailClient assetId={params.id} />;
}
