import { useSyncExternalStore } from "react";
import {
  connectionSnapshot,
  subscribeConnection,
} from "../services/connection";
export function useLocalConnection() {
  return useSyncExternalStore(subscribeConnection, connectionSnapshot);
}
