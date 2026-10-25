"use client";

import { useState } from "react";
import { Plus, Trash2, Gauge } from "lucide-react";

export interface InstrumentItem {
  id: string;
  name: string;
  serialNo: string;
  calibrationNo: string;
  calibrationValidUntil: string;
}

export function InstrumentsManager({ initialInstruments = [] }: { initialInstruments?: Omit<InstrumentItem, 'id'>[] }) {
  const [instruments, setInstruments] = useState<InstrumentItem[]>(
    initialInstruments.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );

  const add = () => setInstruments([...instruments, { id: crypto.randomUUID(), name: "", serialNo: "", calibrationNo: "", calibrationValidUntil: "" }]);
  const update = (id: string, key: keyof InstrumentItem, value: string) => {
    setInstruments(instruments.map((i) => (i.id === id ? { ...i, [key]: value } : i)));
  };
  const remove = (id: string) => setInstruments(instruments.filter((i) => i.id !== id));

  return (
    <div className="mt-8 space-y-4">
      <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
        <Gauge size={16} className="text-volt" aria-hidden /> Przyrządy pomiarowe
      </h2>
      <p className="text-[12.5px] text-dim">
        Zdefiniuj używane mierniki. Data ważności świadectwa wzorcowania będzie weryfikowana podczas generowania raportów.
      </p>

      {instruments.map((inst, index) => (
        <div key={inst.id} className="hairline rounded-xl p-4 bg-panel2 relative">
          <button type="button" onClick={() => remove(inst.id)} className="absolute top-4 right-4 text-faint hover:text-crit transition-colors">
            <Trash2 size={15} />
          </button>
          <div className="grid sm:grid-cols-2 gap-4 pr-6">
            <div className="field">
              <label>Nazwa i typ (np. Sonel MPI-535)</label>
              <input className="input" value={inst.name} onChange={(e) => update(inst.id, "name", e.target.value)} required />
            </div>
            <div className="field">
              <label>Numer seryjny</label>
              <input className="input num-mono" value={inst.serialNo} onChange={(e) => update(inst.id, "serialNo", e.target.value)} required />
            </div>
            <div className="field">
              <label>Nr świadectwa wzorcowania</label>
              <input className="input num-mono" value={inst.calibrationNo} onChange={(e) => update(inst.id, "calibrationNo", e.target.value)} required />
            </div>
            <div className="field">
              <label>Ważne do</label>
              <input type="date" className="input num-mono" value={inst.calibrationValidUntil} onChange={(e) => update(inst.id, "calibrationValidUntil", e.target.value)} required />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={add} className="btn btn-ghost btn-sm mt-2">
        <Plus size={15} /> Dodaj miernik
      </button>

      {/* Hidden input to pass data to server action */}
      <input type="hidden" name="instruments" value={JSON.stringify(instruments.map(({ id, ...rest }) => rest))} />
    </div>
  );
}
