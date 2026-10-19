// Typed access to shader uniforms: a missing name is a bug that should throw, not a silent `undefined`.
import { Color, type ShaderMaterial } from 'three';

export const uColour = (): { value: Color } => ({ value: new Color() });

export function uni(material: ShaderMaterial, name: string): { value: unknown } {
  const u = material.uniforms[name];
  if (!u) throw new Error(`missing uniform ${name}`);
  return u;
}

export function setColour(material: ShaderMaterial, name: string, colour: Color): void {
  (uni(material, name).value as Color).copy(colour);
}
