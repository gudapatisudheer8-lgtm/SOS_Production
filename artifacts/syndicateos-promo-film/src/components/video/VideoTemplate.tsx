import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  VideoCanvas,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { VideoPausedContext } from '@/lib/video/hooks';
import { FilmScene01 } from './scenes/FilmScenes';
import { FilmScene02 } from './scenes/FilmScenes';
import { FilmScene03 } from './scenes/FilmScenes';
import { FilmScene04 } from './scenes/FilmScenes';
import { FilmScene05 } from './scenes/FilmScenes';
import { FilmScene06 } from './scenes/FilmScenes';
import { FilmScene07 } from './scenes/FilmScenes';
import { FilmScene08 } from './scenes/FilmScenes';
import './film.css';

export const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
export const SCENE_DURATIONS: Record<string, number> = {
  shot01: 7000,
  shot02: 8000,
  shot03: 7000,
  shot04: 8000,
  shot05: 8000,
  shot06: 7000,
  shot07: 8000,
  shot08: 7000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  shot01: FilmScene01,
  shot02: FilmScene02,
  shot03: FilmScene03,
  shot04: FilmScene04,
  shot05: FilmScene05,
  shot06: FilmScene06,
  shot07: FilmScene07,
  shot08: FilmScene08,
};
const SCENE_START_SECONDS: Record<string, number> = {};
let cumulativeMs = 0;
Object.entries(SCENE_DURATIONS).forEach(([key, duration]) => {
  SCENE_START_SECONDS[key] = cumulativeMs / 1000;
  cumulativeMs += duration;
});

type VideoTemplateProps = {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (key: string) => void;
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: VideoTemplateProps = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousSceneRef = useRef<string | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey] ?? FilmScene01;

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.36;
    if (paused) {
      audio.pause();
      return;
    }
    if (previousSceneRef.current !== currentSceneKey) {
      previousSceneRef.current = currentSceneKey;
      const sceneStart = SCENE_START_SECONDS[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - sceneStart) > 0.18) audio.currentTime = sceneStart;
    }
    void audio.play().catch(() => undefined);
  }, [baseSceneKey, currentScene, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} className="film-canvas">
        <div className="film-grain" aria-hidden="true" />
        <div className="film-running-label">SYNDICATEOS <span>·</span> ILLUSTRATIVE PRODUCT TOUR</div>
        <AnimatePresence mode="sync" initial={false}>
          <SceneComponent key={currentSceneKey} />
        </AnimatePresence>
        <motion.div className="global-orbit" aria-hidden="true" />
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/composite_audio.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
