import { describe, expect, it } from 'vitest'

import { subscriptionOnlyEnv } from '../src/providers/engine/subscription-env.ts'

/**
 * ADR-0002 says T.O.E.Z. runs on the Owner's Claude subscription. Half of that
 * is the environment the Engine hands its subprocess, which is what this file
 * checks; the other half — that no API key is written down anywhere in this
 * project — is `credentials.test.ts`, because it is a promise about the whole
 * repository rather than about this module.
 *
 * The Engine also refuses at runtime to talk to anything that is not OAuth;
 * that is proved in the integration suite, which actually starts one.
 */
describe('subscription auth', () => {
  it('hands the Engine an environment with no API credentials in it', () => {
    const parent = {
      PATH: '/usr/bin',
      HOME: '/Users/owner',
      ANTHROPIC_API_KEY: 'sk-ant-nope',
      ANTHROPIC_AUTH_TOKEN: 'also-nope',
    }

    expect(subscriptionOnlyEnv(parent)).toEqual({
      PATH: '/usr/bin',
      HOME: '/Users/owner',
    })
    // The caller's own environment is left alone; only the subprocess's copy
    // is stripped.
    expect(parent.ANTHROPIC_API_KEY).toBe('sk-ant-nope')
  })

  it('strips them from this machine too, whatever is exported here', () => {
    // The one above proves the rule; this proves it against the environment the
    // Engine will actually hand over. Asserting that the ambient environment is
    // clean would be the wrong test: a machine with a key exported for some
    // other project is exactly the case this is meant to survive, not fail on.
    const handedOver = subscriptionOnlyEnv()

    expect(handedOver.ANTHROPIC_API_KEY).toBeUndefined()
    expect(handedOver.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(Object.keys(handedOver).length).toBeGreaterThan(0)
  })
})
