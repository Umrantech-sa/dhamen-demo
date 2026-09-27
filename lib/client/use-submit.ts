"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ApiError, errorMessage } from "./api";

/** Runs an API mutation, mapping M001 field errors back onto the form. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function run<T>(fn: () => Promise<T>, opts: { success?: string | ((r: T) => string) } = {}): Promise<T | undefined> {
    setBusy(true);
    setErrors({});
    try {
      const res = await fn();
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(res) : opts.success);
      return res;
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      toast.error(errorMessage(e), e instanceof ApiError && e.errors ? { description: Object.values(e.errors).flat().slice(0, 3).join(" · ") } : undefined);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  return { busy, errors, setErrors, run, err: (k: string) => errors[k] };
}
