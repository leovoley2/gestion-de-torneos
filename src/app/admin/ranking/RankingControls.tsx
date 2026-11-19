"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRanking, deletePointTable, deleteRanking, savePointTable, setRankingPublished } from "@/app/admin/ranking-actions";
import type { PointRow } from "@/lib/ranking-calc";

type Msg = { ok: boolean; text: string } | null;
type Result = { ok: true; message?: string } | { ok: false; error: string };

function useRun() {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { msg, pending, run };
}

const Message = ({ msg }: { msg: Msg }) =>
  msg && (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-sky-700" : "text-red-700"}`}>
      {msg.text}
    </p>
  );

export function CreateRankingForm() {
  const { msg, pending, run } = useRun();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} className="card space-y-3" action={(fd) => run(() => createRanking(fd), () => formRef.current?.reset())}>
      <h2 className="font-semibold text-navy-900">Nuevo ranking</h2>
      <input name="name" required placeholder="Ej. Ranking Nacional Femenino" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <select name="gender" required defaultValue="" className="input">
          <option value="" disabled>
            Rama…
          </option>
          <option value="F">Femenino</option>
          <option value="M">Masculino</option>
          <option value="X">Mixto</option>
        </select>
        <input name="season" type="number" required defaultValue={new Date().getFullYear()} className="input" aria-label="Temporada" />
      </div>
      <button className="btn-primary w-full" disabled={pending}>
        Crear ranking
      </button>
      <Message msg={msg} />
    </form>
  );
}

export function RankingRowControls({ rankingId, published }: { rankingId: string; published: boolean }) {
  const { msg, pending, run } = useRun();
  return (
    <>
      <button className="btn px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => setRankingPublished(rankingId, !published))}>
        {published ? "Ocultar" : "Mostrar"}
      </button>
      <button
        className="btn-danger px-3 py-1.5 text-xs"
        disabled={pending}
        onClick={() =>
          window.confirm("¿Eliminar este ranking? Las categorías dejan de sumar a él (los resultados no se borran).") &&
          run(() => deleteRanking(rankingId))
        }
      >
        Eliminar
      </button>
      {msg && !msg.ok && <Message msg={msg} />}
    </>
  );
}

export function PointTableEditor({ table }: { table: { id: string; name: string; rows: PointRow[] } | null }) {
  const { msg, pending, run } = useRun();
  const [name, setName] = useState(table?.name ?? "");
  const [rows, setRows] = useState<PointRow[]>(table?.rows ?? [{ from: 1, to: 1, points: 0 }]);
  const update = (i: number, k: keyof PointRow, v: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [k]: Number(v) } : r)));
  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows([...rows, { from: (last?.to ?? 0) + 1, to: (last?.to ?? 0) + 1, points: 0 }]);
  };
  const save = () => {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("rows", JSON.stringify(rows));
    run(() => savePointTable(table?.id ?? null, fd), () => {
      if (!table) {
        setName("");
        setRows([{ from: 1, to: 1, points: 0 }]);
      }
    });
  };

  return (
    <div className="card space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={table ? "Nombre" : "Nueva tabla (p. ej. Nacional 2 estrellas)"}
        className="input font-semibold"
        aria-label="Nombre de la tabla"
      />
      <table className="w-full text-sm">
        <thead className="text-xs text-navy-400">
          <tr>
            <th className="pb-1 text-left font-medium">Desde puesto</th>
            <th className="pb-1 text-left font-medium">Hasta puesto</th>
            <th className="pb-1 text-left font-medium">Puntos dupla</th>
            <th className="pb-1 text-left font-medium">Cada jugador</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {(["from", "to", "points"] as const).map((k) => (
                <td key={k} className="py-0.5 pr-2">
                  <input type="number" min={k === "points" ? 0 : 1} value={r[k]} onChange={(e) => update(i, k, e.target.value)} className="input px-2 py-1 tabular-nums" aria-label={`${k} fila ${i + 1}`} />
                </td>
              ))}
              <td className="py-0.5 text-navy-500 tabular-nums">{r.points / 2}</td>
              <td>
                <button className="btn size-7 p-0" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Quitar fila">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn px-3 py-1.5 text-xs" onClick={addRow}>
          + Fila
        </button>
        <button className="btn-primary px-3 py-1.5 text-xs" disabled={pending} onClick={save}>
          {table ? "Guardar tabla" : "Crear tabla"}
        </button>
        {table && (
          <button
            className="btn-danger px-3 py-1.5 text-xs"
            disabled={pending}
            onClick={() => window.confirm("¿Eliminar esta tabla?") && run(() => deletePointTable(table.id))}
          >
            Eliminar
          </button>
        )}
      </div>
      <Message msg={msg} />
    </div>
  );
}
