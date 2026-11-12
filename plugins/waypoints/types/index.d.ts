// waypoints: the values the band draws from, kept in $.state so a hot reload
// keeps what is on screen.

export type WaypointsSuggestion = {
  /** What the row shows. */
  label: string
  /** What goes into the prompt box when the row is picked. */
  prompt: string
  /** The installed skill or command the prompt runs (no slash), shown as a tag. */
  skill?: string
}

export type WaypointsView =
  | { kind: 'hidden' }
  | { kind: 'loading'; turnId: string }
  | { kind: 'offer'; turnId: string; items: WaypointsSuggestion[] }

/** What the forks have cost, in tokens, as the API counts them. */
export type WaypointsTally = {
  forks: number
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
}

declare module 'claude-code' {
  interface PluginState {
    waypoints: {
      view: Shaped<WaypointsView>
      tally: Shaped<WaypointsTally>
    }
  }
}
