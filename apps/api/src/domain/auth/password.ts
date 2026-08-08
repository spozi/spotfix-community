import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export interface PasswordVerification {
    matched: boolean;
    needsRehash: boolean;
}

function isPasswordHash(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith('$2');
}

export async function verifyPassword(
    password: string,
    storedPassword: string | null | undefined
): Promise<PasswordVerification> {
    if (!storedPassword) {
        return { matched: false, needsRehash: false };
    }

    if (isPasswordHash(storedPassword)) {
        return {
            matched: await bcrypt.compare(password, storedPassword),
            needsRehash: false
        };
    }

    // Legacy plaintext password — accept once, mark for rehash on next login.
    return {
        matched: storedPassword === password,
        needsRehash: storedPassword === password
    };
}
