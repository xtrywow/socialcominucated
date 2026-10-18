import {useFrame, useThree} from '@react-three/fiber';
import {useMemo} from 'react';
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/examples/jsm/shaders/FXAAShader.js';

// Render path: scene -> (tone map + sRGB) -> FXAA. Replaces the 4x MSAA back buffer, which is the single
// most expensive thing on CPU SwiftShader (~0.45 s/frame at 1080x1920).
export const Post: React.FC = () => {
  const {gl, scene, camera, size} = useThree();
  const composer = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(size.width, size.height, {type: THREE.HalfFloatType, samples: 0});
    const c = new EffectComposer(gl, rt);
    c.setPixelRatio(1);
    c.setSize(size.width, size.height);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new OutputPass());
    const fx = new ShaderPass(FXAAShader);
    fx.material.uniforms['resolution'].value.set(1 / size.width, 1 / size.height);
    c.addPass(fx);
    return c;
  }, [gl, scene, camera, size.width, size.height]);
  useFrame(() => {
    composer.render();
  }, 1);
  return null;
};
