'use client';

/* eslint-disable @next/next/no-img-element -- consistent with the scene components
   this page composes; a plain <img> keeps this preview honest to what they render. */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import gsap from 'gsap';
import Stage from '@/components/Stage';
import type { Achievement, BuiltSceneId, Composition, Person, Quote, SceneData, Testimonial } from '@/lib/compositions';
import { COMPOSITIONS, isBuiltScene } from '@/lib/compositions';
import { resolveDurationInFrames } from '@/lib/duration';
import { exportSceneToMp4 } from '@/lib/browserExport';
import { SCENES } from '@/scenes';
import { PHOTO_CARDS } from '@/scenes/achievements/geometry';
import { MAX_CARDS as MAX_BIRTHDAY_CARDS } from '@/scenes/birthday/geometry';
import { MAX_PEOPLE as MAX_ANNIVERSARY_PEOPLE } from '@/scenes/anniversary/motion';
import { MAX_SCREENS } from '@/scenes/moments/geometry';
import { MAX_PEOPLE as MAX_JOINEES } from '@/scenes/new-joinee/motion';
import { MAX_TESTIMONIALS } from '@/scenes/feedback/motion';

/**
 * Matches Figma node 3:29778, less the "Achivements" tab.
 *
 * The achievements collage is no longer a video of its own: it is a screen
 * inside Moments, added there with "+ Add achievement". Its composition and
 * scene stay registered — Moments embeds the component directly, and
 * `/render/achievements` still resolves — so this only removes the way in that
 * would now produce a duplicate of something Moments already covers.
 */
const TABS = [
  { id: 'birthday', label: 'Birthday' },
  { id: 'mvp', label: 'MVP' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'moments', label: 'Moments' },
  // No scene built for these three yet, so they fall through to
  // `NotBuiltPlaceholder` — the same path every other tab took before its scene
  // existed. They light up on their own the moment a matching entry appears in
  // COMPOSITIONS; nothing here needs changing.
  { id: 'new-joinee', label: 'New Joinees' },
  { id: 'farewell', label: 'Farewell' },
  { id: 'feedback', label: 'Feedback' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * The two side panes. Stated rather than measured: a measured width would mean
 * the preview jumping sideways on first paint.
 *
 * The stage between them is inset by both, so the frame centres in the middle
 * column rather than on the whole window.
 */
const NAV_PANE = 232;
const FIELDS_PANE = 340;

// Both real scenes render on the same 1080x1920 canvas, so one fit computation
// serves either of them without change.
const PORTRAIT_CANVAS = { w: COMPOSITIONS.achievements.width, h: COMPOSITIONS.achievements.height };

/**
 * The preview's backdrop: a photo of the real screen mounted on an office wall,
 * with the video composited into the screen it actually shows.
 *
 * `plate` is the asset's own pixel size — the coordinate space `window` is
 * measured in. `window` is the screen's solid-black rectangle, found by scanning
 * the image for its darkest contiguous region (threshold 15/255) rather than
 * eyeballed, so the video lands exactly on the screen rather than near it.
 *
 * The plate is cover-scaled into the preview column by `Stage` — the same
 * component every scene uses to fit its own canvas to its container — which
 * centres the PLATE. In the photographer's original framing the screen sat 57px
 * above the plate's centre and 5px left of it, so centring the plate left the
 * template visibly high. The asset is therefore cropped (10px off the right,
 * 114px off the bottom — wall, no subject) so that the plate's centre and the
 * screen's centre are the same point.
 *
 * That crop is why this needs no runtime offset. Nudging the plate instead would
 * have worked at one window size and lifted its edge off the column at others,
 * since the spare width a cover-scale leaves over depends on the column's own
 * aspect ratio. With the screen at the plate's centre, `Stage` centring the
 * plate centres the screen, at every size, for free.
 */
const BACKDROP = {
  src: '/assets/chrome/office-screen.webp',
  plate: { w: 1076, h: 1334 },
  window: { x: 294, y: 235, w: 488, h: 864 },
} as const;

/**
 * The app's home page: whichever scene's tab is active plays its real
 * motion, on a loop, inside the photo-frame's window — demonstrating what
 * the "video plays here in real time" window looks like with actual
 * content, plus a panel to edit that content, preview it live, and export
 * it as an MP4.
 *
 * Deliberately separate from `/render/[scene]`: that route only ever seeks to an
 * explicit frame (never plays) because the headless capture pipeline depends on
 * that determinism. This page plays for real, driven by a plain
 * requestAnimationFrame loop, and never touches the render route or its scenes'
 * source beyond the `data` prop they already accept.
 */
export default function PhotoFramePreviewPage() {
  const [activeTab, setActiveTab] = useState<TabId>('birthday');
  const built = isBuiltScene(activeTab) ? activeTab : null;
  const composition = built ? COMPOSITIONS[built] : null;
  const Scene = built ? SCENES[built] : null;

  const [data, setData] = useState<SceneData>(composition?.defaults ?? EMPTY_DATA);
  const [frame, setFrame] = useState(0);
  const startRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // A dedicated, off-screen, unscaled instance of the scene — never the one
  // playing in the mocked-up frame above, which sits inside a `scale(...)`
  // wrapper for the preview and would otherwise get that scale baked into
  // every captured frame. Only mounted while an export is running, so it
  // isn't idly registering a video seeker (birthday's backdrop) the rest of
  // the time.
  //
  // The job is a *snapshot* taken when the export starts, not a read of live
  // state. The hidden instance used to render straight from `Scene`/`data`,
  // which meant switching tabs mid-export swapped the scene underneath the
  // running capture — the assets were prepared for one scene while later
  // frames serialized another, silently producing a video with every image
  // missing. Freezing the scene, composition and payload for the duration
  // makes that impossible.
  const [exportJob, setExportJob] = useState<{
    Scene: (typeof SCENES)[BuiltSceneId];
    composition: Composition;
    data: SceneData;
    filename: string;
  } | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFrame, setExportFrame] = useState(0);
  const exportNodeRef = useRef<HTMLDivElement | null>(null);
  const exporting = exportJob !== null;

  const handleDownload = async () => {
    if (!built || !composition || !Scene || exporting) return;
    const job = { Scene, composition, data, filename: `${built}.mp4` };
    setExportError(null);
    setExportProgress(0);
    setExportFrame(0);
    // flushSync so the hidden instance is mounted before the ref is read.
    flushSync(() => setExportJob(job));
    try {
      // One frame for layout to settle so measured boxes are real.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const node = exportNodeRef.current;
      if (!node) throw new Error('Export scene not ready');

      const durationInFrames = resolveDurationInFrames(job.composition, job.data);
      const blob = await exportSceneToMp4({
        node,
        width: job.composition.width,
        height: job.composition.height,
        fps: job.composition.fps,
        durationInFrames,
        seekTo: (i) => flushSync(() => setExportFrame(i)),
        onProgress: (done, total) => setExportProgress(Math.round((done / total) * 100)),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = job.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportJob(null);
    }
  };

  // A tab change swaps in a different composition (different duration/fps, a
  // different default payload) — reset both the data and the loop's clock so
  // the new scene starts clean rather than picking up where the last one left
  // its frame index or a field it doesn't even use. Done here, in the handler
  // that actually changes the tab, rather than an effect watching activeTab —
  // this is a direct response to a user action, not a sync with an external system.
  //
  // The swap itself is instant (React just renders different content), so
  // without help it reads as a hard cut. Fading the window out, swapping while
  // it's invisible, then fading the new content in is what makes it read as
  // one thing replacing another instead of a flicker.
  const handleTabChange = (id: TabId) => {
    // Changing scenes mid-export would leave the finished file describing a
    // scene the person is no longer looking at, so the switch simply waits.
    if (id === activeTab || exporting) return;
    const applyChange = () => {
      setActiveTab(id);
      setData((isBuiltScene(id) ? COMPOSITIONS[id] : null)?.defaults ?? EMPTY_DATA);
      startRef.current = null;
      setFrame(0);
    };

    const el = contentRef.current;
    if (!el) {
      applyChange();
      return;
    }
    gsap.to(el, {
      opacity: 0,
      duration: 0.15,
      ease: 'power1.in',
      onComplete: () => {
        applyChange();
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
      },
    });
  };

  // Birthday's carousel runs one card per person, so the loop has to be as long
  // as the payload actually needs — a static length would cut a multi-person
  // clip off partway through.
  const totalFrames = composition ? resolveDurationInFrames(composition, data) : 0;

  useEffect(() => {
    if (!composition || totalFrames < 1) return;
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsedSeconds = (now - startRef.current) / 1000;
      setFrame(Math.floor(elapsedSeconds * composition.fps) % totalFrames);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [composition, totalFrames]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--chrome-stage)', overflow: 'hidden' }}>
      {/* Template list, as its own pane — the mirror of the fields pane on the
          right, down to the fill, the blur and the hairline edge. A vertical list
          is also what lets it grow: seven tabs already overflowed a horizontal
          bar on a narrow window, and there are more scenes to come. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: NAV_PANE,
          zIndex: 2,
          background: 'var(--panel-bg)',
          backdropFilter: 'var(--panel-blur)',
          WebkitBackdropFilter: 'var(--panel-blur)',
          color: 'var(--panel-fg)',
          borderRight: '1px solid var(--panel-edge)',
          padding: 24,
          overflowY: 'auto',
          fontFamily: 'system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Templates</h1>
        <TabSwitcher active={activeTab} onChange={handleTabChange} />
      </div>

      {/* The preview column, between the two panes.
          The whole plate (photo + window cut into it) is one fixed-size
          composition, cover-scaled into the column by `Stage` — the same
          component every scene uses to fit its own canvas to its container. The
          window is positioned in the plate's own pixel space, so it scales and
          moves together with the photo at any column size: that is what keeps
          it locked to the screen rather than drifting to wherever the column's
          own centre happens to be.
          The cost of insetting the column rather than running full-bleed is that
          both side panes now blur flat background rather than artwork, so their
          `backdrop-filter` is inert. Kept anyway: it costs nothing and the panes
          come back to life if the layout ever goes full-bleed again. */}
      <div
        style={{
          position: 'absolute',
          left: NAV_PANE,
          right: FIELDS_PANE,
          top: 0,
          bottom: 0,
          overflow: 'hidden',
        }}
      >
        <Stage width={BACKDROP.plate.w} height={BACKDROP.plate.h}>
          <div style={{ position: 'relative', width: BACKDROP.plate.w, height: BACKDROP.plate.h }}>
            <img
              src={BACKDROP.src}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
            />
            <div
              style={{
                position: 'absolute',
                left: BACKDROP.window.x,
                top: BACKDROP.window.y,
                width: BACKDROP.window.w,
                height: BACKDROP.window.h,
                overflow: 'hidden',
              }}
            >
              <div ref={contentRef} style={{ position: 'absolute', inset: 0 }}>
                {Scene && composition ? (
                  // The window is 488x864 (9:16 to within 0.4%) and every portrait
                  // composition is exactly 9:16, so Stage's cover fit lands with
                  // only that fraction of a percent to crop — invisible in practice.
                  <Stage width={PORTRAIT_CANVAS.w} height={PORTRAIT_CANVAS.h}>
                    <Scene data={data} frame={frame} fps={composition.fps} />
                  </Stage>
                ) : (
                  <NotBuiltPlaceholder label={TABS.find((t) => t.id === activeTab)?.label ?? activeTab} />
                )}
              </div>
            </div>
          </div>
        </Stage>
      </div>

      {exportJob && (
        <div
          style={{
            position: 'fixed',
            left: -99999,
            top: 0,
            width: exportJob.composition.width,
            height: exportJob.composition.height,
          }}
        >
          <div
            ref={exportNodeRef}
            style={{ width: exportJob.composition.width, height: exportJob.composition.height }}
          >
            <exportJob.Scene
              data={exportJob.data}
              frame={exportFrame}
              fps={exportJob.composition.fps}
            />
          </div>
        </div>
      )}

      <ControlPanel
        activeTab={activeTab}
        scene={built}
        data={data}
        onChange={setData}
        downloading={exporting}
        downloadProgress={exportProgress}
        downloadError={exportError}
        onDownload={() => void handleDownload()}
      />
    </div>
  );
}

const EMPTY_DATA: SceneData = { name: '', photoUrl: '', subtitle: '' };

function NotBuiltPlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        background: 'var(--placeholder-bg)',
        color: 'var(--placeholder-fg)',
        fontFamily: 'var(--font-inter), sans-serif',
        fontSize: 15,
        boxSizing: 'border-box',
      }}
    >
      {label} is coming soon
    </div>
  );
}

/**
 * Template list, for the left pane.
 *
 * Descended from Figma node 3:29778's segmented control, but no longer a
 * free-floating pill: inside a pane it would be a container within a container,
 * so it drops its own fill and shadow and takes the pane's type scale. What
 * carries over is the indicator.
 *
 * The white pill is one shared element sliding between tabs, not each button
 * toggling its own background — that's what makes switching read as the
 * indicator *moving* rather than one tab blinking off and another blinking on.
 * Running vertically, it animates `y`/`height` rather than `x`/`width`.
 */
function TabSwitcher({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef(new Map<TabId, HTMLButtonElement>());
  const hasPositioned = useRef(false);

  useEffect(() => {
    const button = buttonRefs.current.get(active);
    const indicator = indicatorRef.current;
    if (!button || !indicator) return;
    const target = { y: button.offsetTop, height: button.offsetHeight };
    if (!hasPositioned.current) {
      // First paint: snap into place rather than sliding in from the corner.
      gsap.set(indicator, target);
      hasPositioned.current = true;
    } else {
      gsap.to(indicator, { ...target, duration: 0.3, ease: 'power2.out' });
    }
  }, [active]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        // `stretch`, so every pill spans the pane and the sliding indicator only
        // ever has to move on one axis.
        alignItems: 'stretch',
      }}
    >
      {/* White, the same as the toggle's selected pill above (`--accent-bg` /
          `--accent-fg`) — one "this is the selected thing" treatment across the
          pane, rather than the nav's own grey indicator reading as a different,
          weaker kind of selection. */}
      <div
        ref={indicatorRef}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          borderRadius: 10,
          background: 'var(--accent-bg)',
          boxShadow: 'var(--nav-shadow)',
        }}
      />
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) buttonRefs.current.set(tab.id, el);
            }}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--accent-fg)' : 'var(--nav-fg-inactive)',
              transition: 'color 0.2s ease',
              fontFamily: 'inherit',
              fontWeight: 500,
              fontSize: 13,
              lineHeight: '20px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

interface ControlPanelProps {
  activeTab: TabId;
  scene: 'birthday' | 'mvp' | 'anniversary' | 'moments' | 'new-joinee' | 'farewell' | 'feedback' | null;
  data: SceneData;
  onChange: (d: SceneData) => void;
  downloading: boolean;
  downloadProgress: number;
  downloadError: string | null;
  onDownload: () => void;
}

/** A plain white card — the carousel's own unfilled-slot look — shown until a
 *  photo is uploaded, so an empty slot never renders a broken image icon. */
const BLANK_SLIDE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='white' stroke='%23ccc'/%3E%3C/svg%3E";

function ControlPanel({
  activeTab,
  scene,
  data,
  onChange,
  downloading,
  downloadProgress,
  downloadError,
  onDownload,
}: ControlPanelProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const set = <K extends keyof SceneData>(key: K, value: SceneData[K]) =>
    onChange({ ...data, [key]: value });

  // The flat name/photoUrl/subtitle fields are the single-person shape every
  // other scene uses; birthday edits the `people` list instead, seeded from
  // those fields the first time so switching to it never starts empty.
  const people: Person[] = data.people?.length
    ? data.people
    : [{ name: data.name, photoUrl: data.photoUrl, subtitle: data.subtitle }];
  const setPeople = (next: Person[]) => set('people', next);

  // MVP names one person, so its panel edits this rather than the list. Taking
  // the first entry (rather than the flat fields) keeps it reading whatever is
  // already there — including a photo carried over from the composition's own
  // defaults.
  const awardee: Person = people[0] ?? { name: '', photoUrl: '', subtitle: '' };

  // Moments carries three kinds of screen, and they share one budget — the
  // wall's flight path has a fixed number of stops however they are filled.
  const achievements: Achievement[] = data.achievements ?? [];
  const quotes: Quote[] = data.quotes ?? [];

  // The feedback wall's own list. Falls back to the flat fields so a payload
  // that only set name/subtitle/message still edits one coherent card.
  const testimonials: Testimonial[] = data.testimonials?.length
    ? data.testimonials
    : [{ quote: data.message ?? '', name: data.name, role: data.subtitle, photoUrl: data.photoUrl }];
  const setTestimonials = (next: Testimonial[]) => set('testimonials', next);
  const screenCount = (data.photos?.length ?? 0) + achievements.length + quotes.length;
  const setAchievement = (index: number, patch: Partial<Achievement>) =>
    set(
      'achievements',
      achievements.map((a, j) => (j === index ? { ...a, ...patch } : a)),
    );
  const setQuote = (index: number, patch: Partial<Quote>) =>
    set('quotes', quotes.map((q, j) => (j === index ? { ...q, ...patch } : q)));

  /**
   * Anniversary splits into one global choice and one per-person number.
   *
   * The MODE is global because it picks the template's whole colour treatment —
   * silver at exactly one year, gold beyond it — and a single card cannot be
   * both. The scene reads the first person's `years` to decide that, so
   * switching mode writes across the whole list or the theme and the badges
   * would disagree.
   *
   * The COUNT is per person, because tenures differ: one joiner can be at two
   * years and another at nine on the same card. Each person's badge reads their
   * own value.
   */
  const isMultiYear = (people[0]?.years ?? 1) >= 2;
  const setMultiYear = (multi: boolean) =>
    setPeople(
      people.map((p) => ({
        ...p,
        // Note this is not reversible: dropping to one year overwrites every
        // count, so coming back to 2+ starts everyone at two rather than
        // restoring what they were on. Remembering the old counts would mean
        // carrying shadow state next to `people`, which is not worth it for a
        // toggle that says "these are all first anniversaries".
        years: multi ? Math.max(2, p.years ?? 2) : 1,
      })),
    );
  const uploadTo = async (
    slotKey: string,
    file: File,
    apply: (url: string) => void,
    treat = false,
  ) => {
    setUploading(slotKey);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      // Only ever set for the MVP portrait, and only when its toggle is on —
      // this is the flag that sends the photo to remove.bg.
      if (treat) form.append('treat', '1');
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
      apply(body.url as string);
      // The upload succeeded but the background is still there — worth saying,
      // since the photo looks wrong rather than missing.
      if (treat && body.backgroundRemoved === false) {
        setUploadError(body.note ?? 'The background could not be removed.');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  };

  const tabLabel = TABS.find((t) => t.id === activeTab)?.label ?? activeTab;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: FIELDS_PANE,
        zIndex: 1,
        background: 'var(--panel-bg)',
        backdropFilter: 'var(--panel-blur)',
        WebkitBackdropFilter: 'var(--panel-blur)',
        color: 'var(--panel-fg)',
        borderLeft: '1px solid var(--panel-edge)',
        padding: 24,
        overflowY: 'auto',
        fontFamily: 'system-ui, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>{tabLabel}</h1>

      {scene === 'mvp' && (
        <>
          <Field label="Opening">
            {/* The same two-state control the anniversary experience toggle uses.
                Off is the card on its own — what this template has always been —
                so switching templates never silently changes anyone's output. */}
            <div style={segmentedStyle}>
              {([false, true] as const).map((on) => {
                const isActive = (data.intro === true) === on;
                return (
                  <button
                    key={String(on)}
                    type="button"
                    style={{
                      ...segmentStyle,
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      color: isActive ? 'var(--accent-fg)' : 'var(--panel-label)',
                    }}
                    onClick={() => set('intro', on)}
                  >
                    {on ? 'With intro video' : 'Card only'}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Award line">
            <input
              style={inputStyle}
              value={data.message ?? ''}
              onChange={(e) => set('message', e.target.value)}
            />
          </Field>

          {/* One awardee, always. This award names a single person, so there is
              no list here: no numbering, no remove, and nothing to add. The
              scene still reads `people`, so the single entry is written back
              into it rather than into the flat fields. */}
          <div style={{ marginBottom: 18 }}>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--panel-label)', marginBottom: 8 }}>
              Awardee
            </span>

            <input
              style={{ ...inputStyle, marginBottom: 6 }}
              placeholder="Name"
              value={awardee.name}
              onChange={(e) => setPeople([{ ...awardee, name: e.target.value }])}
            />
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="Role"
              value={awardee.subtitle}
              onChange={(e) => setPeople([{ ...awardee, subtitle: e.target.value }])}
            />
            <PhotoSlot
              src={awardee.photoUrl}
              label="Change photo"
              uploading={uploading === 'mvp-0'}
              disabled={uploading !== null}
              onSelect={(file) =>
                void uploadTo(
                  'mvp-0',
                  file,
                  (url) => setPeople([{ ...awardee, photoUrl: url }]),
                  data.autoPhoto !== false,
                )
              }
            />
          </div>

          <Field label="Uploaded photo">
            {/* On by default — see `autoPhotoOn` in MvpScene. This only ever
                affects an uploaded photo; the template's own portrait keeps the
                crop Figma authored for it either way. */}
            <div style={segmentedStyle}>
              {([true, false] as const).map((on) => {
                const isActive = (data.autoPhoto !== false) === on;
                return (
                  <button
                    key={String(on)}
                    type="button"
                    style={{
                      ...segmentStyle,
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      color: isActive ? 'var(--accent-fg)' : 'var(--panel-label)',
                    }}
                    onClick={() => set('autoPhoto', on)}
                  >
                    {on ? 'Auto-treat' : 'Use as-is'}
                  </button>
                );
              })}
            </div>
          </Field>
        </>
      )}

      {scene === 'anniversary' && (
        <>
          <Field label="Experience">
            {/* Two states rather than a free number field. The design only has two
                looks — silver at exactly one year, gold beyond it — so the choice
                that actually changes the template is the one worth surfacing, and
                the year count only means anything in the second case. */}
            <div style={segmentedStyle}>
              {([1, 2] as const).map((mode) => {
                const isActive = mode === 1 ? !isMultiYear : isMultiYear;
                return (
                  <button
                    key={mode}
                    type="button"
                    style={{
                      ...segmentStyle,
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      color: isActive ? 'var(--accent-fg)' : 'var(--panel-label)',
                    }}
                    onClick={() => setMultiYear(mode === 2)}
                  >
                    {mode === 1 ? '1 year' : '2+ years'}
                  </button>
                );
              })}
            </div>
          </Field>

          {people.map((person, i) => (
            <div
              key={i}
              style={{
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: i === people.length - 1 ? 'none' : '1px solid var(--panel-divider)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--panel-label)' }}>Person {i + 1}</span>
                {people.length > 1 && (
                  <button style={linkButtonStyle} onClick={() => setPeople(people.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                )}
              </div>

              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Name"
                value={person.name}
                onChange={(e) => setPeople(people.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))}
              />
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Eyebrow — e.g. Work Anniversaries"
                value={person.eyebrowText ?? ''}
                onChange={(e) =>
                  setPeople(people.map((p, j) => (j === i ? { ...p, eyebrowText: e.target.value } : p)))
                }
              />
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder={isMultiYear ? 'Heading — e.g. MoreTasks Growth Club' : 'Heading — e.g. One Year Together'}
                value={person.titleText ?? ''}
                onChange={(e) =>
                  setPeople(people.map((p, j) => (j === i ? { ...p, titleText: e.target.value } : p)))
                }
              />
              <PhotoSlot
                src={person.photoUrl || BLANK_SLIDE}
                label="Change photo"
                uploading={uploading === `anniversary-${i}`}
                disabled={uploading !== null}
                onSelect={(file) =>
                  void uploadTo(`anniversary-${i}`, file, (url) =>
                    setPeople(people.map((p, j) => (j === i ? { ...p, photoUrl: url } : p))),
                  )
                }
              />
            </div>
          ))}

          {people.length < MAX_ANNIVERSARY_PEOPLE && (
            <button
              style={resetButtonStyle}
              onClick={() =>
                setPeople([...people, { name: '', photoUrl: '', subtitle: '', years: isMultiYear ? 2 : 1 }])
              }
            >
              + Add person
            </button>
          )}
        </>
      )}

      {scene === 'birthday' && (
        <>
          {people.map((person, i) => (
            <div
              key={i}
              style={{
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: i === people.length - 1 ? 'none' : '1px solid var(--panel-divider)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--panel-label)' }}>Person {i + 1}</span>
                {people.length > 1 && (
                  <button
                    style={linkButtonStyle}
                    onClick={() => setPeople(people.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>

              <input
                style={{ ...inputStyle, marginBottom: 6 }}
                placeholder="Name"
                value={person.name}
                onChange={(e) => setPeople(people.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))}
              />
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Day Mon"
                value={person.subtitle}
                onChange={(e) => setPeople(people.map((p, j) => (j === i ? { ...p, subtitle: e.target.value } : p)))}
              />
              <PhotoSlot
                src={person.photoUrl}
                label="Change photo"
                uploading={uploading === `person-${i}`}
                disabled={uploading !== null}
                onSelect={(file) =>
                  void uploadTo(`person-${i}`, file, (url) =>
                    setPeople(people.map((p, j) => (j === i ? { ...p, photoUrl: url } : p))),
                  )
                }
              />
            </div>
          ))}

          {people.length < MAX_BIRTHDAY_CARDS && (
            <button
              style={resetButtonStyle}
              onClick={() => setPeople([...people, { name: '', photoUrl: people[0]?.photoUrl ?? '', subtitle: '' }])}
            >
              + Add person
            </button>
          )}
        </>
      )}

      {scene === 'moments' && (
        <>
          <Field label="Card headline">
            <input style={inputStyle} value={data.name} onChange={(e) => set('name', e.target.value)} />
          </Field>

          <Field label="Highlights card artwork">
            <PhotoSlot
              src={data.photoUrl || BLANK_SLIDE}
              label={data.photoUrl ? 'Change artwork' : 'Upload artwork'}
              uploading={uploading === 'moments-card'}
              disabled={uploading !== null}
              onSelect={(file) => void uploadTo('moments-card', file, (url) => set('photoUrl', url))}
            />
          </Field>

          {(data.photos ?? ['']).map((thumb, i) => {
            const slotKey = `short-${i}`;
            const photos = data.photos ?? [''];
            return (
              <div
                key={i}
                style={{
                  marginBottom: 18,
                  paddingBottom: 14,
                  borderBottom: i === photos.length - 1 ? 'none' : '1px solid var(--panel-divider)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--panel-label)' }}>Short {i + 1}</span>
                  {photos.length > 1 && (
                    <button
                      style={linkButtonStyle}
                      onClick={() => set('photos', photos.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <PhotoSlot
                  src={thumb || BLANK_SLIDE}
                  label={thumb ? 'Change thumbnail' : 'Upload thumbnail'}
                  uploading={uploading === slotKey}
                  disabled={uploading !== null}
                  onSelect={(file) =>
                    void uploadTo(slotKey, file, (url) =>
                      set('photos', photos.map((p, j) => (j === i ? url : p))),
                    )
                  }
                />
              </div>
            );
          })}

          {screenCount < MAX_SCREENS && (
            <button style={resetButtonStyle} onClick={() => set('photos', [...(data.photos ?? ['']), ''])}>
              + Add short
            </button>
          )}

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--panel-divider)' }}>
            {achievements.map((achievement, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 18,
                  paddingBottom: 14,
                  borderBottom: i === achievements.length - 1 ? 'none' : '1px solid var(--panel-divider)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--panel-label)' }}>Achievement {i + 1}</span>
                  <button
                    style={linkButtonStyle}
                    onClick={() => set('achievements', achievements.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>

                <input
                  style={{ ...inputStyle, marginBottom: 6 }}
                  placeholder="Title"
                  value={achievement.title}
                  onChange={(e) => setAchievement(i, { title: e.target.value })}
                />
                <input
                  style={{ ...inputStyle, marginBottom: 6 }}
                  placeholder="Names line"
                  value={achievement.names}
                  onChange={(e) => setAchievement(i, { names: e.target.value })}
                />
                <textarea
                  style={{ ...inputStyle, marginBottom: 8, resize: 'vertical', minHeight: 52 }}
                  placeholder="Closing message"
                  value={achievement.message}
                  onChange={(e) => setAchievement(i, { message: e.target.value })}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PHOTO_CARDS.map((card, p) => {
                    const slotKey = `ach-${i}-${p}`;
                    return (
                      <PhotoSlot
                        key={card.id}
                        src={achievement.photos[p] || card.src}
                        label={`Photo ${p + 1}`}
                        uploading={uploading === slotKey}
                        disabled={uploading !== null}
                        onSelect={(file) =>
                          void uploadTo(slotKey, file, (url) => {
                            const photos = [...achievement.photos];
                            while (photos.length <= p) photos.push('');
                            photos[p] = url;
                            setAchievement(i, { photos });
                          })
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {screenCount < MAX_SCREENS && (
              <button
                style={resetButtonStyle}
                onClick={() =>
                  set('achievements', [
                    ...achievements,
                    // Empty photos on purpose — the collage falls back to its own
                    // design assets, so a new achievement arrives as the template.
                    { title: 'Lorem Ipsum', names: '', message: 'Memories that stays forever', photos: [] },
                  ])
                }
              >
                + Add achievement
              </button>
            )}
          </div>

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--panel-divider)' }}>
            {quotes.map((quote, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 18,
                  paddingBottom: 14,
                  borderBottom: i === quotes.length - 1 ? 'none' : '1px solid var(--panel-divider)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--panel-label)' }}>Quote {i + 1}</span>
                  <button
                    style={linkButtonStyle}
                    onClick={() => set('quotes', quotes.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>

                <input
                  style={{ ...inputStyle, marginBottom: 6 }}
                  placeholder="Writer's name"
                  value={quote.writer}
                  onChange={(e) => setQuote(i, { writer: e.target.value })}
                />
                <textarea
                  style={{ ...inputStyle, marginBottom: 8, resize: 'vertical', minHeight: 72 }}
                  placeholder="The quote"
                  value={quote.text}
                  onChange={(e) => setQuote(i, { text: e.target.value })}
                />
                <PhotoSlot
                  src={quote.photoUrl || BLANK_SLIDE}
                  label={quote.photoUrl ? 'Change picture' : 'Upload picture'}
                  uploading={uploading === `quote-${i}`}
                  disabled={uploading !== null}
                  onSelect={(file) =>
                    void uploadTo(`quote-${i}`, file, (url) => setQuote(i, { photoUrl: url }))
                  }
                />
              </div>
            ))}

            {screenCount < MAX_SCREENS && (
              <button
                style={resetButtonStyle}
                onClick={() =>
                  set('quotes', [
                    ...quotes,
                    // Empty picture on purpose — the card falls back to the
                    // design's own portrait, so a new quote arrives as the template.
                    {
                      writer: 'By Confucius',
                      text: 'A man is great not because he hasn’t failed; A man is great because failure hasn’t stopped him.',
                      photoUrl: '',
                    },
                  ])
                }
              >
                + Add quote
              </button>
            )}
          </div>
        </>
      )}

      {(scene === 'new-joinee' || scene === 'farewell') && (
        <>
          <Field label="Eyebrow">
            <input
              style={inputStyle}
              placeholder={scene === 'farewell' ? 'See You Soon' : 'Welcome'}
              value={data.eyebrow ?? ''}
              onChange={(e) => set('eyebrow', e.target.value)}
            />
          </Field>

          <Field label="Heading">
            <input
              style={inputStyle}
              value={data.message ?? ''}
              onChange={(e) => set('message', e.target.value)}
            />
          </Field>

          {people.map((person, i) => (
            <div
              key={i}
              style={{
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: i === people.length - 1 ? 'none' : '1px solid var(--panel-divider)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--panel-label)' }}>
                  {scene === 'farewell' ? 'Leaver' : 'Joinee'} {i + 1}
                </span>
                {people.length > 1 && (
                  <button style={linkButtonStyle} onClick={() => setPeople(people.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                )}
              </div>

              <input
                style={{ ...inputStyle, marginBottom: 6 }}
                placeholder="Name"
                value={person.name}
                onChange={(e) => setPeople(people.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))}
              />
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Role — e.g. Digital - Holy India"
                value={person.subtitle}
                onChange={(e) => setPeople(people.map((p, j) => (j === i ? { ...p, subtitle: e.target.value } : p)))}
              />
              <PhotoSlot
                src={person.photoUrl || BLANK_SLIDE}
                label={person.photoUrl ? 'Change photo' : 'Upload photo'}
                uploading={uploading === `joinee-${i}`}
                disabled={uploading !== null}
                onSelect={(file) =>
                  void uploadTo(`joinee-${i}`, file, (url) =>
                    setPeople(people.map((p, j) => (j === i ? { ...p, photoUrl: url } : p))),
                  )
                }
              />
            </div>
          ))}

          {people.length < MAX_JOINEES && (
            <button
              style={resetButtonStyle}
              onClick={() => setPeople([...people, { name: '', photoUrl: '', subtitle: people[0]?.subtitle ?? '' }])}
            >
              + Add {scene === 'farewell' ? 'leaver' : 'joinee'}
            </button>
          )}
        </>
      )}

      {scene === 'feedback' && (
        <>
          {testimonials.map((entry, i) => (
            <div
              key={i}
              style={{
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom:
                  i === testimonials.length - 1 ? 'none' : '1px solid var(--panel-divider)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--panel-label)' }}>Feedback {i + 1}</span>
                {testimonials.length > 1 && (
                  <button
                    style={linkButtonStyle}
                    onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* One line per paragraph, which is how the design sets it. */}
              <textarea
                style={{ ...inputStyle, marginBottom: 6, minHeight: 96, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="What they said — one line per paragraph"
                value={entry.quote}
                onChange={(e) =>
                  setTestimonials(
                    testimonials.map((t, j) => (j === i ? { ...t, quote: e.target.value } : t)),
                  )
                }
              />
              <input
                style={{ ...inputStyle, marginBottom: 6 }}
                placeholder="Name"
                value={entry.name}
                onChange={(e) =>
                  setTestimonials(testimonials.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)))
                }
              />
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Role"
                value={entry.role}
                onChange={(e) =>
                  setTestimonials(testimonials.map((t, j) => (j === i ? { ...t, role: e.target.value } : t)))
                }
              />
              <PhotoSlot
                src={entry.photoUrl}
                label="Change photo"
                uploading={uploading === `feedback-${i}`}
                disabled={uploading !== null}
                onSelect={(file) =>
                  void uploadTo(`feedback-${i}`, file, (url) =>
                    setTestimonials(testimonials.map((t, j) => (j === i ? { ...t, photoUrl: url } : t))),
                  )
                }
              />
            </div>
          ))}

          {testimonials.length < MAX_TESTIMONIALS && (
            <button
              style={resetButtonStyle}
              onClick={() =>
                setTestimonials([...testimonials, { quote: '', name: '', role: '', photoUrl: '' }])
              }
            >
              + Add feedback
            </button>
          )}
        </>
      )}

      {uploadError && <p style={{ fontSize: 11, color: 'var(--danger)', margin: '4px 0 16px' }}>{uploadError}</p>}

      {scene && (
        <button style={resetButtonStyle} onClick={() => onChange(COMPOSITIONS[scene].defaults)}>
          Reset to defaults
        </button>
      )}

      <button
        style={{ ...downloadButtonStyle, opacity: downloading || !scene ? 0.5 : 1 }}
        disabled={downloading || !scene}
        onClick={onDownload}
      >
        {downloading ? `Exporting… ${downloadProgress}%` : 'Download video'}
      </button>
      {downloadError && <p style={{ fontSize: 11, color: 'var(--danger)', margin: '8px 0 0' }}>{downloadError}</p>}
    </div>
  );
}

function PhotoSlot({
  src,
  label,
  uploading,
  disabled,
  onSelect,
}: {
  src: string;
  label: string;
  uploading: boolean;
  disabled: boolean;
  onSelect: (file: File) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
      <img
        src={src}
        alt=""
        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--thumb-border)' }}
      />
      <span style={{ fontSize: 13, color: 'var(--panel-strong)' }}>{uploading ? 'Uploading…' : label}</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onSelect(file);
        }}
      />
    </label>
  );
}


function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 18 }}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--panel-label)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 10,
  color: 'var(--input-fg)',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
};

/** Two-state switch, sized to sit in a `Field` like an input would. */
const segmentedStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 4,
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 10,
};

const segmentStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease',
};

const resetButtonStyle: CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: '1px solid var(--btn-border)',
  borderRadius: 10,
  color: 'var(--btn-fg)',
  padding: '8px 10px',
  fontSize: 13,
  cursor: 'pointer',
  marginTop: 8,
};

const linkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--link-muted)',
  fontSize: 11,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};

const downloadButtonStyle: CSSProperties = {
  width: '100%',
  background: 'var(--accent-bg)',
  border: 'none',
  borderRadius: 10,
  color: 'var(--accent-fg)',
  padding: '10px 10px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 20,
};
