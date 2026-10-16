"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Diálogo partilhado (Radix): focus trap, Esc, scroll-lock, scrim 50% e
 * animação de 220ms a entrar / 150ms a sair.
 *
 * variant="center" → cartão centrado.
 * variant="sheet"  → bottom sheet no telemóvel, cartão centrado a partir de sm.
 *
 * O cartão fica dentro de um wrapper flex (e não com translate -50%) para a
 * animação de zoom não lutar com o transform de centragem.
 */

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

type ContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  variant?: "center" | "sheet";
  /** Botão X no canto (44×44). Default: true */
  showClose?: boolean;
  /** Pega de arrastar no topo da bottom sheet. Default: true */
  showHandle?: boolean;
  overlayClassName?: string;
};

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, ContentProps>(
  ({ className, children, variant = "center", showClose = true, showHandle = true, overlayClassName, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/50",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-base",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast",
          overlayClassName,
        )}
      />
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-50 flex justify-center",
          variant === "sheet" ? "items-end sm:items-center sm:p-4" : "items-center p-4",
        )}
      >
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "pointer-events-auto relative w-full bg-surface shadow-xl focus:outline-none overflow-y-auto",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-base data-[state=open]:ease-out-expo",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast",
            variant === "sheet"
              ? [
                  "max-h-[90vh] rounded-t-3xl px-5 pt-5 pb-sheet sm:max-w-lg sm:rounded-2xl sm:p-6",
                  "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full",
                  "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95",
                  "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-95",
                ]
              : [
                  "max-h-[90vh] max-w-md rounded-2xl p-6",
                  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
                ],
            className,
          )}
          {...props}
        >
          {variant === "sheet" && showHandle && (
            <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
          )}
          {children}
          {showClose && (
            <DialogPrimitive.Close
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Fechar"
            >
              <X size={18} />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  ),
);
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1 pr-8", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex gap-2", className)} {...props} />;
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-bold text-gray-900 leading-snug", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-gray-500 leading-relaxed", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
