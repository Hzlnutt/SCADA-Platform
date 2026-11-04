import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Safeguard React DOM reconciliation against browser auto-translate (Google / Brave / Edge Translate)
// which wraps text nodes inside <font> elements and causes removeChild / insertBefore NotFoundError crashes.
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      let wrapper: Node | null = child.parentNode;
      while (wrapper && wrapper.parentNode !== this) {
        wrapper = wrapper.parentNode;
      }
      if (wrapper && wrapper.parentNode === this && wrapper.nodeName === "FONT") {
        return originalRemoveChild.call(this, wrapper) as unknown as T;
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments as any) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      let wrapper: Node | null = referenceNode.parentNode;
      while (wrapper && wrapper.parentNode !== this) {
        wrapper = wrapper.parentNode;
      }
      if (wrapper && wrapper.parentNode === this) {
        return originalInsertBefore.call(this, newNode, wrapper) as T;
      }
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.apply(this, arguments as any) as T;
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
