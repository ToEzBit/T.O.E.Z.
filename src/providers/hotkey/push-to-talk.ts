import { uIOhook, UiohookKey } from 'uiohook-napi'

/**
 * The push-to-talk key, watched everywhere rather than only in T.O.E.Z.'s own
 * window: the Owner holds it while working in some other app, which is the
 * whole point of a walkie-talkie key.
 *
 * This is not a port. Ports are what the Session *calls*; this only tells the
 * Session that something happened, which is what a SessionEvent is for. The
 * three fakeable seams stay three.
 *
 * macOS will not deliver these events until T.O.E.Z. — or, under `pnpm listen`,
 * the terminal running it — is ticked in System Settings › Privacy & Security ›
 * Accessibility. Without that, the key is simply never heard: there is no error
 * to catch, which is why docs/ears.md leads with it.
 */

export interface PushToTalkHandlers {
  /** The key went down: the Owner is about to speak. */
  readonly pressed: () => void
  /** The key came back up: the Owner has finished. */
  readonly released: () => void
}

export interface PushToTalkOptions {
  /**
   * Which key to listen for, as a uiohook keycode. Right ⌘ by default (DESIGN);
   * making it settable is what T11's rebinding setting will write into.
   */
  readonly keycode?: number
}

export class PushToTalk {
  readonly #keycode: number

  constructor(options: PushToTalkOptions = {}) {
    this.#keycode = options.keycode ?? UiohookKey.MetaRight
  }

  /**
   * Starts watching, and hands back the way to stop. Nothing about any other
   * key leaves this object.
   *
   * The keyboard hook is one per process, so only one of these can be listening
   * at a time — stop the last one before starting the next.
   */
  listen(handlers: PushToTalkHandlers): () => void {
    // macOS repeats key-down while a key is held. Only the first one begins an
    // utterance; the rest are the same hold, not new ones.
    let held = false

    const onKeydown = (event: { keycode: number }): void => {
      if (event.keycode !== this.#keycode || held) return
      held = true
      handlers.pressed()
    }

    const onKeyup = (event: { keycode: number }): void => {
      if (event.keycode !== this.#keycode || !held) return
      held = false
      handlers.released()
    }

    uIOhook.on('keydown', onKeydown)
    uIOhook.on('keyup', onKeyup)
    uIOhook.start()

    return () => {
      uIOhook.off('keydown', onKeydown)
      uIOhook.off('keyup', onKeyup)
      uIOhook.stop()
    }
  }
}
