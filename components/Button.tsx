import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonBaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

interface ButtonAsButton extends ButtonBaseProps, ButtonHTMLAttributes<HTMLButtonElement> {
  href?: undefined;
}

interface ButtonAsLink extends ButtonBaseProps, AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
  secondary:
    "bg-white text-blue-600 border border-blue-600 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
  outline:
    "bg-transparent text-white border border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  href,
  children,
  ...props
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center rounded-md font-semibold transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  if (href !== undefined) {
    return (
      <Link href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
