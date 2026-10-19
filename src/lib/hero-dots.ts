// A handle on the hero's dot matrix, so the boot can read the dots its particles will become and count the dot matrix as
// part of real loading progress. The hero provides it once the dots are built (or null if they cannot be).
import type { DotMatrix } from './dotmatrix';

let provide: (dots: DotMatrix | null) => void = () => undefined;
export const heroDots: Promise<DotMatrix | null> = new Promise((resolve) => {
  provide = resolve;
});
export const provideHeroDots = (dots: DotMatrix | null): void => provide(dots);
