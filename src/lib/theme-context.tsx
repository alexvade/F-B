"use client";

import { createContext, useContext } from "react";

// Exposes the dark-mode flag (see NavShell) to components that need to
// pick an explicit colour rather than rely on the ambient filter:invert(1)
// — e.g. the cocktail glass SVGs, which stay immune to the invert so their
// liquid colour reads true, but therefore need their own outline colour.
export const ThemeContext = createContext<{ dark: boolean }>({ dark: false });

export const useTheme = () => useContext(ThemeContext);
