"use client";

import { type ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type ConfirmSubmitButtonProps = ComponentProps<typeof Button> & {
  confirmMessage: string;
};

/**
 * A submit button that asks for confirmation before letting its parent
 * <form action={serverAction}> submit. Cancelling blocks the submit.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  type = "submit",
  ...props
}: ConfirmSubmitButtonProps) {
  return (
    <Button
      type={type}
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
