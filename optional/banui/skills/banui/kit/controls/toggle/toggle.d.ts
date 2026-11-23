import type { Controller } from '../../types.js';
export interface ToggleController extends Controller {
    checked: boolean;
}
/**
 * Builds the sign of a `button.ban-toggle[role="switch"]` and flips `aria-checked` on press. A button
 * without a role gets `role="switch"`, one without `aria-checked` gets "false"; both stay after `destroy()`.
 */
export declare function toggle(el: HTMLButtonElement): ToggleController;
