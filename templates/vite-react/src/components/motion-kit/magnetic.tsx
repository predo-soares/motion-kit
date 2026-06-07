import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import "./magnetic-element.ts";

type MotionMagneticElement = HTMLElement & {
  duration: number;
  ease: string;
  strength: number;
};

interface MagneticProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  duration?: number;
  ease?: string;
  strength?: number;
}

const Magnetic = forwardRef<MotionMagneticElement, MagneticProps>(
  (
    {
      children,
      duration = 1,
      ease = "elastic.out(1, 0.3)",
      strength = 1,
      ...props
    },
    forwardedRef,
  ) => {
    const innerRef = useRef<MotionMagneticElement | null>(null);

    useImperativeHandle(forwardedRef, () => innerRef.current!, []);

    useEffect(() => {
      if (!innerRef.current) return;
      innerRef.current.duration = duration;
      innerRef.current.ease = ease;
      innerRef.current.strength = strength;
    }, [duration, ease, strength]);

    return createElement("motion-magnetic", {
      ...props,
      ref: innerRef,
      children,
    });
  },
);

Magnetic.displayName = "Magnetic";

export default Magnetic;
