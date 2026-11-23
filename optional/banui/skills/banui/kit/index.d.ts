import { toggle } from './controls/toggle/toggle.js';
import { field } from './controls/field/field.js';
import { select } from './controls/select/select.js';
import { nav } from './controls/nav/nav.js';
import { drop } from './controls/drop/drop.js';
export * from './types.js';
export { toggle, field, select, nav, drop };
export type { ToggleController } from './controls/toggle/toggle.js';
export type { FieldController, FieldOptions, FieldState } from './controls/field/field.js';
export type { SelectController } from './controls/select/select.js';
export type { NavController } from './controls/nav/nav.js';
export type { DropController, DropState } from './controls/drop/drop.js';
export { morphLabel, followHeight, textWidth } from './motion.js';
/**
 * Builds every control under `root`: `button.ban-toggle`, `input.ban-field`, `select.ban-select`,
 * `.ban-nav` and `.ban-drop`, and makes each `button.ban-button` without a `tabindex` a Tab stop.
 * An element of another kind is left alone. A control that is already built keeps its controller,
 * so a second call adds nothing.
 */
export declare function mount(root?: ParentNode): void;
