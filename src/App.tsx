import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, Camera, Check, ChevronLeft, ExternalLink, Focus, ImagePlus, Info, LoaderCircle, RefreshCw, RotateCw, ScanLine, Search, ShieldCheck, Sparkles, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { getCard, getCatalog, resetCatalogMemory } from './providers/tcgdex';
import { matchRead, money, quoteFor, searchCatalog, soldSearch, variantLabels, variantsFor, type CardBrief } from './domain/cards';
import { cancelRecognition, imageFromFile, recognize, rotateImage } from './scanner';
import { clearCache } from './storage';

type LoadedCard = Awaited<ReturnType<typeof getCard>>;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
export default function App() {
  const [mode, setMode] = useState<'scan' | 'search'>('scan');
  const [query, setQuery] = useState(''); const [number, setNumber] = useState(''); const [setCode, setSetCode] = useState('');
  const [candidates, setCandidates] = useState<CardBrief[]>([]); const [searched, setSearched] = useState(false);
  const [scanNumber, setScanNumber] = useState(''); const [visibleLimit, setVisibleLimit] = useState(12);
  const filteredCandidates = mode === 'scan' && scanNumber.trim() ? searchCatalog(candidates, '', scanNumber) : candidates;
  const visibleCandidates = filteredCandidates.slice(0, visibleLimit);
  const [result, setResult] = useState<LoadedCard>(); const [variant, setVariant] = useState(''); const [edition, setEdition] = useState('');
  const [photo, setPhoto] = useState(''); const [camera, setCamera] = useState(false); const [cameraStarting, setCameraStarting] = useState(false);
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [scanDebug, setScanDebug] = useState('');
  const [about, setAbout] = useState(false); const [online, setOnline] = useState(navigator.onLine);
  const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null); const fileInput = useRef<HTMLInputElement>(null);
  const systemPhotoInput = useRef<HTMLInputElement>(null);
  const useSystemPhoto = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const operation = useRef(0); const request = useRef<AbortController | null>(null); const cameraGeneration = useRef(0); const details = useRef<HTMLElement>(null);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  const card = result?.card; const variants = card ? variantsFor(card) : []; const quote = card ? quoteFor(card, variant, edition) : undefined;
  const confirmed = !!variant && variant !== 'stamped' && (!card?.variants?.firstEdition || !!edition);

  useEffect(() => {
    if (!about) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAbout(false);
      if (event.key === 'Tab') {
        const controls = [...document.querySelectorAll<HTMLElement>('.modal button, .modal a')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [about]);

  function stopCamera() { cameraGeneration.current++; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCamera(false); setCameraStarting(false); }
  function cancel() { operation.current++; request.current?.abort(); void cancelRecognition(); setBusy(''); }
  useEffect(() => {
    const status = () => setOnline(navigator.onLine); const hidden = () => { if (document.hidden) stopCamera(); };
    window.addEventListener('online', status); window.addEventListener('offline', status); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('online', status); window.removeEventListener('offline', status); document.removeEventListener('visibilitychange', hidden); stream.current?.getTracks().forEach(track => track.stop()); request.current?.abort(); void cancelRecognition(); };
  }, []);
  useEffect(() => { if (camera && video.current && stream.current) { video.current.srcObject = stream.current; void video.current.play().catch(() => { setError('Tap Start camera again to resume the preview.'); stopCamera(); }); } }, [camera]);

  async function startCamera() {
    stopCamera(); cancel(); setError(''); setPhoto(''); setCameraStarting(true); const token = ++cameraGeneration.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS and a supported browser. You can upload a photo instead.');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (token !== cameraGeneration.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; setCamera(true);
    } catch { if (token === cameraGeneration.current) setError('Camera unavailable. Allow camera access in your browser settings, or upload a photo.'); }
    finally { if (token === cameraGeneration.current) setCameraStarting(false); }
  }
  function capture() {
    const v = video.current; if (!v?.videoWidth) { setError('The camera is still warming up. Try again in a moment.'); return; }
    // Match the visible object-fit: cover preview, then crop to its card guide.
    const box = v.getBoundingClientRect(); const scale = Math.max(box.width / v.videoWidth, box.height / v.videoHeight);
    const shownWidth = box.width / scale; const shownHeight = box.height / scale;
    const guideWidth = Math.min(box.width * .62, 230); const guideHeight = guideWidth * 1.4;
    const sw = guideWidth / scale; const sh = guideHeight / scale;
    const sx = (v.videoWidth - shownWidth) / 2 + (shownWidth - sw) / 2; const sy = (v.videoHeight - shownHeight) / 2 + (shownHeight - sh) / 2;
    const canvas = document.createElement('canvas'); canvas.width = Math.round(sw); canvas.height = Math.round(sh);
    canvas.getContext('2d')!.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL('image/jpeg', .95)); stopCamera();
  }
  async function upload(file?: File) {
    if (!file) return; cancel(); stopCamera(); setError(''); const token = operation.current; setBusy('Opening photo…');
    try { const data = await imageFromFile(file); if (token === operation.current) { setPhoto(data); setMode('scan'); } }
    catch (e) { if (token === operation.current) setError(errorMessage(e)); }
    finally { if (token === operation.current) setBusy(''); }
  }
  async function scan() {
    cancel(); setScanDebug(''); const token = operation.current; setScanNumber(''); setVisibleLimit(12); setError(''); setNotice(''); setResult(undefined); setCandidates([]); setSearched(false); setBusy('Preparing on-device scanner…');
    try {
      const reading = await recognize(photo, value => { if (token === operation.current) setBusy(value); });
      if (token !== operation.current) return; setBusy('Finding matching cards…');
      const catalog = await getCatalog(); if (token !== operation.current) return;
      setScanDebug(`Version 0.1.1\nReliable text:\n${reading.text.trim() || '(none)'}\nFallback text:\n${reading.fallbackText?.trim() || '(none)'}`);
      const matched = matchRead(catalog, reading); const { matches } = matched; setCandidates(matches); setSearched(true);
      setNotice(matches.length ? matched.approximate ? 'Possible name matches only. We couldn’t verify the card number. Compare the artwork, set, and full printed number before choosing a card.' : /\b[A-Z]{0,4}\d{1,3}\s*\/\s*[A-Z]{0,4}\d{1,3}\b/i.test(matched.text) ? 'These are suggested matches. Check the set and card number before choosing.' : 'We found a name but couldn’t read the card number. Enter the number below to narrow the matches, then compare the artwork and set.' : 'We couldn’t find a clear match. Try a closer photo with less glare, or search by name and number.');
    } catch (e) { if (token === operation.current) setError(errorMessage(e)); }
    finally { if (token === operation.current) setBusy(''); }
  }
  async function search(event: FormEvent) {
    event.preventDefault(); cancel(); const token = operation.current; setError(''); setNotice(''); setResult(undefined); setCandidates([]); setBusy('Searching the English catalog…');
    try { const catalog = await getCatalog(); if (token !== operation.current) return; const matches = searchCatalog(catalog, query, number, setCode); setCandidates(matches.slice(0, 60)); setSearched(true); if (matches.length > 60) setNotice(`${matches.length} matches. Showing the first 60; add a card number or set code to narrow your search.`); }
    catch (e) { if (token === operation.current) setError(errorMessage(e)); }
    finally { if (token === operation.current) setBusy(''); }
  }
  async function select(id: string, refresh = false) {
    cancel(); const token = operation.current; const controller = new AbortController(); request.current = controller; setError(''); setBusy(refresh ? 'Refreshing price…' : 'Getting card details…');
    if (!refresh) { setVariant(''); setEdition(''); setResult(undefined); }
    try { const data = await getCard(id, controller.signal, refresh); if (token !== operation.current) return; setResult(data); setTimeout(() => details.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }
    catch (e) { if (token === operation.current) setError(errorMessage(e)); }
    finally { if (token === operation.current) setBusy(''); }
  }
  function changeMode(next: 'scan' | 'search') { setScanNumber(''); setVisibleLimit(12); cancel(); stopCamera(); setMode(next); setError(''); setNotice(''); setCandidates([]); setSearched(false); setPhoto(''); }
  function newScan() { setScanNumber(''); setVisibleLimit(12); cancel(); stopCamera(); setMode('scan'); setResult(undefined); setCandidates([]); setPhoto(''); setNotice(''); setError(''); setSearched(false); setVariant(''); setEdition(''); }

  return <div className="app">
    <header className="header"><a className="brand" href={import.meta.env.BASE_URL} aria-label="Goozemon home"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" /><span>goozemon<span className="brand-dot">.</span></span></a><div className="header-right"><span className="free-label"><span /> Free for collectors</span><button className="icon-button" onClick={() => setAbout(true)} aria-label="About and install"><Info size={20}/></button></div></header>
    <main>
      <section className="intro"><div><div className="eyebrow"><span className="tiny-line"/> THE COLLECTOR’S COMPANION</div><h1>Every card has<br/>a <span>story to discover.</span></h1><p>Scan a Pokémon card. Find its details.<br className="mobile-break"/> Know what makes it special.</p></div><div className="intro-note"><div className="mini-cards"><span/><span/><span><Sparkles size={27}/></span></div><p>A little curiosity.<br/><strong>Your next great find.</strong></p></div></section>
      {!online && <div className="banner"><WifiOff size={18}/> You’re offline. Saved details may be available; fresh prices need a connection.</div>}
      {needRefresh && !busy && !camera && <div className="banner">A new version is ready.<button onClick={() => void updateServiceWorker(true)}>Update app</button><button aria-label="Dismiss update" onClick={() => setNeedRefresh(false)}><X size={16}/></button></div>}
      <div className="workspace">
        <section className="scanner-panel" aria-label="Card scanner">
          <div className="panel-heading"><div><span className="step-number">01</span><h2>Find your card</h2></div><span className="pill">ENGLISH · USD</span></div>
          <div className="tabs" role="tablist" aria-label="Lookup method"><button role="tab" aria-selected={mode === 'scan'} onClick={() => changeMode('scan')}><ScanLine size={17}/> Scan a card</button><button role="tab" aria-selected={mode === 'search'} onClick={() => changeMode('search')}><Search size={17}/> Search manually</button></div>
          {mode === 'scan' ? <>
            <div className={`viewfinder ${photo ? 'has-photo' : ''}`}>
              {camera ? <><video ref={video} autoPlay playsInline muted aria-label="Camera preview"/><div className="camera-guide"><i/><i/><i/><i/></div><span className="viewfinder-caption">Fit the whole card inside the frame</span></> : photo ? <img className="photo-preview" src={photo} alt="Your captured card"/> : <><div className="viewfinder-grid"/><div className="card-outline"><span className="corner tl"/><span className="corner tr"/><span className="corner bl"/><span className="corner br"/><div className="card-art"><Sparkles size={30}/><span>YOUR NEXT<br/>DISCOVERY</span><div className="art-lines"><i/><i/><i/></div></div></div><div className="finder-copy"><h3>A new perspective on your cards.</h3><p>One card. A clear photo. Let’s take a look.</p></div></>}
              <span className="finder-status"><span/> {camera ? 'CAMERA LIVE' : photo ? 'READY TO IDENTIFY' : 'ON-DEVICE SCANNING'}</span>
            </div>
            {busy ? <div className="progress" role="status"><LoaderCircle className="spin" size={19}/><span>{busy}</span><button onClick={cancel}>Cancel</button></div> : <div className="capture-actions">{camera ? <><button className="primary" onClick={capture}><Camera size={19}/> Capture card</button><button className="secondary" onClick={stopCamera}>Close camera</button></> : photo ? <><button className="primary" onClick={() => void scan()}><ScanLine size={19}/> Identify card <ArrowRight size={17}/></button><div className="photo-tools"><button className="secondary" onClick={async () => { try { setPhoto(await rotateImage(photo)); } catch { setError('Could not rotate this image.'); } }}><RotateCw size={16}/> Rotate</button><button className="secondary" onClick={() => setPhoto('')}>Retake</button></div></> : <><button className="primary" onClick={() => useSystemPhoto ? systemPhotoInput.current?.click() : void startCamera()} disabled={cameraStarting}>{cameraStarting ? <LoaderCircle className="spin" size={19}/> : <Camera size={19}/>} {cameraStarting ? 'Opening camera…' : useSystemPhoto ? 'Take photo' : 'Start camera'}<ArrowRight size={17}/></button><button className="secondary" onClick={() => fileInput.current?.click()}><ImagePlus size={18}/> Upload photo</button></>}</div>}
            {useSystemPhoto && !photo && !camera && !busy && <button className="live-camera-alternative" onClick={() => void startCamera()} disabled={cameraStarting}>Use live camera instead</button>}
            <input className="visually-hidden" ref={systemPhotoInput} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-label="Take card photo" onChange={e => { const input = e.currentTarget; void upload(input.files?.[0]).finally(() => { input.value = ''; }); }}/>
            <input className="visually-hidden" ref={fileInput} type="file" accept="image/*" aria-label="Upload card photo" onChange={e => { const input = e.currentTarget; void upload(input.files?.[0]).finally(() => { input.value = ''; }); }}/>
            <div className="scan-tips"><span><Focus size={16}/> Fill the frame</span><span><Sparkles size={16}/> Avoid glare</span><span><ShieldCheck size={16}/> Photos stay private</span></div>
          </> : <form className="search-form" onSubmit={search}><div className="search-illustration"><Search size={30}/></div><h3>Find a familiar face.</h3><p>A name gets you started. A card number gets you closer.</p><label>Card name<input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Charizard"/></label><div className="form-row"><label>Card number<input value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 136 or 136/189"/></label><label>Set code <span>(optional)</span><input value={setCode} onChange={e => setSetCode(e.target.value)} placeholder="e.g. swsh3"/></label></div><button className="primary" disabled={!!busy || (!query.trim() && !number.trim() && !setCode.trim())}>{busy ? <LoaderCircle size={18} className="spin"/> : <Search size={18}/>} {busy || 'Find matching cards'}<ArrowRight size={17}/></button><p className="form-footnote">English Pokémon, Trainer, and Energy cards.</p></form>}
          {error && <div className="error" role="alert">{error}</div>}
          {notice && <div className="notice" role="status">{notice}</div>}
          {mode === 'scan' && searched && !candidates.length && scanDebug && <details><summary>Scan troubleshooting details</summary><p>This text stays on your device. Include it when reporting a failed scan.</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{scanDebug}</pre></details>}
          {searched && !busy && <div className="matches">{mode === 'scan' && candidates.length > 0 && <label className="scan-refine">Card number (before /)<input value={scanNumber} onChange={e => { setScanNumber(e.target.value); setVisibleLimit(12); }} placeholder="e.g. 57 or SV001" autoComplete="off"/></label>}<div className="matches-heading"><h3>{candidates.length ? 'Choose your match' : 'No matches yet'}</h3><span>{filteredCandidates.length ? `${Math.min(visibleLimit, filteredCandidates.length)} of ${filteredCandidates.length} results` : 'No matching number'}</span></div>{visibleCandidates.map(c => <button className={`match ${card?.id === c.id ? 'selected' : ''}`} key={c.id} onClick={() => void select(c.id)}>{c.image ? <img loading="lazy" src={`${c.image}/low.webp`} alt=""/> : <span className="no-thumb"><ScanLine size={18}/></span>}<span><strong>{c.name}</strong><small>#{c.localId} · {c.id.slice(0, c.id.lastIndexOf('-')).toUpperCase()}</small></span>{card?.id === c.id ? <Check size={18}/> : <ArrowRight size={17}/>}</button>)}{filteredCandidates.length > visibleLimit && <button className="secondary show-more" onClick={() => setVisibleLimit(limit => limit + 12)}>Show more matches</button>}</div>}
        </section>
        <section className={`details-panel ${card ? 'has-result' : ''}`} ref={details} aria-label="Card details">
          <div className="panel-heading"><div><span className="step-number">02</span><h2>Your discovery</h2></div>{card && <button className="icon-button" onClick={newScan} aria-label="Scan another card"><RefreshCw size={18}/></button>}</div>
          {card ? <div className="result"><div className="result-hero">{card.image && <img src={`${card.image}/high.webp`} alt={`${card.name} from ${card.set.name}`} onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/>}<div><span className="eyebrow">{card.category || 'POKÉMON TCG'}</span><h2>{card.name}</h2><p>{card.set.name}</p><span className="number-tag">#{card.localId}{card.set.cardCount?.official ? ` / ${card.set.cardCount.official}` : ''}</span></div></div><div className="card-facts"><div><span>Rarity</span><strong>{card.rarity || 'Not listed'}</strong></div><div><span>{card.hp ? 'HP · Type' : 'Card type'}</span><strong>{card.hp ? `${card.hp} · ${card.types?.join(', ') || '—'}` : card.category || '—'}</strong></div>{card.illustrator && <div className="artist"><span>Illustrated by</span><strong>{card.illustrator}</strong></div>}</div>
            <div className="printing"><label htmlFor="printing">Confirm your printing</label><select id="printing" value={variant} onChange={e => setVariant(e.target.value)}><option value="">Select the finish on your card</option>{variants.map(v => <option key={v} value={v}>{variantLabels[v] || v}</option>)}<option value="stamped">Stamped / special reprint</option></select>{!variants.length && <p>No supported printings are listed for this card.</p>}{card.variants?.firstEdition && <><label htmlFor="edition">Confirm the edition</label><select id="edition" value={edition} onChange={e => setEdition(e.target.value)}><option value="">Choose the edition</option><option value="unlimited">Unlimited</option><option value="first">First edition</option></select></>}<p>Compare the set, number, and finish with your card. For a pumpkin or other promotional stamp, choose Stamped / special reprint.</p></div>
            <div className="value-heading"><h3>Market references</h3><span>USD</span></div><div className="raw-price"><div><span>RAW CARD</span><strong>{confirmed && quote?.cents !== null && quote?.cents !== undefined ? money(quote.cents) : '—'}</strong><small>{variant === 'stamped' ? 'Stamped reprint price unavailable' : confirmed ? 'TCGplayer Market · via TCGdex' : 'Choose a printing above'}</small></div><span className="market-icon"><ArrowDown size={22}/></span></div>{(confirmed || variant === 'stamped') && <p className="price-note">{quote?.reason || 'A reference for this printing. Your card’s condition can affect its value.'}</p>}
            <div className="graded-prices">{([9, 10] as const).map(grade => <div key={grade}><span className="grade-label">PSA <b>{grade}</b></span><strong>Unavailable</strong><small>Verified price feed coming next</small>{confirmed && <a href={soldSearch(card, variant, grade, edition)} target="_blank" rel="noreferrer">View sold listings <ExternalLink size={12}/></a>}</div>)}</div><p className="price-note">PSA references compare already-graded cards. Scanning does not predict a grade.</p>
            <div className="price-meta"><span>{quote?.updated ? `Source updated ${new Date(quote.updated).toLocaleDateString()}` : 'Source update time unavailable'}{quote?.updated && Date.now() - Date.parse(quote.updated) > 48 * 3600_000 ? ' · Stale' : ''}</span><span>{result?.cached ? 'Cached lookup' : 'Online lookup'} · {new Date(result!.fetchedAt).toLocaleString()}</span>{result?.refreshFailed && <span className="warning">Refresh failed. Showing saved details.</span>}<button onClick={() => void select(card.id, true)} disabled={!!busy || !online}><RefreshCw size={13}/> Refresh price</button></div>{confirmed && quote?.productId && <a className="market-link" href={`https://www.tcgplayer.com/product/${quote.productId}`} target="_blank" rel="noreferrer">Inspect on TCGplayer <ExternalLink size={15}/></a>}<button className="secondary scan-again" onClick={newScan}><ScanLine size={17}/> Scan another card</button></div> : <div className="empty-result"><div className="empty-card"><span/><ScanLine size={35}/><span/></div><h3>Meet your next discovery.</h3><p>Your card’s details and market<br/>references will appear here.</p><div className="empty-steps"><span><Check size={14}/> Exact card & set</span><span><Check size={14}/> Printing-specific prices</span><span><Check size={14}/> PSA sold comparisons</span></div><div className="empty-bottom"><span className="small-star">✦</span><p>Made for the joy of collecting.</p></div></div>}
        </section>
      </div>
      <section className="how-it-works"><div><span className="eyebrow">A CLOSER LOOK, IN THREE STEPS</span><h2>From a card to a discovery.</h2></div><div className="how-step"><span>01</span><div><h3>Capture</h3><p>Frame one card or upload a photo.</p></div></div><div className="how-step"><span>02</span><div><h3>Confirm</h3><p>Check the set, number, and finish.</p></div></div><div className="how-step"><span>03</span><div><h3>Discover</h3><p>Explore details and market references.</p></div></div></section>
    </main>
    <footer><span className="footer-brand">goozemon.</span><p>For collectors, by a collector. No account needed.</p><button onClick={() => setAbout(true)}>About & privacy <ArrowRight size={13}/></button></footer>
    {about && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setAbout(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><button autoFocus className="icon-button close-modal" onClick={() => setAbout(false)} aria-label="Close information"><X size={20}/></button><div className="eyebrow">YOUR POCKET COMPANION</div><h2 id="about-title">Hello, Goozemon.</h2><p>A free, independent Pokémon card scanner. Your photos are processed on your device and discarded when you start a new scan. We cache public card details and prices locally.</p><h3>Make yourself at home</h3><p>On iPhone, open in Safari and choose Share → Add to Home Screen. On Chrome or Edge, use the browser’s install-app action when available.</p><h3>A little transparency</h3><p>Card details and raw prices come from TCGdex and TCGplayer. These services receive normal web requests. No account, photo uploads, or tracking analytics. PSA sold searches open eBay; automatic graded prices are not connected yet.</p><p>Goozemon is not affiliated with Pokémon, Nintendo, TCGplayer, or PSA. Card artwork belongs to its respective owners. Source code is MIT licensed.</p><button className="secondary" onClick={async () => { try { await clearCache(); resetCatalogMemory(); setNotice('Cached card data cleared.'); setResult(undefined); setCandidates([]); setSearched(false); setAbout(false); } catch { setError('Browser storage could not be cleared. Use your browser’s site settings.'); setAbout(false); } }}>Clear cached card data</button><small>Version 0.1.1 · Improved title recognition</small></section></div>}
  </div>;
}
