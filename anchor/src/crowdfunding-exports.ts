// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import CrowdfundingIDL from '../target/idl/crowdfunding.json'
import type { Crowdfunding } from '../target/types/crowdfunding'

// Re-export the generated IDL and type
export { Crowdfunding, CrowdfundingIDL }

// The programId is imported from the program IDL.
export const CROWDFUNDING_PROGRAM_ID = new PublicKey(CrowdfundingIDL.address)

// This is a helper function to get the Counter Anchor program.
export function getCrowdfundingProgram(provider: AnchorProvider, address?: PublicKey): Program<Crowdfunding> {
  return new Program({ ...CrowdfundingIDL, address: address ? address.toBase58() : CrowdfundingIDL.address } as Crowdfunding, provider)
}

// This is a helper function to get the program ID for the Counter program depending on the cluster.
export function getCrowdfundingProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the Counter program on devnet and testnet.
      return new PublicKey('BkpRdi7GmMvmkE9KtUDHKhSYbdFEGVZepP2XjjPJNWHX')
    case 'mainnet-beta':
    default:
      return CROWDFUNDING_PROGRAM_ID
  }
}
