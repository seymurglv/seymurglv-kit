import type { Controller } from '../../types.js';
export interface NavController extends Controller {
    /** Assigning an index that no tab has changes nothing. */
    index: number;
    select(index: number): void;
}
/**
 * Builds the section navigation of a `.ban-nav[role="tablist"]`: a capsule that travels to the selected
 * tab, roving `tabindex`, and the switch of the sections its tabs name in `aria-controls`.
 */
export declare function nav(el: HTMLElement): NavController;
