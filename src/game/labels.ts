import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export type LabelKind = 'ally' | 'enemy';

/** 头顶战力数字标签：敌人红边白字、我方蓝边白字。 */
export function makePowerLabel(value: number, kind: LabelKind): { obj: CSS2DObject; set: (v: number) => void } {
  const el = document.createElement('div');
  el.className = `power-label ${kind}`;
  el.textContent = String(Math.round(value));
  const obj = new CSS2DObject(el);
  return {
    obj,
    set: (v: number) => {
      el.textContent = String(Math.round(v));
    },
  };
}
