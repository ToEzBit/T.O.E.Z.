import {
  query,
  type SDKPartialAssistantMessage,
} from '@anthropic-ai/claude-agent-sdk'

import type { Engine, EngineRequest, ReplyChunk } from '../../core/ports/engine.ts'
import type { Workspace } from '../../core/workspace/workspace.ts'
import { subscriptionOnlyEnv } from './subscription-env.ts'

/**
 * T.O.E.Z.'s brain: the Claude Agent SDK, which spawns Claude Code and inherits
 * the Owner's `claude login` (ADR-0002). Everything Claude Code can do — tools,
 * subagents, MCP servers, skills — comes along with it.
 *
 * The Session's continuity is one string: the SDK's session id, kept here
 * between turns and passed back as `resume`, so turn two knows what turn one
 * was about. That keeps the Engine interface a single `reply()` with nothing to
 * open or close, and matches ADR-0002's fallback of driving headless Claude
 * Code, which resumes the same way.
 */

/** Every `apiKeySource` that means a real API key was found and would be billed. */
const API_KEY_SOURCES: readonly string[] = ['user', 'project', 'org', 'temporary']

export class ClaudeAgentSdkEngine implements Engine {
  readonly #workspace: Workspace
  #sessionId: string | undefined

  constructor(workspace: Workspace) {
    this.#workspace = workspace
  }

  async *reply(request: EngineRequest): AsyncIterable<ReplyChunk> {
    const messages = query({
      prompt: request.utterance.text,
      options: {
        // The Workspace is where T.O.E.Z. works from, so anything it reads or
        // writes for itself lands in `~/.toez` rather than in this repo.
        cwd: this.#workspace.root,
        // Claude Code's own prompt keeps the capabilities; the Persona on top
        // of it decides who is using them.
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: this.#workspace.persona,
        },
        // Nothing is inherited from `~/.claude`: T.O.E.Z.'s configuration is
        // its own, per the design. Omitting this loads every settings file on
        // the machine.
        settingSources: [],
        // Without this the reply arrives in one piece at the end, and there is
        // nothing to stream.
        includePartialMessages: true,
        env: subscriptionOnlyEnv(),
        ...(this.#sessionId === undefined ? {} : { resume: this.#sessionId }),
      },
    })

    for await (const message of messages) {
      switch (message.type) {
        case 'system':
          if (message.subtype !== 'init') break
          this.#refuseAnythingButSubscription(message.apiKeySource)
          this.#sessionId = message.session_id
          break

        case 'stream_event': {
          const text = spokenText(message)
          if (text !== undefined) yield { text }
          break
        }

        case 'result':
          if (message.subtype !== 'success') {
            throw new Error(
              `The Engine gave up: ${message.subtype}` +
                (message.stop_reason === null ? '' : ` (${message.stop_reason})`),
            )
          }
          break

        default:
          break
      }
    }
  }

  /**
   * The whole point of ADR-0002. If an API key got in — from a settings file,
   * an environment this process inherited, an organisation default — stopping
   * loudly is the only acceptable outcome; the alternative is spending money on
   * a key nobody meant to use.
   *
   * `apiKeySource` says where an *API key* came from, so the subscription login
   * shows up as "none": there is no key. Verified against SDK 0.3.233 on
   * 2026-08-16, where a working `claude login` reports exactly that. The typed
   * union in `sdk.d.ts` does not list "none", which is why this takes a plain
   * string — and why it names what it rejects rather than what it accepts, so a
   * value nobody has seen yet cannot be mistaken for a key.
   */
  #refuseAnythingButSubscription(source: string): void {
    if (!API_KEY_SOURCES.includes(source)) return
    throw new Error(
      `The Engine found an API key (source: "${source}") and would bill it ` +
        `per token. ADR-0002 allows the Owner's Claude subscription only: ` +
        `unset any Anthropic API credential and run \`claude login\`.`,
    )
  }
}

/**
 * The part of a streamed message that is T.O.E.Z. talking to the Owner.
 *
 * Two things are filtered out and both matter: thinking, which is the Engine
 * reasoning to itself and must never be spoken, and anything from a Subagent,
 * whose live progress the design puts on screen rather than in the reply.
 */
function spokenText(message: SDKPartialAssistantMessage): string | undefined {
  if (message.parent_tool_use_id !== null) return undefined

  const { event } = message
  if (event.type !== 'content_block_delta') return undefined
  if (event.delta.type !== 'text_delta') return undefined
  return event.delta.text
}
