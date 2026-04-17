"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Contact } from "@/lib/types/database";

export type ContactViewMode = "hidden" | "sidebar" | "fullscreen";

interface ContactPanelState {
  contact: Contact | null;
  viewMode: ContactViewMode;
  width: number;
  openContact: (c: Contact, mode?: ContactViewMode) => void;
  closeContact: () => void;
  setViewMode: (mode: ContactViewMode) => void;
  setWidth: (w: number) => void;
}

const ContactPanelContext = createContext<ContactPanelState>({
  contact: null,
  viewMode: "hidden",
  width: 420,
  openContact: () => {},
  closeContact: () => {},
  setViewMode: () => {},
  setWidth: () => {},
});

export function useContactPanel() {
  return useContext(ContactPanelContext);
}

export function ContactPanelProvider({ children }: { children: ReactNode }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<ContactViewMode>("hidden");
  const [width, setWidth] = useState(420);

  const openContact = useCallback((c: Contact, mode: ContactViewMode = "sidebar") => {
    setContact(c);
    setViewMode(mode);
  }, []);

  const closeContact = useCallback(() => {
    setViewMode("hidden");
    // Keep contact in state briefly for close animation
    setTimeout(() => setContact(null), 300);
  }, []);

  return (
    <ContactPanelContext.Provider value={{ contact, viewMode, width, openContact, closeContact, setViewMode, setWidth }}>
      {children}
    </ContactPanelContext.Provider>
  );
}
