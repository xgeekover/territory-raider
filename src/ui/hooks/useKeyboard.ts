import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Engine } from '../../engine';
import type { Direction, InputState } from '../../engine/core/types';

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Keyboard handling (spec 2.9). Held state (directions + Space) is exposed as
 * a mutable ref sampled by the fixed-timestep loop; momentary keys (Enter, P,
 * X) dispatch engine actions directly.
 */
export function useKeyboard(engine: Engine): MutableRefObject<InputState> {
  const inputRef = useRef<InputState>({ dirs: [], action: false });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const dir = KEY_TO_DIR[e.key];
      if (dir) {
        e.preventDefault();
        const { dirs } = inputRef.current;
        if (!dirs.includes(dir)) dirs.unshift(dir); // most recent first
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        inputRef.current.action = true;
        return;
      }
      if (e.repeat) return;
      if (e.key === 'Enter') engine.dispatch({ type: 'confirm' });
      else if (e.key === 'p' || e.key === 'P') engine.dispatch({ type: 'togglePause' });
      else if (e.key === 'x' || e.key === 'X') engine.dispatch({ type: 'fire' });
    };

    const onKeyUp = (e: KeyboardEvent): void => {
      const dir = KEY_TO_DIR[e.key];
      if (dir) {
        const input = inputRef.current;
        input.dirs = input.dirs.filter((d) => d !== dir);
      } else if (e.key === ' ') {
        inputRef.current.action = false;
      }
    };

    const onBlur = (): void => {
      inputRef.current.dirs = [];
      inputRef.current.action = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [engine]);

  return inputRef;
}
