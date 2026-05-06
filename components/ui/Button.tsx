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
  primary: "border border-primary-light/70 bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-[var(--neon-border)] bg-surface text-text-secondary hover:bg-primary-muted hover:text-text",
  danger: "bg-danger-bg text-white hover:brightness-90",
  ghost: "border border-transparent bg-transparent text-text-muted hover:border-[var(--neon-border-muted)] hover:bg-surface hover:text-text",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "h-8 px-2.5 text-caption rounded-md gap-1.5",
  md: "h-9 px-3.5 text-body rounded-md gap-2",
  lg: "h-11 px-5 text-title rounded-lg gap-2.5",
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
