"use client";

import { useEffect, useState } from "react";

const words = ["chaos", "sprints", "backlog", "roadmap", "ideas"];

export function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-accent">
      <span key={index} className="inline-block animate-rise">
        {words[index]}
      </span>
      {/* Blinking block cursor — echoes the logo's bar shape */}
      <span className="ml-1.5 inline-block h-[0.72em] w-[0.42em] translate-y-[0.02em] animate-pulse bg-accent align-baseline" />
    </span>
  );
}
