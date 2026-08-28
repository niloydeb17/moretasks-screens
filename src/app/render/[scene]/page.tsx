import { notFound } from 'next/navigation';
import { getComposition } from '@/lib/compositions';
import { resolveDurationInFrames } from '@/lib/duration';
import {
  FRAME_PARAM,
  SCENE_DATA_PARAM,
  decodeSceneData,
  firstParam,
} from '@/lib/sceneData';
import RenderSurface from './RenderSurface';

interface Props {
  params: Promise<{ scene: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RenderPage({ params, searchParams }: Props) {
  const { scene } = await params;
  const composition = getComposition(scene);
  if (!composition) notFound();

  const query = await searchParams;
  const data = decodeSceneData(
    firstParam(query[SCENE_DATA_PARAM]),
    composition.defaults,
  );

  // Clamp against the payload's own length, not the composition's static one —
  // birthday's carousel runs one card per person, so its last valid frame moves
  // with the data.
  const totalFrames = resolveDurationInFrames(composition, data);
  const requested = Number(firstParam(query[FRAME_PARAM]) ?? 0);
  const frame = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 0), totalFrames - 1)
    : 0;

  return <RenderSurface composition={composition} data={data} initialFrame={frame} />;
}
