import type { ComponentTestRenderSpec } from "@/lib/testing/spec";

export function mountComponentTestSpec(
  container: HTMLElement,
  spec: ComponentTestRenderSpec,
) {
  container.replaceChildren(createComponentTestElement(spec));

  return () => {
    container.replaceChildren();
  };
}

function createComponentTestElement(spec: ComponentTestRenderSpec) {
  const element = document.createElement(spec.tagName);

  for (const [name, value] of Object.entries(spec.attributes)) {
    if (value === true) {
      element.setAttribute(name, "");
      continue;
    }

    element.setAttribute(name, value);
  }

  element.innerHTML = spec.innerHTML;
  return element;
}
