"use client";

import { forwardRef } from "react";
import type { ReactNode, ButtonHTMLAttributes } from "react";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary:
    "border bg-[color:var(--t4-pink)] text-black hover:brightness-110 [border-color:var(--t4-pink)] shadow-[0_0_12px_var(--t4-pink)]",
  secondary:
    "border bg-transparent text-[color:var(--t4-mp)] hover:bg-[color:rgba(90,168,255,0.08)] [border-color:var(--t4-mp)]",
  danger:
    "border bg-[color:var(--t4-hp)] text-black hover:brightness-110 [border-color:var(--t4-hp)] shadow-[0_0_12px_var(--t4-hp)]",
  ghost:
    "border border-transparent bg-transparent text-[color:var(--t4-dim)] hover:text-[color:var(--t4-ink)] hover:[border-color:var(--t4-line)]",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "h-8 px-3 text-[10px] gap-1.5 font-pixel uppercase tracking-[1.5px]",
  md: "h-9 px-4 text-[10px] gap-2 font-pixel uppercase tracking-[1.5px]",
  lg: "h-11 px-5 text-[11px] gap-2.5 font-pixel uppercase tracking-[2px]",
};

const ICON_SIZE: Record<string, string> = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

const ICON_ONLY_SIZE: Record<string, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-9 w-9 rounded-md",
  lg: "h-11 w-11 rounded-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", icon, loading, disabled, children, className = "", ...rest }, ref) => {
    const isDisabled = disabled || loading;
    const iconOnly = !children && (icon || loading);

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center whitespace-nowrap font-semibold leading-none transition-colors
          ${VARIANT_CLASSES[variant]}
          ${iconOnly ? ICON_ONLY_SIZE[size] : SIZE_CLASSES[size]}
          ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${className}
        `.trim().replace(/\s+/g, " ")}
        {...rest}
      >
        {loading ? (
          <span
            className={`${ICON_SIZE[size]} shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent`}
          />
        ) : icon ? (
          <span
            className={`${ICON_SIZE[size]} shrink-0 inline-flex items-center justify-center [&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:stroke-[2.25]`}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        {children && <span className="leading-none">{children}</span>}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
