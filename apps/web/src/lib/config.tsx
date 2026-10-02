"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicConfig } from "./types";
import { useApi } from "./use-api";

interface ConfigState {
  config: PublicConfig | undefined;
  error: string | null;
}

const ConfigContext = createContext<ConfigState>({ config: undefined, error: null });

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { data, error } = useApi<PublicConfig>("/api/config");
  return <ConfigContext.Provider value={{ config: data, error }}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
