"use client";

import { useEffect } from "react";

export default function PendoInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.pendo?.initialize) {
      window.pendo.initialize({
        visitor: {
          id: '',
        },
      });
    }
  }, []);

  return null;
}
