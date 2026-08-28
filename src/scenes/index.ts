import type { ComponentType } from 'react';
import type { BuiltSceneId } from '@/lib/compositions';
import BirthdayScene, { type SceneProps } from './birthday/BirthdayScene';
import AchievementsScene from './achievements/AchievementsScene';
import PhotoFrameScene from './photo-frame/PhotoFrameScene';
import MvpScene from './mvp/MvpScene';
import AnniversaryScene from './anniversary/AnniversaryScene';
import MomentsScene from './moments/MomentsScene';
import QuoteScene from './quote/QuoteScene';
import NewJoineeScene from './new-joinee/NewJoineeScene';
import FarewellScene from './farewell/FarewellScene';
import FeedbackScene from './feedback/FeedbackScene';

/** Scene id -> component. Add a scene here and it becomes renderable everywhere. */
export const SCENES: Record<BuiltSceneId, ComponentType<SceneProps>> = {
  birthday: BirthdayScene,
  achievements: AchievementsScene,
  mvp: MvpScene,
  'photo-frame': PhotoFrameScene,
  anniversary: AnniversaryScene,
  moments: MomentsScene,
  quote: QuoteScene,
  'new-joinee': NewJoineeScene,
  farewell: FarewellScene,
  feedback: FeedbackScene,
};

export type { SceneProps };
