export type LampKind = 'done' | 'error' | 'rec' | 'attention';
export interface Controller {
    destroy(): void;
}
