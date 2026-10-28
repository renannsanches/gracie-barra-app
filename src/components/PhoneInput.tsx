"use client";

import * as React from "react";
import PhoneInputBase, { isValidPhoneNumber, type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  defaultCountry?: Country;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = "PT",
  disabled,
  placeholder = "Número de telefone",
  id,
  className,
}: PhoneInputProps) {
  return (
    <div className={cn("gb-phone-input", className)}>
      <PhoneInputBase
        id={id}
        international
        countryCallingCodeEditable={false}
        defaultCountry={defaultCountry}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        numberInputProps={{
          className:
            "flex h-11 w-full rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gb-blue focus-visible:border-gb-blue disabled:cursor-not-allowed disabled:opacity-50",
        }}
      />
    </div>
  );
}

export { isValidPhoneNumber };
