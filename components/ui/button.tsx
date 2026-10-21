import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 min-h-10",
  {
    variants: {
      variant: {
        default: "bg-ocean-700 text-white hover:bg-ocean-800",
        teal: "bg-teal-600 text-white hover:bg-teal-700",
        coral: "bg-coral-500 text-white hover:bg-coral-600",
        outline: "border border-border bg-white text-ocean-800 hover:bg-ocean-50",
        ghost: "text-ocean-800 hover:bg-ocean-50",
        danger: "bg-red-700 text-white hover:bg-red-800",
        link: "text-ocean-700 underline hover:text-ocean-900 min-h-0 px-0",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
