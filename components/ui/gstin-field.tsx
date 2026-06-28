"use client";

import * as React from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validateGstinFormat, GST_STATES, entityTypeName } from "@/lib/gstin";
import type { GstLookupResponse } from "@/app/api/gst/lookup/route";

interface GstinFieldProps {
  value: string;
  onChange: (v: string) => void;
  onResult?: (r: GstLookupResponse | null) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

type Status = "idle" | "format-error" | "loading" | "live-ok" | "live-warn" | "mock-ok" | "api-error";

export function GstinField({
  value,
  onChange,
  onResult,
  label = "GSTIN",
  className,
  disabled,
}: GstinFieldProps) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [result, setResult] = React.useState<GstLookupResponse | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce lookup — run after 600 ms of idle typing.
  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      setStatus("idle");
      setResult(null);
      onResult?.(null);
      return;
    }

    // Quick local format check while the user is still typing.
    const fmt = validateGstinFormat(trimmed);
    if (!fmt.valid) {
      setStatus("format-error");
      setResult(null);
      onResult?.(null);
      return;
    }

    // Format looks fine — kick off a debounced API call.
    setStatus("loading");
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/gst/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gstin: trimmed }),
        });
        const data: GstLookupResponse = await res.json();
        setResult(data);
        onResult?.(data);
        if (!data.valid) {
          setStatus("api-error");
        } else if (data.source === "live") {
          setStatus(data.status === "ACTIVE" ? "live-ok" : "live-warn");
        } else {
          setStatus("mock-ok");
        }
      } catch {
        const mockRes: GstLookupResponse = {
          valid: fmt.valid,
          gstin: fmt.gstin,
          stateCode: fmt.stateCode,
          stateName: fmt.stateName,
          pan: fmt.pan,
          source: "mock",
          error: "Could not reach validation server.",
        };
        setResult(mockRes);
        onResult?.(mockRes);
        setStatus("mock-ok");
      }
    }, 600);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const borderColor =
    status === "live-ok" || status === "mock-ok"
      ? "border-success focus-within:ring-success/30"
      : status === "format-error" || status === "api-error" || status === "live-warn"
      ? "border-destructive focus-within:ring-destructive/30"
      : "";

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label className="block text-xs font-medium text-muted-foreground">{label} *</label>
      )}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="29AACN1001P1ZA"
          maxLength={15}
          disabled={disabled}
          className={cn("h-9 pr-8 font-mono uppercase", borderColor)}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          {status === "loading" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {(status === "live-ok" || status === "mock-ok") && <CheckCircle2 className="size-4 text-success" />}
          {(status === "format-error" || status === "api-error") && <XCircle className="size-4 text-destructive" />}
          {status === "live-warn" && <AlertTriangle className="size-4 text-amber-500" />}
        </span>
      </div>

      {/* Inline result card */}
      {result && status !== "format-error" && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            status === "live-ok" || status === "mock-ok"
              ? "border-success/30 bg-success/5"
              : "border-amber-300/40 bg-amber-50/50 dark:bg-amber-900/10",
          )}
        >
          {result.legalName ? (
            <p className="font-semibold text-foreground">{result.legalName}</p>
          ) : (
            <p className="font-medium text-muted-foreground">
              {result.source === "mock" ? "Format valid — live lookup not configured" : "Name unavailable"}
            </p>
          )}
          {result.tradeName && result.tradeName !== result.legalName && (
            <p className="text-muted-foreground">Trade name: {result.tradeName}</p>
          )}
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0 text-muted-foreground">
            {result.stateName && <span>{result.stateName} ({result.stateCode})</span>}
            {result.pan && <span>PAN: {result.pan}</span>}
            {result.status && (
              <span className={result.status === "ACTIVE" ? "text-success font-medium" : "text-amber-600 font-medium"}>
                {result.status}
              </span>
            )}
            {result.registrationDate && <span>Reg: {result.registrationDate}</span>}
            {result.source === "live" && (
              <span className="text-primary font-medium">● Live</span>
            )}
          </div>
          {result.error && (
            <p className="mt-0.5 text-amber-600">{result.error}</p>
          )}
        </div>
      )}

      {status === "format-error" && value.trim().length > 2 && (
        <p className="text-xs text-destructive">
          {validateGstinFormat(value.trim().toUpperCase()).error}
        </p>
      )}
    </div>
  );
}
