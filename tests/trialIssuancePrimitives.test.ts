import {
  trialGrantReference,
  retryTrialSerialization,
  withTrialTransaction,
  type TrialPoolClient,
} from '../server/services/trialIssuancePrimitives';
import { describe, expect, jest, test } from '@jest/globals';

function mockClient(failAt?: number): TrialPoolClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    query: jest.fn(async (text: string) => {
      calls.push(text);
      if (failAt === calls.length) throw new Error(`injected SQL failure ${failAt}`);
      return { rows: [], rowCount: 1 };
    }),
  };
}

describe('trial issuance transaction invariants', () => {
  test('commits a complete reservation/write sequence', async () => {
    const client = mockClient();
    await withTrialTransaction(client, async () => {
      await client.query('RESERVE');
      await client.query('CREATE USER');
      await client.query('LOCK ACCOUNT');
      await client.query('INSERT KEY');
      await client.query('INSERT GRANT');
      await client.query('UPDATE BALANCE');
      await client.query('INSERT CLAIM LOG');
      await client.query('COMPLETE RESERVATION');
    });
    expect(client.calls).toEqual(expect.arrayContaining(['BEGIN ISOLATION LEVEL SERIALIZABLE', 'COMMIT']));
    expect(client.calls).not.toContain('ROLLBACK');
  });

  test.each([2, 3, 4, 5, 6, 7, 8, 9])('rolls back an injected SQL failure at write %i', async (failAt) => {
    const client = mockClient(failAt);
    await expect(withTrialTransaction(client, async () => {
      for (const statement of ['RESERVE', 'CREATE USER', 'LOCK ACCOUNT', 'INSERT KEY', 'INSERT GRANT', 'UPDATE BALANCE', 'INSERT CLAIM LOG', 'COMPLETE RESERVATION']) {
        await client.query(statement);
      }
    })).rejects.toThrow('injected SQL failure');
    expect(client.calls.at(-1)).toBe('ROLLBACK');
    expect(client.calls).not.toContain('COMMIT');
  });

  test('a concurrent reservation loser performs no provisioning writes', async () => {
    const client = mockClient();
    const reserved = false; // models INSERT ... ON CONFLICT returning no row
    await withTrialTransaction(client, async () => {
      await client.query('RESERVE');
      if (!reserved) return;
      await client.query('INSERT KEY');
      await client.query('INSERT GRANT');
    });
    expect(client.calls).toEqual(['BEGIN ISOLATION LEVEL SERIALIZABLE', 'RESERVE', 'COMMIT']);
  });

  test('renewal uses a new reservation-scoped idempotency reference', () => {
    const key = 'a'.repeat(64);
    expect(trialGrantReference(key, 'reservation-one'))
      .not.toBe(trialGrantReference(key, 'reservation-two'));
    expect(trialGrantReference(key, 'reservation-one'))
      .toBe(`trial:${key}:reservation-one`);
  });

  test('retries SQLSTATE 40001 then observes a concurrent reservation loser', async () => {
    const client = mockClient();
    let attempts = 0;
    const result = await retryTrialSerialization(async () => {
      attempts++;
      return withTrialTransaction(client, async () => {
        await client.query('RESERVE');
        if (attempts === 1) {
          const conflict = Object.assign(new Error('serialization failure'), { code: '40001' });
          throw conflict;
        }
        // The winner committed while the first transaction was retried; no
        // key, grant, balance, or claim-log write may follow this result.
        return { reserved: false };
      });
    });
    expect(result).toEqual({ reserved: false });
    expect(attempts).toBe(2);
    expect(client.calls).toEqual([
      'BEGIN ISOLATION LEVEL SERIALIZABLE', 'RESERVE', 'ROLLBACK',
      'BEGIN ISOLATION LEVEL SERIALIZABLE', 'RESERVE', 'COMMIT',
    ]);
  });
});