import {
  createContactChannel,
  updateContactChannel,
  deleteContactChannel,
} from "@/app/admin/contact-settings/actions";
import { AdminContactChannelForm } from "@/components/admin-contact-channel-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ContactChannelIconView } from "@/components/contact-channel-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Channel = {
  id: string;
  name: string;
  button_label: string;
  description: string | null;
  url: string;
  icon: string;
  is_visible: boolean;
  open_new_tab: boolean;
  sort_order: number;
};

export function AdminContactChannelsSection({ channels }: { channels: Channel[] }) {
  return (
    <div className="flex flex-col gap-3">
      {channels.map((channel) => (
        <Card key={channel.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <ContactChannelIconView icon={channel.icon} className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">{channel.name}</CardTitle>
              {!channel.is_visible && <Badge variant="secondary">숨김</Badge>}
            </div>
            <form action={deleteContactChannel.bind(null, channel.id)}>
              <ConfirmSubmitButton
                size="sm"
                variant="ghost"
                confirmMessage={`"${channel.name}" 채널을 삭제할까요?`}
              >
                삭제
              </ConfirmSubmitButton>
            </form>
          </CardHeader>
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">수정</summary>
              <div className="mt-3">
                <AdminContactChannelForm
                  action={updateContactChannel.bind(null, channel.id)}
                  submitLabel="수정 사항 저장"
                  defaults={{
                    name: channel.name,
                    buttonLabel: channel.button_label,
                    description: channel.description ?? "",
                    url: channel.url,
                    icon: channel.icon,
                    isVisible: channel.is_visible,
                    openNewTab: channel.open_new_tab,
                    sortOrder: channel.sort_order,
                  }}
                />
              </div>
            </details>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">새 문의 채널 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminContactChannelForm
            action={createContactChannel}
            submitLabel="채널 추가"
            resetOnSuccess
            defaults={{
              name: "",
              buttonLabel: "",
              description: "",
              url: "",
              icon: "link",
              isVisible: true,
              openNewTab: true,
              sortOrder: channels.length,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
