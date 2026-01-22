import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface BlurInProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  as?: React.ElementType;
}

export const BlurIn: React.FC<BlurInProps> = ({
  children,
  delay = 0,
  duration = 0.6,
  className = "",
  as = "div",
  ...props
}) => {
  const Component = motion(as as any);

  return (
    <Component
      initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
};
