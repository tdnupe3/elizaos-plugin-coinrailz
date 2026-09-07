/**
 * Small, dependency-free pieces of the trial transaction. Keeping these here
 * makes the invariants executable without loading the HTTP/Stripe route.
 */
export function trialGrantReference(claimKey: string, reservationId: string): string {
  return `trial:${claimKey}:${reservationId}`;
}

export interface TrialPoolClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
}

/**
 * Transaction envelope used by the route. A failed SQL statement can never
 * commit a partially-issued trial; callers retain ownership of release().
 */
export async function withTrialTransaction<T>(
  client: TrialPoolClient,
  work: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

export function isSerializationFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { code?: string }).code === '40001';
}

/** Retry only PostgreSQL's SERIALIZABLE retry signal; all other failures fail closed. */
export async function retryTrialSerialization<T>(
  work: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === maxAttempts) throw error;
    }
  }
  throw new Error('Unreachable trial serialization retry state');
}