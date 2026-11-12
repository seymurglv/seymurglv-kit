import type { Controller } from '../../types.js';
export interface SelectController extends Controller {
    /** Assigning a value that no option has changes nothing. */
    value: string;
    readonly open: boolean;
    show(): void;
    hide(): void;
}
/**
 * Builds the dropdown of a `select.ban-select`: a 28 px capsule that grows downward into its list
 * over the content below. The select stays inside the box, hidden, as the form value.
 */
export declare function select(el: HTMLSelectElement): SelectController;
