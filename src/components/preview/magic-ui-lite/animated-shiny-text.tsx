import { cn } from "@/lib/utils";

type AnimatedShinyTextProps = {
  children: React.ReactNode;
  className?: string;
};

export function AnimatedShinyText({ children, className }: AnimatedShinyTextProps) {
  return (
    <span
      className={cn(
        "inline-block animate-[shiny-text_3s_ease-in-out_infinite] bg-[length:200%_auto] bg-clip-text text-transparent",
        "bg-[linear-gradient(110deg,oklch(0.85_0.08_50),oklch(0.95_0_0)_45%,oklch(0.78_0.12_290)_55%,oklch(0.75_0.06_240)_70%,oklch(0.85_0.08_50))]",
        className,
      )}
    >
      {children}
    </span>
  );
}
