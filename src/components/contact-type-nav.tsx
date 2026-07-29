import Link from "next/link";
import { MessageSquareIcon, BugIcon, MegaphoneIcon, HandshakeIcon } from "lucide-react";
import { INQUIRY_TYPES, INQUIRY_TYPE_LABEL, INQUIRY_TYPE_DESCRIPTION, type InquiryType } from "@/lib/inquiries";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TYPE_ICON: Record<InquiryType, typeof MessageSquareIcon> = {
  general: MessageSquareIcon,
  bug: BugIcon,
  ad: MegaphoneIcon,
  partnership: HandshakeIcon,
};

export function ContactTypeNav({
  activeType,
  enabledTypes,
}: {
  activeType: InquiryType | null;
  enabledTypes: InquiryType[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {INQUIRY_TYPES.filter((t) => enabledTypes.includes(t)).map((type) => {
        const Icon = TYPE_ICON[type];
        const active = type === activeType;
        return (
          <Link key={type} href={`/contact?type=${type}`}>
            <Card
              className={`transition-colors hover:bg-accent ${active ? "border-primary/50 bg-primary/5" : ""}`}
            >
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <Icon className={`size-5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <CardTitle className="text-sm">{INQUIRY_TYPE_LABEL[type]}</CardTitle>
                  <CardDescription className="text-xs">
                    {INQUIRY_TYPE_DESCRIPTION[type]}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
