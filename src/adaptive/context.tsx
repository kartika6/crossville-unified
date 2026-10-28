import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AdaptiveState, AutoAction } from "./types";
import { reduceAdaptive, reduceLegacy } from "./engine";
import type { Action } from "../engine";
import { SimulationRepository } from "./repository";
import { adaptiveSeed } from "./seed";
interface Store {
  state: AdaptiveState;
  send: (a: AutoAction) => boolean;
  legacy: (a: Action) => boolean;
  replace: (s: AdaptiveState) => void;
  error: string;
  clearError: () => void;
  repository: SimulationRepository;
}
const Context = createContext<Store | null>(null);
export function AdaptiveProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => new SimulationRepository(localStorage));
  const [initialError] = useState(() => {
    try {
      repository.load();
      return "";
    } catch {
      return "Saved data could not be loaded. The prior storage record was retained; import a valid backup or reset the demo.";
    }
  });
  const [state, setState] = useState<AdaptiveState>(() => {
    try {
      return repository.load();
    } catch {
      return adaptiveSeed();
    }
  });
  const [error, setError] = useState(initialError);
  const latest = useRef(state);
  latest.current = state;
  const commit = (s: AdaptiveState) => {
    repository.save(s);
    latest.current = s;
    setState(s);
    setError("");
  };
  const send = (a: AutoAction) => {
    try {
      commit(reduceAdaptive(latest.current, a));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const legacy = (a: Action) => {
    try {
      commit(reduceLegacy(latest.current, a));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const replace = (s: AdaptiveState) => {
    try {
      commit(s);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const active = state.jobs.find(
    (j) => j.status === "queued" || j.status === "running",
  );
  useEffect(() => {
    if (!active || state.controls.paused || state.study.condition === "manual")
      return;
    const timer = window.setTimeout(
      () => send({ type: "TICK" }),
      state.controls.slow ? 1100 : 360,
    );
    return () => window.clearTimeout(timer);
  }, [
    active?.id,
    active?.stage,
    state.controls.paused,
    state.controls.slow,
    state.study.condition,
  ]);
  return (
    <Context.Provider
      value={{
        state,
        send,
        legacy,
        replace,
        error,
        clearError: () => setError(""),
        repository,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSimulation() {
  const value = useContext(Context);
  if (!value) throw Error("Simulation provider missing");
  return value;
}
