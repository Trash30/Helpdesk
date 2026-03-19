import React, { createContext, useContext, useState, useCallback } from 'react';

interface ClientPanelContextValue {
  isOpen: boolean;
  clientId: string | null;
  openClientPanel: (id?: string) => void;
  closeClientPanel: () => void;
}

const ClientPanelContext = createContext<ClientPanelContextValue | null>(null);

export function ClientPanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  const openClientPanel = useCallback((id?: string) => {
    setClientId(id ?? null);
    setIsOpen(true);
  }, []);

  const closeClientPanel = useCallback(() => {
    setIsOpen(false);
    setClientId(null);
  }, []);

  return (
    <ClientPanelContext.Provider value={{ isOpen, clientId, openClientPanel, closeClientPanel }}>
      {children}
    </ClientPanelContext.Provider>
  );
}

export function useClientPanel() {
  const ctx = useContext(ClientPanelContext);
  if (!ctx) throw new Error('useClientPanel must be used within ClientPanelProvider');
  return ctx;
}
