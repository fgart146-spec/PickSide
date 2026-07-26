import Link from "next/link";
import { COMMUNITY_BOARDS, BOARD_LABEL } from "@/lib/community-boards";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BOARD_DESCRIPTION: Record<string, string> = {
  free: "자유롭게 아무 이야기나 나눠보세요.",
  humor: "웃긴 이야기와 짤을 공유해보세요.",
  question: "고민이나 궁금한 걸 물어보세요.",
  balance_suggestion: "새로운 밸런스 게임 주제를 제안해보세요.",
};

export default function CommunityPage() {
  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">커뮤니티</h1>
        <div className="flex flex-col gap-3">
          {COMMUNITY_BOARDS.map((board) => (
            <Link key={board} href={`/community/${board}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="text-base">{BOARD_LABEL[board]}</CardTitle>
                  <CardDescription>{BOARD_DESCRIPTION[board]}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
