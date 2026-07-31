import { useCallback, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

const EXPRESSION_ALIASES: Record<PersonaExpression, readonly string[]> = {
  neutral: [],
  happy: ['happy', 'joy', 'fun'],
  sad: ['sad', 'sorrow'],
  surprised: ['surprised', 'surprise'],
  embarrassed: ['embarrassed', 'shy'],
  angry: ['angry'],
};

const CUSTOM_MORPH_ALIASES: Partial<
  Record<PersonaExpression, readonly string[]>
> = {
  surprised: ['set-○○', 'set-kira', 'eye-surprise_left'],
  embarrassed: ['set-troubled', 'sweat-1', 'cheek'],
};

const FALLBACK_EXPRESSION_ALIASES: Partial<
  Record<PersonaExpression, readonly string[]>
> = {
  surprised: ['relaxed', 'fun'],
  embarrassed: ['relaxed', 'sorrow', 'sad', 'fun'],
};

interface MorphTargetMesh extends THREE.Mesh {
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
}

export function useVrmExpression(
  vrm: VRM | null,
  expression: PersonaExpression,
) {
  const activeName = useRef<string | null>(null);
  const activeMorphs = useRef<Array<{ mesh: MorphTargetMesh; index: number }>>(
    [],
  );

  const applyExpression = useCallback(() => {
    const manager = vrm?.expressionManager;
    if (!manager) return;
    if (activeName.current) manager.setValue(activeName.current, 0);
    activeName.current = null;
    for (const { mesh, index } of activeMorphs.current) {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = 0;
    }
    activeMorphs.current = [];
    if (expression === 'neutral') return;

    const available = manager.expressionMap;
    let match = EXPRESSION_ALIASES[expression].find(
      (name) => available[name] != null,
    );
    if (match) {
      manager.setValue(match, 1);
      activeName.current = match;
      return;
    }

    const customAliases = CUSTOM_MORPH_ALIASES[expression] ?? [];
    for (const alias of customAliases) {
      vrm?.scene.traverse((object) => {
        const mesh = object as MorphTargetMesh;
        const index = mesh.morphTargetDictionary?.[alias];
        if (index == null || !mesh.morphTargetInfluences) return;
        mesh.morphTargetInfluences[index] = 1;
        activeMorphs.current.push({ mesh, index });
      });
      if (activeMorphs.current.length > 0) return;
    }

    match = (FALLBACK_EXPRESSION_ALIASES[expression] ?? []).find(
      (name) => available[name] != null,
    );
    if (match) {
      manager.setValue(match, 1);
      activeName.current = match;
    }
  }, [expression, vrm]);

  useEffect(() => {
    applyExpression();
    return () => {
      if (activeName.current && vrm?.expressionManager) {
        vrm.expressionManager.setValue(activeName.current, 0);
      }
      for (const { mesh, index } of activeMorphs.current) {
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = 0;
      }
      activeMorphs.current = [];
      activeName.current = null;
    };
  }, [applyExpression, vrm]);

  return applyExpression;
}
