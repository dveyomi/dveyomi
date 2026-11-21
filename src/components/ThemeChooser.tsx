"use client";

import { useState } from "react";
import { RadioSegments } from "@/components/ui";
import { applyTheme, type Theme } from "@/lib/theme";

const options: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match device" },
];

/** Light / Dark / Match device. Applies at once and remembers the choice in the `theme` cookie. */
export function ThemeChooser({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);
  return (
    <RadioSegments
      label="Theme"
      options={options}
      value={theme}
      onChange={(next) => {
        setTheme(next);
        applyTheme(next);
      }}
    />
  );
}
