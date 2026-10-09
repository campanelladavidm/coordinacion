import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  return <button className={`button ${variant === "primary" ? "button-primary " : ""}${className}`} {...props} />;
}
