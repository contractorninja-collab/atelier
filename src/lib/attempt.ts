import type { ActionResult } from './types'

/**
 * Await a server action without trusting the network to answer.
 *
 * A server action that cannot reach the database, or whose function is killed
 * at its time limit, rejects instead of returning — and an awaiting form that
 * never catches it keeps its spinner forever. Every result-shaped action call
 * in the app goes through here, so the worst network night degrades to an
 * error message with a working Try Again, never a dialog that hangs.
 *
 * The wording matters: the write may well have committed before the response
 * was lost, so the message says to reload before retrying rather than inviting
 * an immediate duplicate.
 */
export async function attempt(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run()
  } catch {
    return {
      ok: false,
      error: 'The server did not answer. It may still have saved — reload the page before trying again.',
    }
  }
}
