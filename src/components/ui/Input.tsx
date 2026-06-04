import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2",
        "text-neutral-100 placeholder:text-neutral-500 outline-none transition",
        "focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
