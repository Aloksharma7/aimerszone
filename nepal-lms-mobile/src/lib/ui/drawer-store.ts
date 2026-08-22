import { create } from "zustand";

type DrawerState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

export const useDrawerStore = create<DrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
