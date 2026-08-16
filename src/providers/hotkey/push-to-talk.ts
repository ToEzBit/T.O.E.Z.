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

/** Right ⌘ (DESIGN). What T11's rebinding setting will change. */
export const defaultPushToTalkKey = 'MetaRight'

export interface PushToTalkOptions {
  /**
   * Which key to hold, by uiohook's name for it — `MetaRight` by default,
   * `Ctrl`, `F13`, or a plain letter like `T`.
   *
   * Naming the key rather than numbering it is what a setting can store, and
   * what a person can read back. `keyNames()` lists what is accepted.
   */
  readonly key?: string
}

export class PushToTalk {
  readonly #keycode: number

  constructor(options: PushToTalkOptions = {}) {
    const name = options.key ?? defaultPushToTalkKey
    const keycode = (UiohookKey as Record<string, number | undefined>)[name]
    if (keycode === undefined) {
      throw new Error(
        `No key called ${name}. One of: ${keyNames().join(', ')}`,
      )
    }
    this.#keycode = keycode
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

/** Every key name `PushToTalk` will accept, in uiohook's spelling. */
export function keyNames(): string[] {
  return Object.keys(UiohookKey)
}
