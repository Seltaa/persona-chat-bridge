import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export function useVrmLoader(url: string): VRM | null {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  return useMemo(() => {
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) return null;
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
    // Keep custom morph targets that are not registered as standard VRM
    // expressions. Many avatars use these for gesture-specific faces such as
    // surprise, embarrassment, tears, or sparkly eyes.
    VRMUtils.rotateVRM0(vrm);
    return vrm;
  }, [gltf]);
}
