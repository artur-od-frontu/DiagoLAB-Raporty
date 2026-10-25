"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Pasek nawigacji reagujący na przewijanie.
 * Na samej górze strony jest lekki i półprzezroczysty (hero widać pod spodem),
 * a po rozpoczęciu scrollowania staje się NIEPRZEZROCZYSTY — treść strony
 * nie przebija przez menu i pozostaje ono w pełni czytelne.
 */
export function ScrollAwareBar({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll(); // stan początkowy (np. po odświeżeniu w połowie strony)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      data-scrolled={scrolled ? "true" : "false"}
      className={`transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled ? "nav-solid border-b border-line shadow-panel" : "glass hairline-b"
      }`}
    >
      {children}
    </div>
  );
}
