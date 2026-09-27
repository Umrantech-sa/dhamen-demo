"use client";

import { DatabaseZapIcon, EyeIcon, EyeOffIcon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CopyButton } from "@/components/app/copy-button";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { SimpleSelect } from "@/components/app/simple-select";
import { SwitchCard } from "@/components/app/switch-card";
import { demo } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import { useSubmit } from "@/lib/client/use-submit";
import { DHAMEN_CONFIG } from "@/lib/dhamen/config";
import type { Authority, Settings } from "@/lib/dhamen/types";

function Secret({ label, value }: { label: string; value: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-mono text-xs">
        {show ? value : value.replace(/[0-9a-f]/gi, "•").slice(0, 24) + value.slice(-4)}
        <button onClick={() => setShow(!show)} className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          {show ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        </button>
        <CopyButton value={value} label={label} />
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { data } = useDemo<{ settings: Settings; authority: Authority; storage: Storage }>("settings");
  if (!data) return null;
  // Re-mount the form whenever the stored settings change (save, reset).
  return <SettingsForm key={JSON.stringify(data.settings)} initial={data.settings} authority={data.authority} storage={data.storage} />;
}

type Storage = "redis" | "file" | "memory";

const STORAGE_LABEL: Record<Storage, React.ReactNode> = {
  redis: "All data lives in Upstash Redis and is shared by everyone testing this deployment.",
  file: (
    <>
      All data lives in <span className="font-mono">data/db.json</span>.
    </>
  ),
  memory: "Redis isn't configured, so data is kept in server memory and resets whenever the server restarts.",
};

function SettingsForm({ initial, authority, storage }: { initial: Settings; authority: Authority; storage: Storage }) {
  const [form, setForm] = useState(initial);
  const [reset, setReset] = useState(false);
  const { busy, run } = useSubmit();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm({ ...form, [k]: v });

  return (
    <>
      <PageHeader title="Settings" description="Sandbox configuration for the Dhamen integration." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API credentials</CardTitle>
            <CardDescription>Appendix A header inputs issued by the Dhamen team. Keep these server-side in production.</CardDescription>
          </CardHeader>
          <CardContent>
            <Secret label="App-key" value={DHAMEN_CONFIG.appKey} />
            <Secret label="App-id" value={DHAMEN_CONFIG.appId} />
            <Secret label="ClientId" value={DHAMEN_CONFIG.clientId} />
            <Secret label="Authority profile ID" value={authority.authorityProfileId} />
            <div className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">api-version</span>
              <span className="font-mono text-xs">2</span>
            </div>
            <div className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">Base URL</span>
              <span className="font-mono text-xs">{DHAMEN_CONFIG.baseUrl || "(this app) /api/payments"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform behaviour</CardTitle>
            <CardDescription>How the sandbox simulates Dhamen, the acquirer and SARIE.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Merchant name on checkout" required>
              <Input value={form.merchantName} onChange={(e) => set("merchantName", e.target.value)} />
            </Field>
            <Field label="Notification webhook URL" hint="Relative paths hit this app's sample receiver. Leave empty to disable delivery.">
              <Input value={form.webhookUrl} onChange={(e) => set("webhookUrl", e.target.value)} className="font-mono text-xs" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payout schedule" required>
                <SimpleSelect
                  value={form.payoutSchedule}
                  onValueChange={(v) => set("payoutSchedule", v as Settings["payoutSchedule"])}
                  className="w-full"
                  options={[
                    { value: "daily", label: "Daily (23:30)" },
                    { value: "weekly", label: "Weekly (Sunday)" },
                    { value: "manual", label: "Manual only" },
                  ]}
                />
              </Field>
              <Field label="Default link expiry (minutes)" required>
                <Input value={String(form.defaultExpiryMinutes)} onChange={(e) => set("defaultExpiryMinutes", Number(e.target.value) || 0)} inputMode="numeric" />
              </Field>
            </div>
            <SwitchCard
              checked={form.autoSettle}
              onChange={(v) => set("autoSettle", v)}
              title="Auto-settle card payments"
              description="Skip the T+1 settlement step so funds reach supplier VIBANs immediately."
            />
            <SwitchCard
              checked={form.simulateLatency}
              onChange={(v) => set("simulateLatency", v)}
              title="Simulate network latency"
              description="Adds 120–500 ms to every API response."
            />
            <Button className="justify-self-start" disabled={busy} onClick={() => run(() => demo.put("settings", form), { success: "Settings saved" })}>
              <SaveIcon /> Save settings
            </Button>
          </CardContent>
        </Card>

        <Card className="border-rose-200 lg:col-span-2">
          <CardHeader>
            <CardTitle>Demo data</CardTitle>
            <CardDescription>
              {STORAGE_LABEL[storage]} Resetting regenerates ~30 days of realistic history (customers, suppliers, payments, payouts, ledger and notifications).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setReset(true)}>
              <DatabaseZapIcon /> Reset demo data
            </Button>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={reset}
        onOpenChange={setReset}
        title="Reset all demo data?"
        description={`Everything in this sandbox will be replaced with a fresh seeded dataset${storage === "redis" ? " for every tester" : ""}.`}
        confirmLabel="Reset data"
        destructive
        successMessage="Demo data reset"
        onConfirm={() => demo.post("reset")}
      />
    </>
  );
}
