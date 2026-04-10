import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiState = {
  expandedCustomerIds: string[];
  customerSearchTerm: string;
  toggleExpandedCustomer: (id: string) => void;
  mergeExpandedCustomerIds: (ids: string[]) => void;
  setCustomerSearchTerm: (term: string) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      expandedCustomerIds: [],
      customerSearchTerm: "",
      toggleExpandedCustomer: (id) => {
        const cur = get().expandedCustomerIds;
        const next = cur.includes(id)
          ? cur.filter((x) => x !== id)
          : [...cur, id];
        set({ expandedCustomerIds: next });
      },
      mergeExpandedCustomerIds: (ids) =>
        set((s) => ({
          expandedCustomerIds: [...new Set([...s.expandedCustomerIds, ...ids])],
        })),
      setCustomerSearchTerm: (term) =>
        set({ customerSearchTerm: term }),
    }),
    {
      name: "uss-ai-ui",
      partialize: (s) => ({
        expandedCustomerIds: s.expandedCustomerIds,
        customerSearchTerm: s.customerSearchTerm,
      }),
    }
  )
);
