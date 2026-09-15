"use client";

export function HeightInput({ value, unit, onChange, onUnitChange }: {
  value: string;
  unit: "cm" | "ft";
  onChange: (value: string) => void;
  onUnitChange: (unit: "cm" | "ft") => void;
}) {
  const totalInches = value ? Math.round(Number(value) / 2.54) : 0;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  function updateImperial(ft: number, inch: number) {
    const total = ft * 12 + inch;
    onChange(total ? String(Math.round(total * 2.54 * 100) / 100) : "");
  }
  return <fieldset className="height-input">
    <legend>Height</legend>
    <label className="field">Units<select value={unit} onChange={e => onUnitChange(e.target.value as "cm" | "ft")}><option value="cm">Centimeters</option><option value="ft">Feet & inches</option></select></label>
    {unit === "cm" ? <label className="field">Centimeters<input type="number" inputMode="decimal" min="90" max="230" step="any" value={value} onChange={e => onChange(e.target.value)} placeholder="e.g. 170" /></label> : <div className="height-imperial">
      <label className="field">Feet<input type="number" inputMode="numeric" min="0" max="8" step="1" value={value ? feet : ""} placeholder="5" onChange={e => {const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=8)updateImperial(n,inches);}} /></label>
      <label className="field">Inches<input type="number" inputMode="numeric" min="0" max="11" step="1" value={value ? inches : ""} placeholder="7" onChange={e => {const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=11)updateImperial(feet,n);}} /></label>
    </div>}
  </fieldset>;
}
