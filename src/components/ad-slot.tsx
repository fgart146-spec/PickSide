import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { isAdSlotKey, AD_SLOT_ASPECT } from "@/lib/ad-slots";

export async function AdSlot({ slot }: { slot: string; className?: string }) {
  if (!isAdSlotKey(slot)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("ad_slots")
    .select("image_path, link_url, is_active")
    .eq("slot_key", slot)
    .single();

  if (!data?.is_active || !data.image_path) return null;

  const imageUrl = supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(data.image_path).data
    .publicUrl;

  // Fixed aspect ratio per slot + object-cover, so the box stays a
  // consistent shape regardless of what the admin uploaded.
  const image = (
    <div className={`relative w-full overflow-hidden rounded-md ${AD_SLOT_ASPECT[slot]}`}>
      <Image src={imageUrl} alt="광고" fill sizes="(max-width: 768px) 100vw, 728px" className="object-cover" />
    </div>
  );

  return data.link_url ? <Link href={data.link_url}>{image}</Link> : image;
}
