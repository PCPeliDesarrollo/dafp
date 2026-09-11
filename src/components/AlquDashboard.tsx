import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { Building2, CalendarDays, Check, Edit3, FolderArchive, Loader2, Printer, ReceiptText, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateAlquAmounts,
  deleteAlquCobro,
  garbageAlreadyPaid,
  loadAlquData,
  previousReading,
  residualWaterAlreadyPaid,
  updateAlquInquilino,
  upsertAlquCobro,
  type AlquCobro,
  type AlquInquilino,
} from "@/lib/alqu-store";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const dec = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });
const isoToday = () => new Date().toISOString().slice(0, 10);
const n = (value: string | number | null | undefined) => Number(value) || 0;

type Draft = {
  lectura_anterior: string;
  lectura_actual: string;
  importe_agua: string;
  aplica_agua_residual: boolean;
  importe_agua_residual: string;
  aplica_basura_mes: boolean;
  estado_pago: "Pendiente" | "Cobrado";
  fecha_cobro: string;
  quien_cobra: string;
  notas: string;
};

function TenantEditor({ tenant, open, onOpenChange, onSaved }: { tenant: AlquInquilino | null; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState<AlquInquilino | null>(tenant);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(tenant), [tenant]);
  if (!form) return null;
  const set = (key: keyof AlquInquilino, value: string | number) => setForm((old) => old ? { ...old, [key]: value } : old);
  const save = async () => {
    setSaving(true);
    try {
      await updateAlquInquilino(form.id, {
        inquilino: form.inquilino.trim(), direccion: form.direccion.trim(),
        importe_alquiler: n(form.importe_alquiler), importe_basura: n(form.importe_basura),
        importe_agua_residual: n(form.importe_agua_residual),
        frecuencia_basura: form.frecuencia_basura, iva: n(form.iva), precio_kw: n(form.precio_kw),
        minimo_luz: n(form.minimo_luz), notas: form.notas?.trim() || null,
      });
      toast.success("Contrato actualizado"); onOpenChange(false); onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar"); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>Editar contrato</DialogTitle><DialogDescription>Los cambios se aplicarán a las nuevas mensualidades.</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Inquilino"><Input value={form.inquilino} onChange={(e) => set("inquilino", e.target.value)} /></Field>
      <Field label="Dirección"><Input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} /></Field>
      <MoneyField label="Alquiler" value={form.importe_alquiler} onChange={(v) => set("importe_alquiler", v)} />
      <MoneyField label="Basura" value={form.importe_basura} onChange={(v) => set("importe_basura", v)} />
      <MoneyField label="Agua residual bimestral" value={form.importe_agua_residual} onChange={(v) => set("importe_agua_residual", v)} />
      <Field label="Frecuencia de basura"><Select value={form.frecuencia_basura} onValueChange={(v: AlquInquilino["frecuencia_basura"]) => set("frecuencia_basura", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Mensual">Mensual</SelectItem><SelectItem value="Bimestral">Bimestral</SelectItem><SelectItem value="Trimestral">Trimestral</SelectItem></SelectContent></Select></Field>
      <MoneyField label="IVA de luz (%)" value={form.iva} onChange={(v) => set("iva", v)} />
      <MoneyField label="Precio por KW" value={form.precio_kw} step="0.000001" onChange={(v) => set("precio_kw", v)} />
      <MoneyField label="Mínimo de luz" value={form.minimo_luz} onChange={(v) => set("minimo_luz", v)} />
      <Field label="Notas" className="sm:col-span-2"><Textarea value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} /></Field>
    </div>
    <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function MoneyField({ label, value, step = "0.01", onChange }: { label: string; value: number; step?: string; onChange: (v: number) => void }) {
  return <Field label={label}><Input type="number" min="0" step={step} value={value} onChange={(e) => onChange(n(e.target.value))} /></Field>;
}

function ReceiptDialog({ tenant, receipt, open, onOpenChange }: { tenant: AlquInquilino | null; receipt: AlquCobro | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!tenant || !receipt) return null;
  const baseLuz = n(receipt.kw_consumidos) * n(tenant.precio_kw) + n(tenant.minimo_luz);
  const printReceipt = () => window.print();
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl print:fixed print:inset-0 print:max-h-none print:max-w-none print:translate-x-0 print:translate-y-0 print:border-0">
    <DialogHeader><DialogTitle>Recibo de {MONTHS[receipt.mes - 1]} de {receipt.anio}</DialogTitle><DialogDescription>{tenant.inquilino} · {tenant.direccion}</DialogDescription></DialogHeader>
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex justify-between"><span className="text-muted-foreground">Alquiler</span><strong>{eur.format(n(receipt.importe_alquiler))}</strong></div>
      <div className="border-y border-border py-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Lectura de luz</span><span>{dec.format(n(receipt.lectura_anterior))} → {dec.format(n(receipt.lectura_actual))} KW</span></div>
        <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Consumo</span><span>{dec.format(n(receipt.kw_consumidos))} KW × {eur.format(n(tenant.precio_kw))}</span></div>
        <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Consumo + mínimo</span><span>{eur.format(baseLuz)}</span></div>
        <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Total luz con IVA ({dec.format(n(tenant.iva))} %)</span><strong>{eur.format(n(receipt.total_luz))}</strong></div>
      </div>
      <div className="flex justify-between"><span className="text-muted-foreground">Basura</span><strong>{eur.format(n(receipt.importe_basura_cobrado))}</strong></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Agua</span><strong>{eur.format(n(receipt.importe_agua))}</strong></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Agua residual (bimestral)</span><strong>{eur.format(n(receipt.importe_agua_residual_cobrado))}</strong></div>
      <div className="flex items-center justify-between border-t border-border pt-4 text-xl"><span>TOTAL A PAGAR</span><strong className="text-primary">{eur.format(n(receipt.total_a_cobrar))}</strong></div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{receipt.estado_pago}</span><span>{receipt.fecha_cobro ? `Cobrado el ${receipt.fecha_cobro}${receipt.quien_cobra ? ` por ${receipt.quien_cobra}` : ""}` : ""}</span></div>
    </div>
    <DialogFooter className="print:hidden"><Button onClick={printReceipt}><Printer className="h-4 w-4" /> Imprimir</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export function AlquDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tenants, setTenants] = useState<AlquInquilino[]>([]);
  const [receipts, setReceipts] = useState<AlquCobro[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AlquInquilino | null>(null);
  const [preview, setPreview] = useState<{ tenant: AlquInquilino; receipt: AlquCobro } | null>(null);
  const [deleting, setDeleting] = useState<{ tenant: AlquInquilino | null; receipt: AlquCobro } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { const data = await loadAlquData(); setTenants(data.inquilinos); setReceipts(data.cobros); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo cargar ALQU"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const current = useMemo(() => new Map(receipts.filter((r) => r.anio === year && r.mes === month).map((r) => [r.inquilino_id, r])), [receipts, year, month]);
  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const tenant of tenants) {
      const row = current.get(tenant.id);
      const paid = garbageAlreadyPaid(receipts, tenant, year, month, row?.id);
      next[tenant.id] = {
        lectura_anterior: String(row?.lectura_anterior ?? previousReading(receipts, tenant.id, year, month)),
        lectura_actual: String(row?.lectura_actual ?? previousReading(receipts, tenant.id, year, month)),
        importe_agua: String(row?.importe_agua ?? 0),
        aplica_agua_residual: row?.aplica_agua_residual ?? false,
        importe_agua_residual: String(row?.importe_agua_residual_cobrado || tenant.importe_agua_residual),
        aplica_basura_mes: row?.aplica_basura_mes ?? !paid,
        estado_pago: row?.estado_pago ?? "Pendiente",
        fecha_cobro: row?.fecha_cobro ?? "",
        quien_cobra: row?.quien_cobra ?? "",
        notas: row?.notas ?? "",
      };
    }
    setDrafts(next);
  }, [tenants, receipts, current, year, month]);

  const patchDraft = (id: string, values: Partial<Draft>) => setDrafts((old) => ({ ...old, [id]: { ...old[id], ...values } as Draft }));
  const saveReceipt = async (tenant: AlquInquilino) => {
    const draft = drafts[tenant.id]; if (!draft) return;
    const existing = current.get(tenant.id);
    const anterior = n(draft.lectura_anterior);
    const actual = n(draft.lectura_actual);
    if (actual < anterior) { toast.error("La lectura actual no puede ser menor que la anterior"); return; }
    const amounts = calculateAlquAmounts(tenant, anterior, actual, draft.aplica_basura_mes, n(draft.importe_agua), draft.aplica_agua_residual, n(draft.importe_agua_residual));
    const paidElsewhere = garbageAlreadyPaid(receipts, tenant, year, month, existing?.id);
    setSavingId(tenant.id);
    try {
      const savedReceipt = await upsertAlquCobro({
        ...(existing?.id ? { id: existing.id } : {}), inquilino_id: tenant.id, anio: year, mes: month,
        lectura_anterior: anterior, lectura_actual: actual,
        kw_consumidos: amounts.kw, total_luz: amounts.luz, importe_alquiler: n(tenant.importe_alquiler),
        aplica_basura_mes: draft.aplica_basura_mes, estado_basura_trimestre: draft.aplica_basura_mes ? "Cobrado este trimestre" : paidElsewhere ? "No corresponde pagar" : "Pendiente de cobro",
        importe_basura_cobrado: amounts.basura, importe_agua: Math.max(0, n(draft.importe_agua)), total_a_cobrar: amounts.total,
        aplica_agua_residual: draft.aplica_agua_residual,
        importe_agua_residual_cobrado: amounts.residual,
        estado_pago: draft.estado_pago, fecha_cobro: draft.estado_pago === "Cobrado" ? (draft.fecha_cobro || isoToday()) : null,
        quien_cobra: draft.estado_pago === "Cobrado" ? draft.quien_cobra.trim() || null : null, notas: draft.notas.trim() || null,
      });
      toast.success(`Mensualidad de ${tenant.inquilino} guardada`);
      setPreview({ tenant, receipt: savedReceipt });
      await reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar"); }
    finally { setSavingId(null); }
  };
  const confirmDeleteReceipt = async () => {
    if (!deleting) return;
    setDeletingId(deleting.receipt.id);
    try {
      await deleteAlquCobro(deleting.receipt.id);
      toast.success(`Recibo de ${deleting.tenant?.inquilino ?? "inquilino"} eliminado`);
      setDeleting(null);
      await reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo eliminar el recibo"); }
    finally { setDeletingId(null); }
  };

  const years = Array.from({ length: 9 }, (_, i) => now.getFullYear() + 2 - i);
  const totalMonth = Array.from(current.values()).reduce((sum, row) => sum + n(row.total_a_cobrar), 0);
  const collected = Array.from(current.values()).filter((r) => r.estado_pago === "Cobrado").reduce((sum, row) => sum + n(row.total_a_cobrar), 0);
  const tenantById = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant])), [tenants]);
  const receiptGroups = useMemo(() => {
    const grouped = new Map<string, AlquCobro[]>();
    for (const receipt of receipts) {
      const key = `${receipt.anio}-${String(receipt.mes).padStart(2, "0")}`;
      const existing = grouped.get(key) ?? [];
      existing.push(receipt);
      grouped.set(key, existing);
    }
    return Array.from(grouped.entries()).map(([key, rows]) => ({ key, rows }));
  }, [receipts]);

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><Badge className="mb-2 bg-primary/15 text-primary hover:bg-primary/15">Gestión de alquileres</Badge><h1 className="text-2xl font-semibold">ALQU</h1><p className="text-sm text-muted-foreground">Alquileres, lecturas y recibos mensuales</p></div><div className="flex gap-2"><Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select><Select value={String(year)} onValueChange={(v) => setYear(Number(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Summary icon={Building2} label="Inquilinos" value={String(tenants.length)} /><Summary icon={ReceiptText} label="Facturado" value={eur.format(totalMonth)} /><Summary icon={Check} label="Cobrado" value={eur.format(collected)} /></div>
    <Tabs defaultValue="mensualidades"><TabsList className="h-auto flex-wrap"><TabsTrigger value="mensualidades"><CalendarDays className="mr-2 h-4 w-4" />Mensualidades</TabsTrigger><TabsTrigger value="recibos"><FolderArchive className="mr-2 h-4 w-4" />Recibos guardados</TabsTrigger><TabsTrigger value="inquilinos"><Building2 className="mr-2 h-4 w-4" />Inquilinos</TabsTrigger></TabsList>
      <TabsContent value="mensualidades" className="mt-5">{loading ? <Loading /> : <div className="grid gap-4 xl:grid-cols-2">{tenants.map((tenant) => {
        const draft = drafts[tenant.id]; if (!draft) return null;
        const row = current.get(tenant.id); const anterior = n(draft.lectura_anterior);
        const amounts = calculateAlquAmounts(tenant, anterior, n(draft.lectura_actual), draft.aplica_basura_mes, n(draft.importe_agua), draft.aplica_agua_residual, n(draft.importe_agua_residual));
        const paidElsewhere = garbageAlreadyPaid(receipts, tenant, year, month, row?.id);
        const residualPaidElsewhere = residualWaterAlreadyPaid(receipts, tenant.id, year, month, row?.id);
        return <Card key={tenant.id} className="gradient-card border-border/50 shadow-elevated"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{tenant.inquilino}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{tenant.direccion}</p></div>{row && <Badge variant={row.estado_pago === "Cobrado" ? "default" : "secondary"}>{row.estado_pago}</Badge>}</div></CardHeader><CardContent className="space-y-4">
           <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Lectura anterior"><Input type="number" min="0" step="0.001" value={draft.lectura_anterior} onChange={(e) => patchDraft(tenant.id, { lectura_anterior: e.target.value })} /></Field><Field label="Lectura actual"><Input type="number" min={anterior} step="0.001" value={draft.lectura_actual} onChange={(e) => patchDraft(tenant.id, { lectura_actual: e.target.value })} /></Field><Readout label="Consumo" value={`${dec.format(amounts.kw)} KW`} /><Readout label="Total luz (mínimo + IVA)" value={eur.format(amounts.luz)} accent /></div>
           <div className="grid gap-3 sm:grid-cols-3"><label className="flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm"><Checkbox checked={draft.aplica_basura_mes} onCheckedChange={(v) => patchDraft(tenant.id, { aplica_basura_mes: v === true })} /><span>Basura · {eur.format(n(tenant.importe_basura))}</span></label><Field label="Agua"><Input type="number" min="0" step="0.01" value={draft.importe_agua} onChange={(e) => patchDraft(tenant.id, { importe_agua: e.target.value })} /></Field><Field label="Estado"><Select value={draft.estado_pago} onValueChange={(v: Draft["estado_pago"]) => patchDraft(tenant.id, { estado_pago: v, fecha_cobro: v === "Cobrado" ? draft.fecha_cobro || isoToday() : "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Cobrado">Cobrado</SelectItem></SelectContent></Select></Field></div>
           <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><label className="flex min-h-10 items-center gap-2 rounded-md border border-input px-3 text-sm"><Checkbox checked={draft.aplica_agua_residual} disabled={residualPaidElsewhere} onCheckedChange={(v) => patchDraft(tenant.id, { aplica_agua_residual: v === true })} /><span>{draft.aplica_agua_residual ? "Agua residual pagada" : "Agua residual pendiente"}</span></label><Field label="Importe agua residual (editable)"><Input type="number" min="0" step="0.01" value={draft.importe_agua_residual} disabled={residualPaidElsewhere} onChange={(e) => patchDraft(tenant.id, { importe_agua_residual: e.target.value })} /></Field></div>
           {residualPaidElsewhere && <p className="text-xs text-info">Agua residual ya pagada en este bimestre. No corresponde cobrarla de nuevo.</p>}
          {paidElsewhere && !draft.aplica_basura_mes && <p className="text-xs text-info">Basura ya pagada en este periodo. No corresponde cobrarla este mes.</p>}
          {draft.estado_pago === "Cobrado" && <div className="grid gap-3 sm:grid-cols-2"><Field label="Fecha de cobro"><Input type="date" value={draft.fecha_cobro} onChange={(e) => patchDraft(tenant.id, { fecha_cobro: e.target.value })} /></Field><Field label="Quién cobra"><Input value={draft.quien_cobra} onChange={(e) => patchDraft(tenant.id, { quien_cobra: e.target.value })} placeholder="Nombre" /></Field></div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><div><p className="text-xs text-muted-foreground">Total a pagar</p><p className="text-2xl font-semibold text-primary">{eur.format(amounts.total)}</p></div><div className="flex gap-2">{row && <Button variant="outline" size="sm" onClick={() => setPreview({ tenant, receipt: row })}><Printer className="h-4 w-4" /> Recibo</Button>}<Button size="sm" onClick={() => saveReceipt(tenant)} disabled={savingId === tenant.id}>{savingId === tenant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar</Button></div></div>
        </CardContent></Card>;
      })}</div>}</TabsContent>
      <TabsContent value="recibos" className="mt-5">
        {loading ? <Loading /> : receiptGroups.length === 0 ? <Card className="border-dashed"><CardContent className="flex min-h-48 flex-col items-center justify-center text-center"><FolderArchive className="mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Todavía no hay recibos guardados</p><p className="mt-1 text-sm text-muted-foreground">Al pulsar Guardar en una mensualidad, aparecerá aquí dentro de su mes.</p></CardContent></Card> : <Accordion type="multiple" defaultValue={[receiptGroups[0]?.key ?? ""]} className="space-y-3">{receiptGroups.map(({ key, rows }) => {
          const first = rows[0];
          if (!first) return null;
          const total = rows.reduce((sum, row) => sum + n(row.total_a_cobrar), 0);
          const paid = rows.filter((row) => row.estado_pago === "Cobrado");
          const paidTotal = paid.reduce((sum, row) => sum + n(row.total_a_cobrar), 0);
          return <AccordionItem key={key} value={key} className="rounded-lg border border-border bg-card px-4 shadow-sm">
            <AccordionTrigger className="gap-4 py-4 hover:no-underline"><div className="flex min-w-0 flex-1 flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between"><div><p className="text-base font-semibold">{MONTHS[first.mes - 1]} {first.anio}</p><p className="text-xs font-normal text-muted-foreground">{rows.length} {rows.length === 1 ? "recibo guardado" : "recibos guardados"}</p></div><div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-normal"><span>Facturado <strong className="ml-1 text-foreground">{eur.format(total)}</strong></span><span>Cobrado <strong className="ml-1 text-primary">{eur.format(paidTotal)}</strong></span></div></div></AccordionTrigger>
            <AccordionContent><div className="divide-y divide-border rounded-md border border-border">{rows.map((receipt) => {
              const tenant = tenantById.get(receipt.inquilino_id);
              return <div key={receipt.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{tenant?.inquilino ?? "Inquilino"}</p><Badge variant={receipt.estado_pago === "Cobrado" ? "default" : "secondary"}>{receipt.estado_pago}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{tenant?.direccion || "Sin dirección"}{receipt.fecha_cobro ? ` · Cobrado el ${receipt.fecha_cobro}` : ""}</p></div><div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end"><strong className="mr-1 text-base">{eur.format(n(receipt.total_a_cobrar))}</strong><Button variant="outline" size="sm" disabled={!tenant} onClick={() => tenant && setPreview({ tenant, receipt })}><Printer className="h-4 w-4" /> Abrir recibo</Button><Button variant="destructive" size="sm" onClick={() => setDeleting({ tenant: tenant ?? null, receipt })}><Trash2 className="h-4 w-4" /> Eliminar</Button></div></div>;
            })}</div></AccordionContent>
          </AccordionItem>;
        })}</Accordion>}
      </TabsContent>
       <TabsContent value="inquilinos" className="mt-5">{loading ? <Loading /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tenants.map((tenant) => <Card key={tenant.id} className="gradient-card border-border/50"><CardContent className="p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">{tenant.inquilino}</h2><p className="mt-1 text-xs text-muted-foreground">{tenant.direccion}</p></div><Button variant="ghost" size="icon" title="Editar contrato" onClick={() => setEditing(tenant)}><Edit3 className="h-4 w-4" /></Button></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Readout label="Alquiler" value={eur.format(n(tenant.importe_alquiler))} /><Readout label="Basura" value={`${eur.format(n(tenant.importe_basura))} · ${tenant.frecuencia_basura}`} /><Readout label="Agua residual" value={`${eur.format(n(tenant.importe_agua_residual))} · Bimestral`} /><Readout label="Precio/KW" value={eur.format(n(tenant.precio_kw))} /><Readout label="Mínimo + IVA" value={`${eur.format(n(tenant.minimo_luz))} + ${dec.format(n(tenant.iva))} %`} /></div>{tenant.notas && <p className="mt-4 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">{tenant.notas}</p>}</CardContent></Card>)}</div>}</TabsContent>
    </Tabs>
    <TenantEditor tenant={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} onSaved={reload} />
    <ReceiptDialog tenant={preview?.tenant ?? null} receipt={preview?.receipt ?? null} open={!!preview} onOpenChange={(v) => !v && setPreview(null)} />
    <AlertDialog open={!!deleting} onOpenChange={(open) => !open && !deletingId && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar este recibo?</AlertDialogTitle><AlertDialogDescription>Se eliminará definitivamente el recibo de {deleting?.tenant?.inquilino ?? "este inquilino"} de {deleting ? `${MONTHS[deleting.receipt.mes - 1]} de ${deleting.receipt.anio}` : "este mes"}. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={!!deletingId}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={!!deletingId} onClick={(event) => { event.preventDefault(); void confirmDeleteReceipt(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Eliminar recibo</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div className="rounded-md bg-muted/50 p-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className={accent ? "mt-1 font-semibold text-primary" : "mt-1 font-medium"}>{value}</p></div>; }
function Summary({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) { return <Card className="gradient-card border-border/50"><CardContent className="flex items-center gap-4 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15"><Icon className="h-5 w-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div></CardContent></Card>; }
function Loading() { return <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando alquileres…</div>; }