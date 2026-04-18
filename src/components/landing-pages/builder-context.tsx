"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface BrandAsset {
  type: string;
  url: string;
  name: string;
}

interface LandingPageBuilderState {
  active: boolean;
  pageId: string;
  slug: string;
  html: string;
  brandAssets: BrandAsset[];
}

interface LandingPageBuilderContextValue {
  state: LandingPageBuilderState;
  /** Called by the Workflows builder to open a session */
  open: (pageId: string, slug: string, html: string, brandAssets: BrandAsset[]) => void;
  /** Called by the Workflows builder when it unmounts */
  close: () => void;
  /** Called by the agent sidebar after AI generates HTML */
  setHtml: (html: string) => void;
  /** Called by the Workflows builder when slug changes */
  setSlug: (slug: string) => void;
  /** Called by the Workflows builder when brand assets change */
  setBrandAssets: (assets: BrandAsset[]) => void;
  /** Called by the Workflows builder when page is saved and gets an ID */
  setPageId: (id: string) => void;
}

const defaultState: LandingPageBuilderState = {
  active: false,
  pageId: "",
  slug: "",
  html: "",
  brandAssets: [],
};

const LandingPageBuilderContext = createContext<LandingPageBuilderContextValue>({
  state: defaultState,
  open: () => {},
  close: () => {},
  setHtml: () => {},
  setSlug: () => {},
  setBrandAssets: () => {},
  setPageId: () => {},
});

export function LandingPageBuilderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LandingPageBuilderState>(defaultState);

  const open = useCallback((pageId: string, slug: string, html: string, brandAssets: BrandAsset[]) => {
    setState({ active: true, pageId, slug, html, brandAssets });
  }, []);

  const close = useCallback(() => {
    setState(defaultState);
  }, []);

  const setHtml = useCallback((html: string) => {
    setState((prev) => ({ ...prev, html }));
  }, []);

  const setSlug = useCallback((slug: string) => {
    setState((prev) => ({ ...prev, slug }));
  }, []);

  const setBrandAssets = useCallback((brandAssets: BrandAsset[]) => {
    setState((prev) => ({ ...prev, brandAssets }));
  }, []);

  const setPageId = useCallback((pageId: string) => {
    setState((prev) => ({ ...prev, pageId }));
  }, []);

  return (
    <LandingPageBuilderContext.Provider value={{ state, open, close, setHtml, setSlug, setBrandAssets, setPageId }}>
      {children}
    </LandingPageBuilderContext.Provider>
  );
}

export function useLandingPageBuilder() {
  return useContext(LandingPageBuilderContext);
}
