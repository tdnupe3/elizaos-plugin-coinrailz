/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Address,
  isSome,
  AccountMeta,
  AccountSignerMeta,
  Instruction,
  Option,
  TransactionSigner,
} from "@solana/kit"
/* eslint-enable @typescript-eslint/no-unused-vars */
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import { borshAddress } from "../utils" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export const DISCRIMINATOR = Buffer.from([127, 147, 49, 137, 58, 137, 103, 56])

export interface TopupRewardsArgs {
  amount: BN
}

export interface TopupRewardsAccounts {
  payer: TransactionSigner
  vaultState: Address
  tokenMint: Address
  tokenVault: Address
  payerTokenTa: Address
  tokenProgram: Address
}

export const layout = borsh.struct<TopupRewardsArgs>([borsh.u64("amount")])

export function topupRewards(
  args: TopupRewardsArgs,
  accounts: TopupRewardsAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    { address: accounts.payer.address, role: 2, signer: accounts.payer },
    { address: accounts.vaultState, role: 1 },
    { address: accounts.tokenMint, role: 0 },
    { address: accounts.tokenVault, role: 1 },
    { address: accounts.payerTokenTa, role: 1 },
    { address: accounts.tokenProgram, role: 0 },
    ...remainingAccounts,
  ]
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      amount: args.amount,
    },
    buffer
  )
  const data = Buffer.concat([DISCRIMINATOR, buffer]).slice(0, 8 + len)
  const ix: Instruction = { accounts: keys, programAddress, data }
  return ix
}
