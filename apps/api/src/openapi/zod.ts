/**
 * Boots the `@asteasolutions/zod-to-openapi` extension exactly once. Importing
 * this file applies `z.openapi(...)` chainable metadata to every zod schema
 * in the process. Import it before declaring any schemas that use `.openapi()`.
 */
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export { z };
