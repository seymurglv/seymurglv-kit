# Implement: banui in a React or Next.js product

The kit is plain CSS and plain DOM modules. React renders one element per control; the kit builds the signs inside it and drives its states. Paths here are from the skill folder, where `SKILL.md` is.

## Contents

- Bring the kit in
- One hook for every control
- The five controls
- What React must leave alone
- What the kit does not have yet
- What never comes in
- Finish

## Bring the kit in

1. Copy the `kit/` folder into the product unchanged, for example as `src/banui/kit/`. It is not an npm package. Copy the folder whole: `index.js` imports its neighbours and `banui.css` takes its fonts from `fonts/`. The `.d.ts` files next to the modules give the types.
2. Import the stylesheet once, at the root. In the Next.js App Router that is `app/layout.tsx`:

```tsx
import '@/banui/kit/banui.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="ban">{children}</body>
    </html>
  )
}
```

3. Theme: with nothing set it follows the system. To fix it, put `data-theme="light"` or `"dark"` on `<html>`, or on any element for its subtree.
4. Your own styles are plain CSS (a global file or CSS Modules) and layout only: colors as `var(--ban-<token>)`, timings as `var(--ban-t-<name>)`, sizes from the foundations. The palette, radius, shadow and type scales of a utility framework are not used on banui surfaces.

## One hook for every control

Every control of the kit is a function that takes an element and returns a controller with `destroy()`. One hook covers them all. Keep it next to the kit, as `src/banui/useBan.ts`:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import type { Controller } from './kit/index.js'

/** Builds a banui control on the element when it is in the page and takes it away on unmount. */
export function useBan<E extends HTMLElement, C extends Controller, D = unknown>(
  build: (el: E) => C,
  onChange?: (detail: D) => void,
) {
  const el = useRef<E>(null)
  const control = useRef<C | null>(null)
  const report = useRef(onChange)
  useEffect(() => { report.current = onChange })
  useEffect(() => {
    const node = el.current!
    const built = build(node)
    control.current = built
    const on = (e: Event) => report.current?.((e as CustomEvent<D>).detail)
    node.addEventListener('ban:change', on)
    return () => {
      node.removeEventListener('ban:change', on)
      built.destroy()
      control.current = null
    }
  }, [])
  return [el, control] as const
}
```

- A file that calls the kit is a client component (`'use client'`): the kit touches the document. The element itself is still rendered on the server with its `ban-*` class, so it has its size before the script runs and nothing shifts.
- `destroy()` takes away everything the kit built, so Strict Mode's second run of the effect and a remount both leave one control, not two.
- An assignment from code (`checked`, `value`, `index`) is silent: it fires no event, so a value that comes down from state never loops back.

## The five controls

```tsx
'use client'
import { useEffect, useImperativeHandle, type Ref } from 'react'
import { drop, field, nav, select, toggle, type LampKind } from './kit/index.js'
import { useBan } from './useBan'

export function Toggle(props: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  const [el, control] = useBan(toggle, (d: { checked: boolean }) => props.onChange(d.checked))
  useEffect(() => { control.current!.checked = props.checked }, [props.checked])
  return <button ref={el} className="ban-toggle" type="button" role="switch" aria-checked={props.checked} aria-label={props.label} />
}

export function Field(props: {
  defaultValue?: string; label: string; confirm?: boolean
  validate?: (value: string) => string | null
  onChange?: (detail: { value: string; state: 'rest' | 'typing' | 'done' | 'error' }) => void
}) {
  const [el] = useBan((input: HTMLInputElement) => field(input, { validate: props.validate, confirm: props.confirm }), props.onChange)
  return (
    <span className="control">
      <input ref={el} className="ban-field" defaultValue={props.defaultValue} aria-label={props.label} autoComplete="off" />
    </span>
  )
}

export function Select(props: { value: string; onChange: (value: string) => void; label: string; options: { value: string; label: string }[] }) {
  const [el, control] = useBan(select, (d: { value: string }) => props.onChange(d.value))
  useEffect(() => { control.current!.value = props.value }, [props.value])
  return (
    <span className="control">
      <select ref={el} className="ban-select" defaultValue={props.value} aria-label={props.label}>
        {props.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </span>
  )
}

export function Nav(props: { label: string; sections: { id: string; label: string; body: React.ReactNode }[]; onChange?: (detail: { index: number; id: string }) => void }) {
  const [el] = useBan((track: HTMLDivElement) => nav(track), props.onChange)
  return (
    <>
      <div ref={el} className="ban-nav" role="tablist" aria-label={props.label}>
        {props.sections.map((s, i) => (
          <button key={s.id} type="button" role="tab" id={`tab-${s.id}`} aria-controls={`pan-${s.id}`} aria-selected={i === 0} tabIndex={i === 0 ? 0 : -1}>{s.label}</button>
        ))}
      </div>
      <div>
        {props.sections.map((s, i) => (
          <div key={s.id} role="tabpanel" id={`pan-${s.id}`} aria-labelledby={`tab-${s.id}`} hidden={i !== 0} inert={i !== 0}>{s.body}</div>
        ))}
      </div>
    </>
  )
}

export type Status = { show(kind: LampKind, text: string): void; think(): void; rest(): void }

export function Drop(props: { ref: Ref<Status>; closeLabel: string }) {
  const [el, control] = useBan((box: HTMLDivElement) => drop(box))
  useImperativeHandle(props.ref, () => ({
    show: (kind, text) => control.current!.show(kind, text),
    think: () => control.current!.think(),
    rest: () => control.current!.rest(),
  }), [])
  return <div ref={el} className="ban-drop" data-close-label={props.closeLabel} />
}
```

- A button needs no hook: `<button className="ban-button" type="button" tabIndex={0}>`.
- One `Drop` per window, in a container with `position: relative`. `closeLabel` names the cross for screen readers in the product's language ("Close"); without it the kit says it in Russian. The window keeps its ref (`useRef<Status>(null)`) and calls `status.current?.show('attention', '…')`; pass it down through context when rows deep inside need it. `ban:open` (a press on the text) and `ban:close` (the cross) are ordinary events on the element.
- `Drop` takes `ref` as a prop, which needs React 19. On React 18 wrap it in `forwardRef`, and write `inert` on the panels as `inert=""`.
- The width of a field or a list is given to the `.control` wrapper (220 px in a settings row), never to the `<input>` or `<select>`.
- A field in error draws its note under itself and takes no room: the row keeps 21 px more under it while `.ban-field-box[data-state="error"]` is inside (`:has()` in CSS, as `examples/screen-settings/settings.css` does).

## What React must leave alone

The kit changes the DOM of the element it builds. React keeps working as long as it does not manage the same nodes:

| The kit does | So in React |
|---|---|
| wraps the `<input>` or `<select>` in a box of its own | the element is the **only child** of a wrapper the component renders; never render a sibling next to it, and never render it conditionally inside that wrapper |
| reads a list's options once, when it is built | options that change get a new `key` on `<Select>`, which builds it again |
| reads the tabs and their sections once; adds the travelling capsule to the track | sections that change get a new `key` on `<Nav>` |
| after the first render drives `hidden`, `inert`, `aria-selected` and `tabindex` of tabs and sections | write them once from the index, as above; never from state |
| flips `aria-checked` of a toggle on press | pass `checked` from state and set state in `onChange`; both then agree |
| keeps the field's text itself | the input is uncontrolled: `defaultValue`, and the value arrives in `onChange` after a check (focus leaves, Enter) |

A field's `validate` and `confirm` are read when the field is built. To replace them later, call `field(input, { validate, confirm })` again on the same input: it returns the same controller with the new options.

## What the kit does not have yet

A tray, an answer button, progress, a checkbox, a stepper, a slider and search have recipes or rules but no module. Build each as a component of your own:

1. Its states come from the recipe in the control recipes, or from a table you write (the Design playbook's "Inventing a control" applies as it stands).
2. Markup is the kit's primitives: `ban-cap`, `ban-out`, `ban-ln`, `ban-lamp`, `ban-breathe`, `ban-press`, `ban-grown`, `ban-fold`. A glyph is two or three `<i className="ban-ln" style={{ '--x': '2px', '--r': '45deg', '--k': 0.64 } as React.CSSProperties} />` in one `position: relative` box.
3. A state is a `data-state` attribute or new values of those custom properties on the same elements. The elements stay mounted in every state: a line that unmounts cannot travel.
4. Motion is a CSS transition with the kit's timings and curves. No animation library for what a transition carries; `followHeight()` and `morphLabel()` from the kit cover a height that follows its content and a label that changes by shared letters.
5. Keyboard and ARIA are written by hand, as the recipes say: no headless component brings them, because those arrive with their own dialogs and portals.

## What never comes in

- A component library's dialog, modal, popover confirmation, toast, spinner or skeleton: see "What banui never has" in `SKILL.md` for what stands in their place.
- An icon set. A glyph is lines.
- A color, radius or shadow from a theme of another library.

## Finish

1. `node scripts/check.mjs src/` from the skill folder (give it the product's folders that hold banui screens).
2. "Before showing" in `SKILL.md`, in the running product: both themes, the keyboard, reduced motion, and a remount of every screen (leave it and come back) to see each control built once.
