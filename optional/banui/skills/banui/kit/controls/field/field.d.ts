import type { Controller } from '../../types.js';
export type FieldState = 'rest' | 'typing' | 'saving' | 'done' | 'error';
export interface FieldOptions {
    validate?: (value: string) => string | null;
    confirm?: boolean;
}
export interface FieldController extends Controller {
    readonly state: FieldState;
    readonly box: HTMLElement;
    check(): void;
    setError(message: string | null): void;
    /** Shows three breathing dots in the right slot until `check()` or `setError()` gives the answer. Silent: no event. */
    wait(): void;
}
/**
 * Wraps an `input.ban-field` in its box and drives its five states. Validation comes from `options.validate`.
 * A repeat call with options replaces `validate` and `confirm` of the same controller; without options it changes nothing.
 */
export declare function field(input: HTMLInputElement, options?: FieldOptions): FieldController;
