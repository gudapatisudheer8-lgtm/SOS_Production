import { useCallback, useEffect, useMemo, useState } from 'react';

const REPEAT_SUFFIX = /_r[12]$/;
export function stripRepeatSuffix(key: string) {
  return key.replace(REPEAT_SUFFIX, '');
}

function rotateFromIndex(durations: Record<string, number>, index: number) {
  const keys = Object.keys(durations);
  if (index <= 0) return durations;
  const rotated: Record<string, number> = {};
  for (let offset = 0; offset < keys.length; offset += 1) {
    const key = keys[(index + offset) % keys.length];
    rotated[key] = durations[key];
  }
  return rotated;
}

export function useSceneControls(baseDurations: Record<string, number>) {
  const sceneKeys = useMemo(() => Object.keys(baseDurations), [baseDurations]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mountKey, setMountKey] = useState(0);
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const durations = useMemo(() => {
    if (locked) {
      const key = sceneKeys[activeIndex];
      return { [`${key}_r1`]: baseDurations[key], [`${key}_r2`]: baseDurations[key] };
    }
    return rotateFromIndex(baseDurations, activeIndex);
  }, [activeIndex, baseDurations, locked, sceneKeys]);

  const totalDuration = useMemo(() => Object.values(baseDurations).reduce((sum, ms) => sum + ms, 0), [baseDurations]);
  const activeDuration = baseDurations[sceneKeys[activeIndex]] ?? 0;
  const onSceneChange = useCallback((rawKey: string) => {
    const index = sceneKeys.indexOf(stripRepeatSuffix(rawKey));
    if (index >= 0) setActiveIndex(index);
    setElapsed(0);
    setTick((value) => value + 1);
  }, [sceneKeys]);

  const jumpTo = useCallback((index: number) => {
    setActiveIndex(index);
    setPaused(false);
    setElapsed(0);
    setMountKey((value) => value + 1);
    setTick((value) => value + 1);
  }, []);

  const toggleLock = useCallback(() => {
    setLocked((value) => !value);
    setPaused(false);
    setElapsed(0);
    setMountKey((value) => value + 1);
    setTick((value) => value + 1);
  }, []);
  const togglePause = useCallback(() => setPaused((value) => !value), []);

  useEffect(() => {
    if (paused || activeDuration <= 0) return undefined;
    const interval = window.setInterval(() => {
      setElapsed((current) => Math.min(activeDuration, current + 60));
    }, 60);
    return () => window.clearInterval(interval);
  }, [activeDuration, paused, tick]);

  return {
    sceneKeys,
    activeIndex,
    locked,
    paused,
    mountKey,
    tick,
    durations,
    activeDuration,
    elapsed,
    totalDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
    togglePause,
  };
}
