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

export const DISCRIMINATOR = Buffer.from([102, 58, 189, 252, 192, 219, 140, 89])

export interface RedeemInKindArgs {
  sharesAmount: BN
}

export interface RedeemInKindAccounts {
  user: TransactionSigner
  vaultState: Address
  globalConfig: Address
  baseVaultAuthority: Address
  reserve: Address
  ctokenVault: Address
  userCtokenTa: Address
  ctokenMint: Address
  userSharesTa: Address
  sharesMint: Address
  reserveCollateralTokenProgram: Address
  sharesTokenProgram: Address
  klendProgram: Address
  eventAuthority: Address
  program: Address
}

export const layout = borsh.struct<RedeemInKindArgs>([
  borsh.u64("sharesAmount"),
])

export function redeemInKind(
  args: RedeemInKindArgs,
  accounts: RedeemInKindAccounts,
  remainingAccounts: Array<AccountMeta | AccountSignerMeta> = [],
  programAddress: Address = PROGRAM_ID
) {
  const keys: Array<AccountMeta | AccountSignerMeta> = [
    { address: accounts.user.address, role: 2, signer: accounts.user },
    { address: accounts.vaultState, role: 1 },
    { address: accounts.globalConfig, role: 0 },
    { address: accounts.baseVaultAuthority, role: 0 },
    { address: accounts.reserve, role: 1 },
    { address: accounts.ctokenVault, role: 1 },
    { address: accounts.userCtokenTa, role: 1 },
    { address: accounts.ctokenMint, role: 1 },
    { address: accounts.userSharesTa, role: 1 },
    { address: accounts.sharesMint, role: 1 },
    { address: accounts.reserveCollateralTokenProgram, role: 0 },
    { address: accounts.sharesTokenProgram, role: 0 },
    { address: accounts.klendProgram, role: 0 },
    { address: accounts.eventAuthority, role: 0 },
    { address: accounts.program, role: 0 },
    ...remainingAccounts,
  ]
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      sharesAmount: args.sharesAmount,
    },
    buffer
  )
  const data = Buffer.concat([DISCRIMINATOR, buffer]).slice(0, 8 + len)
  const ix: Instruction = { accounts: keys, programAddress, data }
  return ix
}
