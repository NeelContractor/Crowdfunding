'use client'

import { getCrowdfundingProgram, getCrowdfundingProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey, SystemProgram } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import { BN } from 'bn.js'

interface InitializeCampaignArgs {
  goal_amount: number,
  duration: number,
  creator: PublicKey,
  campaignCounterPDA: PublicKey
}

interface DonateArgs {
  amount: number, 
  donorPubkey: PublicKey, 
  campaignPDA: PublicKey
}

interface FinalizeCampaignArgs {
  signerPubkey: PublicKey
  campaign: PublicKey
}

interface RefundArgs {
  donor: PublicKey,
  campaign: PublicKey,
}

// interface CampaignCounter {
//   count: number
// }

interface IntilializeCamapignCounterArgs {
  creator: PublicKey
}

export function useCrowdfundingProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getCrowdfundingProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getCrowdfundingProgram(provider, programId), [provider, programId])

  const accounts = useQuery({
    queryKey: ['crowdfunding', 'all', { cluster }],
    queryFn: () => program.account.campaign.all(),
  })

  const counterAccounts = useQuery({
    queryKey: ['crowdfunding', "all", { cluster }],
    queryFn: () => program.account.campaignCounter.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const CamapignCounter = useMutation({
    mutationKey: ["crowdfunding", 'campaignCounter', { cluster }],
    mutationFn: async () => {
      const [campaignCounterPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign_counter")],
        program.programId
      );

      await program.methods
        .initializeCampaignCounter()
        .accounts({
          payer: provider.wallet.publicKey,
          campaignCounter: campaignCounterPDA,
          systemProgram: SystemProgram.programId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .rpc();

      return await program.account.campaignCounter.fetch(campaignCounterPDA);
    }
  })

  const initializeCampaign = useMutation<string, Error, InitializeCampaignArgs>({
    mutationKey: ['crowdfunding', 'initialize', { cluster }],
    mutationFn: async ({goal_amount, duration, creator, campaignCounterPDA}) => {

      const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
      const campaignId = counterAccount.count;

      const [campaignPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), new BN(campaignId).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      return await program.methods
        .initializeCampaign(
          new BN(goal_amount),
          new BN(duration)
        )
        .accounts({
          creator: creator,
          campaignCounter: campaignCounterPDA,
          campaign: campaignPda
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .signers([])
        .rpc()
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      return accounts.refetch()
    },
    onError: () => toast.error('Failed to initialize account'),
  })

  const intilializeCamapignCounter = useMutation<string, Error, IntilializeCamapignCounterArgs>({
    mutationKey: ['crowdfunding', 'initialize', { cluster }],
    mutationFn: async ({ creator }) => {
      const [campaignCounterPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("campaign_counter")],
        program.programId
      );

      return await program.methods
        .initializeCampaignCounter()
        .accounts({
          payer: creator,
          campaignCounter: campaignCounterPDA,
          systemProgram: SystemProgram.programId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      return accounts.refetch()
    },
    onError: () => toast.error('Failed to initialize campaign counter'),
  })

  return {
    program,
    programId,
    accounts,
    CamapignCounter,
    intilializeCamapignCounter,
    counterAccounts,
    getProgramAccount,
    initializeCampaign,
  }
}

export function useCrowdfundingProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, accounts } = useCrowdfundingProgram()

  const accountQuery = useQuery({
    queryKey: ['counter', 'fetch', { cluster, account }],
    queryFn: () => program.account.campaign.fetch(account),
  })

  const donate = useMutation<string, Error, DonateArgs>({
    mutationKey: ['counter', 'close', { cluster, account }],
    mutationFn: async({ amount, donorPubkey, campaignPDA }) => {
      const [donationPDA1] = await PublicKey.findProgramAddressSync(
        [Buffer.from("donation"), campaignPDA.toBuffer(), donorPubkey.toBuffer()],
        program.programId
      );

      return await program.methods
        .donate(
          new BN(amount)
        )
        .accounts({ 
          donor: donorPubkey,
          campaign: campaignPDA,
          donation: donationPDA1, 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }as any)
        .signers([])
        .rpc()
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return accounts.refetch()
    },
  })

  const finalizeCampaign = useMutation<string, Error, FinalizeCampaignArgs>({
    mutationKey: ['counter', 'decrement', { cluster, account }],
    mutationFn: async ({ campaign, signerPubkey }) => {


      return await program.methods
        .finalizeCampaign()
        .accounts({ 
          campaign: campaign,
          creator: signerPubkey
        })
        .signers([])
        .rpc()
      },
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  const refund = useMutation<string, Error, RefundArgs>({
    mutationKey: ['counter', 'increment', { cluster, account }],
    mutationFn: async({ donor, campaign }) => {
      const [donationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("donation"), campaign.toBuffer(), donor.toBuffer()],
        program.programId
      );

      return await program.methods
        .refund()
        .accounts({ 
          donor,
          campaign: campaign,
          donation: donationPda
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }as any)
        .signers([])
        .rpc()
      },
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  return {
    accountQuery,
    donate,
    finalizeCampaign,
    refund,
    // setMutation,
  }
}
