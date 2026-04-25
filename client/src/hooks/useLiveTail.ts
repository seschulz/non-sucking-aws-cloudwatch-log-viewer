import { useRef, useState, useCallback, useEffect } from "react";
import { useLogStore } from "../stores/logStore";

export function useLiveTail() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const profile = useLogStore((s) => s.profile);
  const region = useLogStore((s) => s.region);
  const selectedLogGroups = useLogStore((s) => s.selectedLogGroups);
  const availableLogGroups = useLogStore((s) => s.availableLogGroups);
  const filterPattern = useLogStore((s) => s.filterPattern);
  const addLogEvents = useLogStore((s) => s.addLogEvents);

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const start = useCallback(() => {
    // Close any existing connection
    stop();

    const activeLogGroups = availableLogGroups.length
      ? selectedLogGroups.filter((group) => availableLogGroups.includes(group))
      : selectedLogGroups;

    if (!profile || !region || !activeLogGroups.length) return;

    const params = new URLSearchParams();
    params.set("profile", profile);
    params.set("region", region);
    params.set("logGroups", activeLogGroups.join(","));
    if (filterPattern) params.set("filterPattern", filterPattern);

    const es = new EventSource(`/api/tail?${params.toString()}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.eventId) {
          addLogEvents([data]);
        }
      } catch {
        // ignore invalid messages
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect, but if closed we stop
      if (es.readyState === EventSource.CLOSED) {
        setIsConnected(false);
        eventSourceRef.current = null;
      }
    };
  }, [profile, region, selectedLogGroups, availableLogGroups, filterPattern, addLogEvents, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  return { start, stop, isConnected };
}
