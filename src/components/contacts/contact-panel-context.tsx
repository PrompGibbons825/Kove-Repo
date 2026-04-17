"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Contact } from "@/lib/types/database";

export type ContactViewMode = "hidden" | "sidebar" | "fullscreen";

interface ContactPanelState {
  contact: Contact | null;
  viewMode: ContactViewMode;
  width: number;
  rightOffset: number;
  openContact: (c: Contact, mode?: ContactViewMode) => void;
  closeContact: () => void;
  setViewMode: (mode: ContactViewMode) => void;
  setWidth: (w: number) => void;
  setRightOffset: (offset: number) => void;
  updateContact: (partial: Partial<Contact>) => void;
}

const ContactPanelContext = createContext<ContactPanelState>({
  contact: null,
  viewMode: "hidden",
  width: 420,
  rightOffset: 0,
  openContact: () => {},
  closeContact: () => {},
  setViewMode: () => {},
  setWidth: () => {},
  setRightOffset: () => {},
  updateContact: () => {},
});

export function useContactPanel() {
  return useContext(ContactPanelContext);
}

export function ContactPanelProvider({ children }: { children: ReactNode }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<ContactViewMode>("hidden");
  const [width, setWidth] = useState(420);
  const [rightOffset, setRightOffset] = useState(0);

  const openContact = useCallback((c: Contact, mode: ContactViewMode = "sidebar") => {
    setContact(c);
    setViewMode(mode);
  }, []);

  const closeContact = useCallback(() => {
    setViewMode("hidden");
    setTimeout(() => setContact(null), 300);
  }, []);

  const updateContact = useCallback((partial: Partial<Contact>) => {
    setContact((prev) => prev ? { ...prev, ...partial } : prev);
  }, []);

  return (
    <ContactPanelContext.Provider value={{ contact, viewMode, width, rightOffset, openContact, closeContact, setViewMode, setWidth, setRightOffset, updateContact }}>
      {children}
    </ContactPanelContext.Provider>
  );
}
