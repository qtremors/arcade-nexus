import { useSyncExternalStore } from "react";
import {
  connectionSnapshot,
  subscribeConnection,
} from "./connection";
export function useLocalConnection() {
  return useSyncExternalStore(subscribeConnection, connectionSnapshot);
}
