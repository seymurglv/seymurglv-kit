import type { Controller, LampKind } from '../../types.js';
export type DropState = 'rest' | 'thinking' | 'message';
export interface DropController extends Controller {
    readonly state: DropState;
    /** Shows one message; it replaces the current one. An empty text changes nothing. */
    show(kind: LampKind, text: string): void;
    think(): void;
    rest(): void;
}
/**
 * Builds the status drop of a `.ban-drop`: a filled capsule that rests as a dot, thinks as three
 * breathing dots and grows leftward into one message at a time.
 */
export declare function drop(el: HTMLElement): DropController;
