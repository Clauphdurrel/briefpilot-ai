"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Menu, X } from "lucide-react";
export function MobileNav() {
  const [open, setOpen] = useState(false),
    button = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="mk-mobile-nav"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="mk-menu-toggle"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="mobile-marketing-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      {open && (
        <nav
          id="mobile-marketing-menu"
          className="mk-mobile-panel"
          aria-label="Navigation mobile"
        >
          {[
            ["/#fonctionnalites", "Fonctionnalités"],
            ["/#fonctionnement", "Fonctionnement"],
            ["/pricing", "Tarifs"],
            ["/login", "Créer mon premier brief"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              prefetch={href === "/login" ? false : undefined}
              onClick={() => setOpen(false)}
              {...(href === "/login"
                ? { "data-marketing-signup": "header" }
                : {})}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
