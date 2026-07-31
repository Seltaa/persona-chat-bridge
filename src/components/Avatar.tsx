import { Suspense, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useVrmLoader } from '../hooks/useVrmLoader';
import { useVrmAnimation } from '../hooks/useVrmAnimation';
import { useAmplitudeLipSync } from '../hooks/useAmplitudeLipSync';
import { useBlink } from '../hooks/useBlink';
import { useVrmExpression } from '../hooks/useVrmExpression';
import type { PlayableAnimationType } from '../animation-catalog';

interface AvatarProps {
  animation: PlayableAnimationType;
  animationRequest: number;
  animationUrls?: readonly string[];
  audioLevel: number;
  expression: PersonaExpression;
  modelUrl: string;
  onAnimationComplete: () => void;
  playback: 'loop' | 'once';
  speaking: boolean;
  textSpeaking: boolean;
  onReady?: (scene: THREE.Object3D) => void;
}

function AvatarModel({
  animation,
  animationRequest,
  animationUrls,
  audioLevel,
  expression,
  modelUrl,
  onAnimationComplete,
  playback,
  speaking,
  textSpeaking,
  onReady,
}: AvatarProps) {
  const vrm = useVrmLoader(modelUrl);
  const { play, update: updateAnimation } = useVrmAnimation(vrm);
  const updateLipSync = useAmplitudeLipSync(vrm);
  const updateBlink = useBlink(vrm);
  const updateExpression = useVrmExpression(vrm, expression);

  useEffect(() => {
    void play(animation, {
      animationUrls,
      onComplete: onAnimationComplete,
      playback,
    });
  }, [
    animation,
    animationRequest,
    animationUrls,
    onAnimationComplete,
    play,
    playback,
  ]);

  useLayoutEffect(() => {
    if (vrm) onReady?.(vrm.scene);
  }, [onReady, vrm]);

  useFrame((_, delta) => {
    if (!vrm) return;
    updateAnimation(delta);
    updateBlink(delta);
    updateLipSync(delta, audioLevel, speaking, textSpeaking);
    vrm.update(delta);
    updateExpression();
  });

  return vrm ? (
    <primitive
      object={vrm.scene}
      onPointerOver={(event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        window.personaBridge?.setClickThrough(false);
      }}
      onPointerOut={() => window.personaBridge?.setClickThrough(true)}
    />
  ) : null;
}

export function Avatar(props: AvatarProps) {
  return (
    <Suspense fallback={null}>
      <AvatarModel {...props} />
    </Suspense>
  );
}
