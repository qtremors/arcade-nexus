import { useCallback, useEffect, useRef, useState } from "react";
import { Confirmation } from "./Confirmation";
import type { ConfirmationRequest } from "./Confirmation";

/** Local ownership cancels pending questions when a page is left. */
export function useConfirmation() {
  const [request, setConfirmationRequest] =
    useState<ConfirmationRequest | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const mounted = useRef(false);
  const ask = useCallback(
    (question: ConfirmationRequest) =>
      new Promise<boolean>((resolve) => {
        if (!mounted.current) {
          resolve(false);
          return;
        }
        resolver.current?.(false);
        resolver.current = resolve;
        setConfirmationRequest(question);
      }),
    [],
  );
  const finish = useCallback((answer: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setConfirmationRequest(null);
    resolve?.(answer);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);
  return {
    ask,
    confirmation: request ? (
      <Confirmation request={request} finish={finish} />
    ) : null,
  };
}
