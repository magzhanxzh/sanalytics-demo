"use client";

import { formatRange } from "@/lib/queries/cards";

import { useEffect, useState } from "react";
import { Pencil, X, Copy, GripVertical } from "lucide-react";
import { WidgetChart } from "./WidgetChart";
import { BREAKDOWN_LABELS, type Widget, type WidgetData } from "@/lib/dashboards/types";

export function WidgetCard({
  widget,
  editable,
  refreshKey = 0,
  onEdit,
  onRemove,
  onDuplicate,
}: {
  widget: Widget;
  editable: boolean;
  refreshKey?: number;
  onEdit?: (w: Widget) => void;
  onRemove?: (w: Widget) => void;
  onDuplicate?: (w: Widget) => void;
}) {
  const [data, setData] = useState<WidgetData>({ kind: "loading" });
  const isText = widget.type === "text";

  useEffect(() => {
    if (isText) return;
    let alive = true;
    setData({ kind: "loading" });
    fetch("/api/widget-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widget }),
    })
      .then((r) => r.json())
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData({ kind: "error", message: "Ошибка сети" }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(widget), refreshKey]);

  // Текстовый виджет
  if (isText) {
    return (
      <div className="border border-line bg-surface rounded-xl h-full flex flex-col overflow-hidden">
        <div className={`flex items-start justify-between ${editable ? "drag-handle" : ""}`} style={{ padding: "10px 14px", cursor: editable ? "grab" : "default" }}>
          <div className="whitespace-pre-wrap" style={{ fontSize: 15, fontWeight: 600 }}>{widget.text || widget.title}</div>
          {editable && (
            <div className="flex items-center gap-1 no-drag shrink-0">
              <button onClick={() => onEdit?.(widget)} className="text-muted hover:text-ink p-1"><Pencil size={13} /></button>
              <button onClick={() => onRemove?.(widget)} className="text-muted hover:text-neg p-1"><X size={14} /></button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-line bg-surface rounded-xl h-full flex flex-col overflow-hidden">
      <div className={`flex items-start justify-between ${editable ? "drag-handle" : ""}`} style={{ padding: "12px 14px 8px", cursor: editable ? "grab" : "default" }}>
        <div className="flex items-start gap-1.5 min-w-0">
          {editable && <GripVertical size={14} className="text-muted shrink-0" style={{ marginTop: 1 }} />}
          <div className="min-w-0">
            <div className="font-semibold truncate" style={{ fontSize: 14 }}>{widget.title}</div>
            <div className="text-muted truncate" style={{ fontSize: 11.5 }}>
              {BREAKDOWN_LABELS[widget.breakdown]} · {formatRange(widget.filters.from, widget.filters.to)}
            </div>
          </div>
        </div>
        {editable && (
          <div className="flex items-center gap-0.5 no-drag shrink-0">
            <button onClick={() => onDuplicate?.(widget)} className="text-muted hover:text-ink p-1" title="Дублировать"><Copy size={13} /></button>
            <button onClick={() => onEdit?.(widget)} className="text-muted hover:text-ink p-1" title="Изменить"><Pencil size={14} /></button>
            <button onClick={() => onRemove?.(widget)} className="text-muted hover:text-neg p-1" title="Удалить"><X size={15} /></button>
          </div>
        )}
      </div>
      <div className="flex-1" style={{ minHeight: 0, padding: "0 8px 8px" }}>
        <WidgetChart widget={widget} data={data} />
      </div>
    </div>
  );
}
