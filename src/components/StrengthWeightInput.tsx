import { useEffect, useRef, useState } from 'react';
import type { WeightUnit } from '../i18n';
import { parseDecimalInput, toDisplayWeight, toStoredWeight, convertWeightInput } from '../weightUnits';

// Keep the draft alive while typing: changing a saved weight must never remount
// the input, drop focus, or turn a decimal separator into an unrelated value.
export function StrengthWeightInput({ weight, unit, disabled, label, onChange, onCommit }: {
  weight:number;unit:WeightUnit;disabled:boolean;label:string;
  onChange:(weight:number)=>void;onCommit:(weight:number)=>void;
}) {
  const [draft,setDraft]=useState(String(toDisplayWeight(weight,unit)));
  const focused=useRef(false);
  const previousUnit=useRef(unit);
  useEffect(()=>{
    if(previousUnit.current!==unit){const from=previousUnit.current;setDraft(value=>convertWeightInput(value,from,unit));previousUnit.current=unit;}
    else if(!focused.current)setDraft(String(toDisplayWeight(weight,unit)));
  },[weight,unit]);
  return <input aria-label={label} type="text" inputMode="decimal" disabled={disabled} value={draft}
    onFocus={()=>{focused.current=true;}}
    onChange={event=>{const value=event.target.value;setDraft(value);const parsed=parseDecimalInput(value);if(Number.isFinite(parsed)&&parsed>=0&&parsed<=toDisplayWeight(2000,unit))onChange(toStoredWeight(parsed,unit));}}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}}}
    onBlur={()=>{focused.current=false;const parsed=parseDecimalInput(draft);if(Number.isFinite(parsed)&&parsed>=0&&parsed<=toDisplayWeight(2000,unit)){setDraft(String(parsed));onCommit(toStoredWeight(parsed,unit));}else setDraft(String(toDisplayWeight(weight,unit)));}}/>;
}
