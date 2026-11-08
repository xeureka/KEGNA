import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

type AuditRow = { id: string; actor: { name: string; email: string } | null; action: string; entityType: string; entityId: string | null; createdAt: string; metadataSummary: string };
export function AuditPage() {
	const [entityType, setEntityType] = useState("");
	const [page, setPage] = useState(1);
	const query = useQuery({ queryKey: ["audit", entityType, page], queryFn: () => api.get<AuditRow[]>("/audit-logs", { entityType, page, pageSize: 25 }) });
	return <div className="space-y-5"><PageHeader title="Audit log" subtitle="Administrative activity across the warehouse" /><Card><CardHeader title="Filters" /><CardContent><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Entity type" value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} /></CardContent></Card>{query.isLoading ? <Spinner label="Loading audit log" /> : query.error ? <InlineError message={query.error instanceof Error ? query.error.message : "Failed to load audit log"} /> : !query.data?.length ? <EmptyState title="No audit entries" description="Administrative activity will appear here." /> : <Card><Table><TableHead><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th><Th>Summary</Th></TableHead><TableBody>{query.data.map((row) => <TableRow key={row.id}><Td className="whitespace-nowrap text-slate-500">{formatDateTime(row.createdAt)}</Td><Td><div className="font-medium text-slate-900">{row.actor?.name ?? "System"}</div><div className="text-xs text-slate-500">{row.actor?.email ?? "—"}</div></Td><Td>{row.action}</Td><Td className="font-mono text-xs">{row.entityType}{row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}</Td><Td className="max-w-md truncate text-xs text-slate-500">{row.metadataSummary}</Td></TableRow>)}</TableBody></Table><div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50" disabled={(query.data?.length ?? 0) < 25} onClick={() => setPage((value) => value + 1)}>Next</button></div></Card>}</div>;
}
