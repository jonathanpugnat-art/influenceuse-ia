"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  ChartBar,
  ChatCircle,
  Check,
  Copy,
  DownloadSimple,
  Image,
  Play,
  Plus,
  Sparkle,
  TrendUp,
  Users,
  X,
  type Icon,
} from "@phosphor-icons/react";

export type IconProps = {
  size?: number;
  className?: string;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  /** Kept for call-site compat; Phosphor uses `weight` instead. */
  strokeWidth?: number;
};

const WEIGHT = "light" as const;

function phosphor(
  Icon: Icon,
  { size = 20, className, weight = WEIGHT }: IconProps,
  forced?: IconProps["weight"],
) {
  return (
    <Icon
      size={size}
      weight={forced ?? weight}
      className={className}
      aria-hidden
      focusable={false}
    />
  );
}

export function IconFaces(props: IconProps) {
  return phosphor(Users, props);
}

export function IconTrend(props: IconProps) {
  return phosphor(TrendUp, props);
}

export function IconSpark(props: IconProps) {
  return phosphor(Sparkle, props);
}

export function IconChat(props: IconProps) {
  return phosphor(ChatCircle, props);
}

export function IconChart(props: IconProps) {
  return phosphor(ChartBar, props);
}

export function IconPlus(props: IconProps) {
  return phosphor(Plus, props);
}

export function IconDownload(props: IconProps) {
  return phosphor(DownloadSimple, props);
}

export function IconCopy(props: IconProps) {
  return phosphor(Copy, props);
}

export function IconCheck(props: IconProps) {
  const weight = props.strokeWidth && props.strokeWidth > 2 ? "bold" : props.weight;
  return phosphor(Check, { ...props, weight });
}

export function IconArrowLeft(props: IconProps) {
  return phosphor(ArrowLeft, props);
}

export function IconArrowRight(props: IconProps) {
  return phosphor(ArrowRight, props);
}

export function IconExternal(props: IconProps) {
  return phosphor(ArrowSquareOut, props);
}

export function IconPlay(props: IconProps) {
  return phosphor(Play, props, "fill");
}

export function IconClose(props: IconProps) {
  return phosphor(X, props);
}

export function IconImage(props: IconProps) {
  return phosphor(Image, props);
}
