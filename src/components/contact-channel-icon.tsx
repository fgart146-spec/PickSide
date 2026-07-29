import {
  MessageCircleIcon,
  MailIcon,
  CameraIcon,
  HashIcon,
  GlobeIcon,
  PhoneIcon,
  LinkIcon,
} from "lucide-react";
import type { ContactChannelIcon } from "@/lib/inquiries";

const ICON_MAP: Record<ContactChannelIcon, typeof LinkIcon> = {
  kakao: MessageCircleIcon,
  email: MailIcon,
  instagram: CameraIcon,
  discord: HashIcon,
  naver_talk: GlobeIcon,
  phone: PhoneIcon,
  link: LinkIcon,
};

export function ContactChannelIconView({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = ICON_MAP[icon as ContactChannelIcon] ?? LinkIcon;
  return <Icon className={className} />;
}
