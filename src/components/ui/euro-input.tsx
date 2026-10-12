"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type EuroInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">;

/** Campo de valor em euros: aceita "49,60" ou "49.60", com o símbolo € à direita. */
const EuroInput = React.forwardRef<HTMLInputElement, EuroInputProps>(({ className, ...props }, ref) => (
  <div className="relative">
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn(
        "flex h-10 w-full rounded-xl border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-900 tabular-nums",
        "placeholder:text-gray-400 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gb-blue focus-visible:border-gb-blue",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-400",
        className,
      )}
      {...props}
    />
    <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
      €
    </span>
  </div>
));
EuroInput.displayName = "EuroInput";

export { EuroInput };
