export {};

declare global {
  interface Window {
    pendo?: {
      initialize?: (config: Record<string, unknown>) => void;
      track?: (event: string, metadata?: Record<string, unknown>) => void;
      identify?: (metadata?: Record<string, unknown>) => void;
    };
  }
}
