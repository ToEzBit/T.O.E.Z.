/**
 * What the Owner said in one push-to-talk turn, as text.
 *
 * Deliberately not a Transcript: a Transcript is the permanent record of a
 * whole Session (see CONTEXT.md). An Utterance is one turn inside it.
 */
export interface Utterance {
  readonly text: string
}
