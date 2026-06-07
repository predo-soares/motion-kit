import { mountComponentTestSpec } from "@/lib/testing/dom";
import type { ComponentTestRenderSpec } from "@/lib/testing/spec";
import { useEffect, useRef } from "react";

interface FrameworkHostReactProps {
  spec: ComponentTestRenderSpec;
}

export default function FrameworkHostReact({
  spec,
}: FrameworkHostReactProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mountComponentTestSpec(ref.current, spec);
  }, [spec]);

  return <div ref={ref} className="flex h-full w-full items-center justify-center" />;
}
