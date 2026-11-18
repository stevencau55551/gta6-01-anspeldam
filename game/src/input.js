// Keyboard + mouse, read once per frame. Actions are edge-triggered bits the game
// consumes with takeActions(); movement axes are level-read every step.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_INTERACT = 8;
export const ACTION_PUNCH = 16;
export const ACTION_SHOOT = 32;
export const ACTION_RELOAD = 64;
export const ACTION_MUTE = 128;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  p: ACTION_PAUSE,
  P: ACTION_PAUSE,
  e: ACTION_ENTER_CAR,
  E: ACTION_ENTER_CAR,
  f: ACTION_PUNCH,
  F: ACTION_PUNCH,
  r: ACTION_RELOAD,
  R: ACTION_RELOAD,
  m: ACTION_MUTE,
  M: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    keys.add(event.key);
    const bit = KEY_ACTIONS[event.key];
    if (bit !== undefined) {
      actions |= bit;
      if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
    }
    if (event.key.startsWith('Arrow')) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    keys.delete(event.key);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_SHOOT;
      onMouseMove(event);
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function down(...names) {
    return names.some((name) => keys.has(name));
  }

  return {
    /** Edge-triggered actions since the last call; consuming clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** On-foot movement axis, -1..1 each way (WASD or arrows). */
    moveAxis() {
      const x = (down('d', 'ArrowRight') ? 1 : 0) - (down('a', 'ArrowLeft') ? 1 : 0);
      const y = (down('s', 'ArrowDown') ? 1 : 0) - (down('w', 'ArrowUp') ? 1 : 0);
      return { x, y, run: down('shift', 'Shift') };
    },
    /** Driving inputs: throttle -1..1, steering -1..1, handbrake. */
    driveAxis() {
      const throttle = (down('w', 'ArrowUp') ? 1 : 0) - (down('s', 'ArrowDown') ? 1 : 0);
      const steer = (down('d', 'ArrowRight') ? 1 : 0) - (down('a', 'ArrowLeft') ? 1 : 0);
      return { throttle, steer, brake: down(' ') };
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
  };
}
