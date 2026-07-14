"use client";

/**
 * Motion system — all Framer Motion usage flows through these wrappers so the
 * motion language stays consistent and prefers-reduced-motion is honoured in
 * one place (MotionConfig reducedMotion="user").
 *
 * Rules (build brief §6): springs for interaction, gentle enters, shorter
 * exits (~65% of enter), 150–350ms durations, interruptible, stagger 30–50ms.
 */

import * as React from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from "framer-motion";

export { AnimatePresence, motion };

// Shared easings / durations
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const DUR = { fast: 0.15, base: 0.22, slow: 0.32 };
export const SPRING = { type: "spring" as const, stiffness: 380, damping: 30 };
export const SPRING_SOFT = { type: "spring" as const, stiffness: 260, damping: 28 };

/** App-level wrapper: honours prefers-reduced-motion for every child. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

// ───────────────────────── Page / view transitions ─────────────────────────

/** Route/view enter: subtle fade + small vertical offset. */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: DUR.fast } }}
      transition={{ duration: DUR.base, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Generic fade-in with optional delay/offset. */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 6,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: DUR.fast } }}
      transition={{ duration: DUR.base, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ───────────────────────────── List stagger ─────────────────────────────

const staggerContainer = {
  hidden: {},
  show: (stagger: number = 0.04) => ({
    transition: { staggerChildren: stagger, delayChildren: 0.02 },
  }),
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE_OUT },
  },
};

/** Parent for staggered lists/grids (30–50ms per item). */
export function Stagger({
  children,
  className,
  stagger = 0.04,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      custom={stagger}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** Child of <Stagger>. */
export function StaggerItem({
  children,
  className,
  ...rest
}: { children: React.ReactNode; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div className={className} variants={staggerItem} {...rest}>
      {children}
    </motion.div>
  );
}

// ─────────────────────────── Press feedback ───────────────────────────

/** Subtle press scale for buttons/cards (0.97 on press). */
export function Pressable({
  children,
  className,
  scale = 0.97,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  scale?: number;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      whileTap={{ scale }}
      transition={SPRING}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ───────────────────────────── KPI count-up ─────────────────────────────

/** Animated count-up for KPI cards. Formats with locale separators. */
export function CountUp({
  value,
  className,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 0.9,
}: {
  value: number;
  className?: string;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const springValue = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(springValue, (v) =>
    `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`
  );

  React.useEffect(() => {
    if (!inView) return;
    if (reduced) {
      springValue.jump(value);
    } else {
      mv.set(value);
    }
  }, [inView, value, reduced, mv, springValue]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

// ─────────────────────── Skeleton→content crossfade ───────────────────────

/** Crossfades between a skeleton and loaded content. */
export function SkeletonSwap({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} style={{ position: "relative" }}>
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: DUR.fast } }}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DUR.base, ease: EASE_OUT }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────── Collapse / expand ─────────────────────────

/** Smooth height collapse for sidebar groups, accordions, expandable rows. */
export function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className={className}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: DUR.fast } }}
          transition={{ duration: DUR.base, ease: EASE_OUT }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Pulse dot — notification bell / live indicators. */
export function PulseDot({ className }: { className?: string }) {
  return (
    <span className={className} style={{ position: "relative", display: "inline-flex" }}>
      <motion.span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          background: "currentColor",
        }}
        animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
      />
      <span
        style={{
          position: "relative",
          display: "inline-block",
          width: "100%",
          height: "100%",
          borderRadius: "9999px",
          background: "currentColor",
        }}
      />
    </span>
  );
}
