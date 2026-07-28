"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthState } from "@/app/auth/actions";
import { OAuthButtons } from "@/components/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: AuthState = { error: null };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>회원가입</CardTitle>
          <CardDescription>
            PickSide에서 양자택일 투표를 만들고 참여해보세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OAuthButtons />
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            또는
            <div className="h-px flex-1 bg-border" />
          </div>
        </CardContent>
        <form action={formAction}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">닉네임</Label>
              <Input id="username" name="username" type="text" required minLength={2} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="agree" required className="mt-0.5" />
              <span>
                <Link href="/terms" target="_blank" className="underline underline-offset-4">
                  이용약관
                </Link>
                {" "}및{" "}
                <Link href="/privacy" target="_blank" className="underline underline-offset-4">
                  개인정보처리방침
                </Link>
                에 동의합니다.
              </span>
            </label>
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "가입 중..." : "회원가입"}
            </Button>
            <p className="text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="underline underline-offset-4">
                로그인
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
