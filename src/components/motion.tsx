"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import type { ReactNode } from "react";

import { fadeOnly, fadeUp, faceReveal, stagger } from "@/lib/motion";

export { AnimatePresence, motion, useReducedMotion };

type StaggerProps = {
  children: ReactNode;
  className?: string;
};

/** Occasional list entrance — prevents grid teleport; no nav usage. */
export function Stagger({ children, className }: StaggerProps) {
  const reduce = useReducedMotion();
  return (
    <motion.ul
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduce ? 0 : stagger,
          },
        },
      }}
    >
      {children}
    </motion.ul>
  );
}

type FadeItemProps = {
  children: ReactNode;
  className?: string;
};

export function FadeItem({ children, className }: FadeItemProps) {
  const reduce = useReducedMotion();
  return (
    <motion.li className={className} variants={fadeUp(reduce)}>
      {children}
    </motion.li>
  );
}

type FaceInProps = {
  children: ReactNode;
  className?: string;
  motionKey?: string;
};

/** Rare face lock / reveal — opacity + subtle scale, never scale(0). */
export function FaceIn({ motionKey, children, className }: FaceInProps) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={motionKey}
        className={className}
        initial="hidden"
        animate="show"
        exit="exit"
        variants={faceReveal(reduce)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

type PresenceFadeProps = {
  show: boolean;
  children: ReactNode;
  className?: string;
};

/** Feedback / state — reply bubbles, status swaps. */
export function PresenceFade({ show, children, className }: PresenceFadeProps) {
  const reduce = useReducedMotion();
  const variants = reduce ? fadeOnly() : fadeUp(false);
  return (
    <AnimatePresence mode="wait">
      {show ? (
        <motion.div
          className={className}
          initial="hidden"
          animate="show"
          exit="exit"
          variants={variants}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
