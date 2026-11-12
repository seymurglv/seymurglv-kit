import type { Controller } from '../../types.js';
export type FieldState = 'rest' | 'typing' | 'done' | 'error';
export interface FieldOptions {
    validate?: (value: string) => string | null;
    confirm?: boolean;
}
export interface FieldController extends Controller {
    readonly state: FieldState;
    readonly box: HTMLElement;
    check(): void;
    setError(message: string | null): void;
}
/**
 * Wraps an `input.ban-field` in its box and drives its four states. Validation comes from `options.validate`.
 * A repeat call with options replaces `validate` and `confirm` of the same controller; without options it changes nothing.
 */
export declare function field(input: HTMLInputElement, options?: FieldOptions): FieldController;
