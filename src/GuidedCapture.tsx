import { useEffect, useRef, useState } from 'react';
import { imageFromFile, rotateImage } from './scanner';
import { clampArea, captureLabels, defaultAreas, type Area, type Areas, type Capture, type CaptureKind, type CaptureMatch } from './domain/captures';
export function makeCapture(image: string, kind: CaptureKind = 'full', id: string = crypto.randomUUID()): Capture {
  const areas: Areas = structuredClone(defaultAreas);
  if (kind !== 'full') areas[kind] = { x: 0, y: 0, width: 1, height: 1 };
  return { id, image, kind, areas };
}
type Props = { captures: Capture[]; onChange: (captures: Capture[]) => void; status?: CaptureMatch; disabled: boolean; stamp: string; onStamp: (value: string) => void; onOpening: (value: boolean) => void; onScan: () => void };
export default function GuidedCapture({ captures, onChange, status, disabled, stamp, onStamp, onOpening, onScan }: Props) {
  const [selected, setSelected] = useState(captures[0].id), [region, setRegion] = useState<'name' | 'number' | 'stamp'>('name');
  const [kind, setKind] = useState<CaptureKind>('number'), [opening, setOpening] = useState(false), [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const camera = useRef<HTMLInputElement>(null), upload = useRef<HTMLInputElement>(null);
  const intent = useRef<{ replace?: string; kind: CaptureKind }>({ kind: 'number' });
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; onOpening(false); }, [onOpening]);
  const shot = captures.find(c => c.id === selected) || captures[0];
  const activeRegion = shot.kind === 'full' ? region : shot.kind;
  const blocked = disabled || opening;
  const keys = shot.kind === 'full' ? ['name', 'number', 'stamp'] as const : [shot.kind];
  function changeArea(area: Area) { onChange(captures.map(c => c.id === shot.id ? { ...c, areas: { ...c.areas, [activeRegion]: clampArea(area) } } : c)); }
  async function receive(file?: File) {
    if (!file) return;
    const task = ++generation.current; setOpening(true); onOpening(true); setError('');
    try {
      const image = await imageFromFile(file);
      if (task !== generation.current) return;
      const next = makeCapture(image, intent.current.kind, intent.current.replace);
      const updated = intent.current.replace ? captures.map(c => c.id === intent.current.replace ? next : c) : [...captures, next];
      if (updated.length > 4 || updated.reduce((size, c) => size + c.image.length, 0) > 80 * 1024 * 1024) throw new Error('Keep up to four photos (60 MB total) in one scan. Remove or replace a photo to continue.');
      onChange(updated); setSelected(next.id); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this photo.'); }
    finally { if (task === generation.current) { setOpening(false); onOpening(false); } }
  }
  function pick(useCamera: boolean, replace = false) { intent.current = { kind: replace ? shot.kind : kind, replace: replace ? shot.id : undefined }; (useCamera ? camera : upload).current?.click(); }
  const color = (key: string) => status?.conflict ? 'problem' : key === 'stamp' ? stamp === 'unknown' ? 'unchecked' : 'confirmed' : !status ? 'unchecked' : key === 'name' ? status.nameFound && !status.approximate ? 'read' : 'uncertain' : status.numberFound ? 'read' : 'uncertain';
  const label = (key: string) => key === 'stamp' ? stamp === 'unknown' ? 'Stamp: check visually' : stamp === 'present' ? 'Stamp: present (you confirmed)' : 'Stamp: absent (you confirmed)' : status?.conflict ? `${key}: conflicting readings` : !status ? `${key}: not checked` : key === 'name' ? status.nameFound ? status.approximate ? 'Possible name: compare carefully' : 'Name found' : 'Name: add a close-up' : status.numberFound ? `Number read: ${status.number}` : 'Number: add a close-up';
  return <section className="guided-capture" aria-label="Photos of this card" aria-busy={opening}>
    <div className="guided-heading"><strong>Photos of this card</strong><span>{captures.length} / 4</span></div>
    <button className="primary guided-identify" disabled={blocked} onClick={onScan}>Identify card</button>
    <div className="capture-strip">{captures.map((c, i) => <button disabled={blocked} key={c.id} aria-pressed={shot.id === c.id} onClick={() => { setSelected(c.id); setEditing(false); }} aria-label={`View photo ${i + 1}: ${captureLabels[c.kind]}`}><img src={c.image} alt=""/><span>{i + 1}. {captureLabels[c.kind]}</span></button>)}</div>
    <div className="reading-photo"><img className="photo-preview" src={shot.image} alt="Your captured card"/>
      <svg className="area-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{keys.map(key => { const a = shot.areas[key]; return <rect key={key} className={`area ${color(key)}`} x={a.x * 100} y={a.y * 100} width={a.width * 100} height={a.height * 100} vectorEffect="non-scaling-stroke"/>; })}</svg>
      {keys.map(key => <span key={key} className="area-label" style={{ left: `${shot.areas[key].x * 100}%`, top: `${shot.areas[key].y * 100}%` }}>{key === 'number' ? 'Number / set' : key === 'name' ? 'Name' : 'Stamp'}</span>)}
    </div>
    <div className="reading-status" aria-label="Reading status">{keys.map(key => <span key={key} className={color(key)}>{color(key) === 'read' ? '✓ ' : color(key) === 'uncertain' ? '! ' : '○ '}{label(key)}</span>)}</div>
    <p className="guided-note">Colors show readings across these photos, not a guarantee of sharpness. The boxes are suggested areas; adjust them to fit your card. Stamps are checked by you.</p>
    {status && !status.conflict && <p className="capture-guidance" role="status">{!status.nameFound ? 'Take a closer photo of the name at the top of this same card.' : !status.numberFound ? 'We have a name. Take a closer photo of the collector number and set information along the bottom edge.' : 'Name and number agree with a catalog candidate. Compare the artwork, set, and printing before choosing.'}</p>}
    {status?.conflict && <p className="capture-guidance problem" role="alert">{status.conflict}</p>}
    <details open={editing} onToggle={e => setEditing(e.currentTarget.open)}><summary>Adjust reading areas</summary>
      {shot.kind === 'full' && <label>Area to adjust<select disabled={blocked} value={region} onChange={e => setRegion(e.target.value as typeof region)}><option value="name">Name</option><option value="number">Collector number / set</option><option value="stamp">Stamp</option></select></label>}
      <p className="guided-note">Move and resize the box around the printed detail. New close-ups start with the whole image selected.</p>
      {(['x', 'y', 'width', 'height'] as const).map(key => <label className="area-slider" key={key}>{({ x: 'Left', y: 'Top', width: 'Width', height: 'Height' })[key]}<input disabled={blocked} aria-label={`${activeRegion} area ${key}`} type="range" min={key === 'x' || key === 'y' ? 0 : 5} max="100" value={Math.round(shot.areas[activeRegion][key] * 100)} onChange={e => changeArea({ ...shot.areas[activeRegion], [key]: Number(e.target.value) / 100 })}/><output>{Math.round(shot.areas[activeRegion][key] * 100)}%</output></label>)}
    </details>
    <div className="shot-actions"><button className="secondary" disabled={blocked} onClick={() => pick(false, true)}>Replace photo</button><button className="secondary" disabled={blocked} onClick={async () => { const task = ++generation.current; setOpening(true); onOpening(true); try { const image = await rotateImage(shot.image); if (task !== generation.current) return; onChange(captures.map(c => c.id === shot.id ? makeCapture(image, c.kind, c.id) : c)); } catch { setError('Could not rotate this photo.'); } finally { if (task === generation.current) { setOpening(false); onOpening(false); } } }}>Rotate photo</button>{shot.id !== captures[0].id && <button className="secondary" disabled={blocked} onClick={() => { onChange(captures.filter(c => c.id !== shot.id)); setSelected(captures[0].id); }}>Remove photo</button>}</div>
    <div className="add-capture"><label>Next photo<select disabled={blocked} value={kind} onChange={e => setKind(e.target.value as CaptureKind)}><option value="number">Number close-up</option><option value="name">Name close-up</option><option value="stamp">Stamp close-up</option><option value="full">Another full-card photo</option></select></label><p className="guided-note">Photograph the same card. Fill the frame with {kind === 'number' ? 'the collector number, including both sides of the slash' : kind === 'name' ? 'the complete name, including ex / V / X / Y' : kind === 'stamp' ? 'the stamp, if present' : 'the full card'}. Tilt slightly to avoid glare; tap the printed detail to focus.</p><div className="shot-actions"><button className="secondary" disabled={blocked || captures.length >= 4} onClick={() => pick(true)}>Take close-up</button><button className="secondary" disabled={blocked || captures.length >= 4} onClick={() => pick(false)}>Upload another photo</button></div></div>
    <label className="stamp-check">Does this card have a stamp?<select disabled={blocked} value={stamp} onChange={e => onStamp(e.target.value)}><option value="unknown">Not checked yet</option><option value="present">Yes, a stamp is present</option><option value="absent">No stamp visible</option></select></label>
    <input ref={camera} className="visually-hidden" type="file" accept="image/*" capture="environment" aria-label="Take supplemental card photo" onChange={e => { const input = e.currentTarget; void receive(input.files?.[0]).finally(() => { input.value = ''; }); }}/>
    <input ref={upload} className="visually-hidden" type="file" accept="image/*" aria-label="Upload supplemental card photo" onChange={e => { const input = e.currentTarget; void receive(input.files?.[0]).finally(() => { input.value = ''; }); }}/>
    {opening && <p role="status">Opening photo…</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
