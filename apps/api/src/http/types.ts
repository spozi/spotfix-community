/**
 * Augments Express Request with our request-scoped state. Kept in one place
 * so http modules don't sprinkle module augmentation throughout the codebase.
 */

import type { AuthContext } from '../domain/auth/auth.service';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            id: string;
            auth?: AuthContext;
        }
    }
}

export {};
