/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

type SessionMemoryContextType = {
  sessionNotes: Record<string, string[]>;
  addSessionNote: (conversationId: string, note: string) => void;
  removeSessionNote: (conversationId: string, index: number) => void;
  clearSessionNotes: (conversationId: string) => void;
};

const SessionMemoryContext = createContext<SessionMemoryContextType | undefined>(undefined);

export const SessionMemoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionNotes, setSessionNotes] = useState<Record<string, string[]>>({});

  const addSessionNote = useCallback((conversationId: string, note: string) => {
    if (!note.trim()) return;
    setSessionNotes((prev) => {
      const current = prev[conversationId] ?? [];
      if (current.includes(note.trim())) return prev;
      return {
        ...prev,
        [conversationId]: [...current, note.trim()],
      };
    });
  }, []);

  const removeSessionNote = useCallback((conversationId: string, index: number) => {
    setSessionNotes((prev) => {
      const current = prev[conversationId] ?? [];
      const updated = current.filter((_, i) => i !== index);
      return {
        ...prev,
        [conversationId]: updated,
      };
    });
  }, []);

  const clearSessionNotes = useCallback((conversationId: string) => {
    setSessionNotes((prev) => {
      const { [conversationId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  return (
    <SessionMemoryContext.Provider
      value={{
        sessionNotes,
        addSessionNote,
        removeSessionNote,
        clearSessionNotes,
      }}
    >
      {children}
    </SessionMemoryContext.Provider>
  );
};

export const useSessionMemory = () => {
  const context = useContext(SessionMemoryContext);
  if (!context) {
    return {
      sessionNotes: {},
      addSessionNote: () => {},
      removeSessionNote: () => {},
      clearSessionNotes: () => {},
    };
  }
  return context;
};
