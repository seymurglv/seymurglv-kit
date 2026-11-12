// waypoints: when a main-loop turn ends with a real answer, fork the session
// (the fork reuses the session's prompt cache, so it knows the whole
// conversation for about the price of one short reply) and ask for up to
// three likely next prompts. They show as quiet rows above the prompt box:
// 1-3 (or a click) put that prompt in the box as an editable draft, 0 hides
// the rows, and the first one is also the box's dim ghost text for Tab.
// Nothing is ever submitted by the plugin: the person presses Enter.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelUsage, Register, RenderElement } from 'claude-code'

import type { WaypointsSuggestion, WaypointsTally, WaypointsView } from '../types'
import { commandList, forkPrompt, parseReply, skillTag } from './suggest'
import { wordsFor } from './words'

const PLUGIN = 'waypoints'
const TALLY_KEY = 'tally-1'

// The desktop band, as Claude Desktop draws it (4.4212, comfortable
// density): a plain Button there is 10 px of padding each side, an 18 px key
// badge and a 6 px gap, so a Button holding only the hotkey is 44 px wide,
// its badge's centre 19 px in; a label Button's text starts 10 px in. A row
// with no left padding starts 6 px left of ember's ring (its row pads `xs`),
// so the badge sits 4 px left of the ring's centre and the label, 54 px in,
// 2 px right of ember's text line (measured live, 2 Nov 2026). The key line
// beneath starts there too, after a spacer: Desktop drops an Svg whose `alt`
// is blank, so the spacer names itself.
const LABEL_PX = 54
const SPACER = `<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_PX}" height="1"/>`
const SPACER_ALT = 'spacer'
// One hover fill that reads on the dark and the light theme alike.
const ROW_HOVER = '#8080801f'
// A plain Button's own hover fill, cleared: the row's is the only one.
const NO_FILL = { backgroundColor: '#0000' } as const

const HIDDEN: WaypointsView = { kind: 'hidden' }
const EMPTY: WaypointsTally = { forks: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }

// Bump a tag when its value's fields change: a value an older version stored
// outlives a reload, and a different tag reads it as unset.
const view = atom({ plugin: 'waypoints', key: 'view' } as const, HIDDEN, { shape: 'view-2' })
const tally = atom({ plugin: 'waypoints', key: 'tally' } as const, EMPTY, { shape: 'tally-1' })

function added(t: WaypointsTally, usage: ModelUsage): WaypointsTally {
  return {
    forks: t.forks + 1,
    input: t.input + usage.input_tokens,
    cacheRead: t.cacheRead + (usage.cache_read_input_tokens ?? 0),
    cacheWrite: t.cacheWrite + (usage.cache_creation_input_tokens ?? 0),
    output: t.output + usage.output_tokens,
  }
}

function asTally(value: unknown): WaypointsTally {
  if (typeof value !== 'object' || value === null) return EMPTY
  const v = value as Partial<Record<keyof WaypointsTally, unknown>>
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  return { forks: n(v.forks), input: n(v.input), cacheRead: n(v.cacheRead), cacheWrite: n(v.cacheWrite), output: n(v.output) }
}

async function hide($: EngineInterface): Promise<void> {
  await update($, view, () => HIDDEN)
}

// The prompt goes into the box as the person's draft; they press Enter.
async function pick($: EngineInterface, item: WaypointsSuggestion, notFilled: string): Promise<void> {
  await hide($)
  const filled = await $.prompt.fill({ text: item.prompt }).catch(() => ({ isFilled: false }))
  if (!filled.isFilled) $.ui.toast(notFilled)
}

async function count($: EngineInterface, usage: ModelUsage): Promise<void> {
  await update($, tally, t => added(t, usage))
  const total = asTally(await $.store.get(TALLY_KEY))
  await $.store.set(TALLY_KEY, added(total, usage))
}

export const register: Register = (on, options) => {
  const minAnswerChars = typeof options?.minAnswerChars === 'number' ? options.minAnswerChars : 80
  const suggestSkills = options?.suggestSkills !== false
  const words = wordsFor(options?.language)

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'waypoints', description: words.command })
    return next(e)
  })

  on('command.run', { command: 'waypoints' }, async $ => {
    const session = await read($, tally)
    const total = asTally(await $.store.get(TALLY_KEY))
    return { text: words.tally(session, total) }
  })

  // Any new main-loop turn takes the rows down. A subagent's turn does not:
  // a background agent waking up should not wipe what the person is reading.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const current = await read($, view)
      if (current.kind !== 'hidden') await hide($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return result
    if (e.answer.trim().length < minAnswerChars) return result

    const turnId = e.turnId
    await update($, view, (): WaypointsView => ({ kind: 'loading', turnId }))

    // Detached, so the turn's end never waits on the fork.
    void (async () => {
      let items: WaypointsSuggestion[] = []
      try {
        const commands = await $.command.list().catch(() => null)
        const known = commands === null ? null : new Set(commands.map(c => c.name))
        const listed = suggestSkills && commands !== null ? commandList(commands, PLUGIN) : ''
        const reply = await $.model.fork({ prompt: forkPrompt(listed) })
        if ('usage' in reply && reply.usage !== undefined) await count($, reply.usage)
        if (reply.isAnswered) items = parseReply(reply.text, known, PLUGIN)
        else $.ui.log(`waypoints: no suggestions (${reply.reason})`, { to: 'debug' })
      } catch (error) {
        $.ui.log(`waypoints: fork failed: ${String(error)}`, { to: 'debug' })
      }

      // Only the turn that asked may show its answer: a newer turn, or a
      // dismissal, has moved the view on meanwhile.
      let isShown = false
      await update($, view, (current): WaypointsView => {
        if (current.kind !== 'loading' || current.turnId !== turnId) return current
        isShown = items.length > 0
        return isShown ? { kind: 'offer', turnId, items } : HIDDEN
      })
      const first = items[0]
      if (isShown && first !== undefined) {
        void $.prompt.suggest({ text: first.prompt }).catch(() => undefined)
      }
    })()

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next): Promise<RenderElement> => {
    const below = await next(e)
    const current = await read($, view)
    if (e.props.hasSurvey || e.props.isWorking || current.kind !== 'offer') return below

    const table = $.ui.resolve(e)
    const { Box, Text, Button } = table
    const items = current.items

    // The terminal draws a plain Button with a hotkey as `1: label` by
    // itself, its digit in the accent color, as a survey's rows read.
    if (e.surface === 'terminal') {
      return (
        <Box flexDirection="column">
          {below}
          <Box flexDirection="column" marginTop={1}>
            {items.map((item, index) => (
              <Button
                key={`pick-${index + 1}`}
                plain
                hotkey={String(index + 1)}
                label={item.label}
                onPress={() => pick($, item, words.notFilled)}
              >
                {item.label}
                {item.skill !== undefined && <Text dimColor> · {skillTag(item.skill)}</Text>}
              </Button>
            ))}
            <Box flexDirection="row">
              <Text dimColor>{words.keys} · </Text>
              <Button key="hide" plain hotkey="0" dimColor label={words.hide} onPress={() => hide($)} />
            </Box>
          </Box>
        </Box>
      )
    }

    // Desktop: three quiet rows on ember's grid. Each row is a key column
    // (a Button holding only the hotkey, which the app draws as its own key
    // badge) and the label as a second Button, a dim tag naming the skill the
    // step runs (when it runs one), then, under the pointer, a muted note of
    // what a pick does. The row's own hover is the one
    // highlight: both Buttons override the app's ghost hover with nothing.
    // Its prompt box draws no ghost text (suggest answers isShown, nothing
    // shows; Claude Desktop, 1 Nov 2026), so the key line leaves Tab out.
    const Svg = 'Svg' in table ? table.Svg : undefined
    return (
      <Box flexDirection="column">
        {below}
        <Box flexDirection="column">
          {items.map((item, index) => {
            const digit = String(index + 1)
            const press = () => pick($, item, words.notFilled)
            return (
              <Box
                key={`row-${digit}`}
                flexDirection="row"
                alignItems="center"
                paddingY="xs"
                paddingRight="xs"
                hover={{ backgroundColor: ROW_HOVER }}
              >
                <Button key={`pick-${digit}`} plain hotkey={digit} label="" hover={NO_FILL} onPress={press} />
                <Box flexShrink={1} minWidth={0} overflow="hidden">
                  <Button key={`label-${digit}`} plain label={item.label} hover={NO_FILL} onPress={press} />
                </Box>
                {item.skill !== undefined && (
                  <Box flexShrink={0}>
                    <Button
                      key={`skill-${digit}`}
                      plain
                      dimColor
                      label={skillTag(item.skill)}
                      hover={NO_FILL}
                      onPress={press}
                    />
                  </Box>
                )}
                <Box display="none" flexShrink={0} hover={{ display: 'flex' }}>
                  <Text size="caption" dimColor>
                    {words.hint}
                  </Text>
                </Box>
              </Box>
            )
          })}
          <Box flexDirection="row" alignItems="center" marginTop="sm" paddingRight="xs">
            {Svg !== undefined && <Svg source={SPACER} alt={SPACER_ALT} width={LABEL_PX} height={1} />}
            <Box flexGrow={1} flexShrink={1} minWidth={0}>
              <Text size="caption" color="subtle" wrap="truncate-end">
                {words.keysDesktop}
              </Text>
            </Box>
            <Button key="hide" plain hotkey="0" dimColor label={words.hide} onPress={() => hide($)} />
          </Box>
        </Box>
      </Box>
    )
  })
}
