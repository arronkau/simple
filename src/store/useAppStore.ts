import { create } from "zustand";
import {
  createEmptyAppState,
  readLocalAppState,
  writeLocalAppState,
  type AppState,
} from "../model/appState";

type AppStore = {
  appState: AppState;
  resetLocalState: () => void;
};

const initialAppState = readLocalAppState();

writeLocalAppState(initialAppState);

export const useAppStore = create<AppStore>((set) => ({
  appState: initialAppState,
  resetLocalState: () => {
    set({ appState: createEmptyAppState() });
  },
}));

useAppStore.subscribe((state) => {
  writeLocalAppState(state.appState);
});
