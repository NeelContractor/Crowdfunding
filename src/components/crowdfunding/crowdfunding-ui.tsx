'use client'

import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useState } from 'react'
import { useCrowdfundingProgram, useCrowdfundingProgramAccount } from './crowdfunding-data-access'
import { Button } from '@/components/ui/button'
import { Input } from '../ui/input'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from '../ui/label'
import { useWallet } from '@solana/wallet-adapter-react'
import { CROWDFUNDING_PROGRAM_ID } from '@project/anchor'

// export function CounterCreate() {
//   const { initializeCampaign } = useCrowdfundingProgram()

//   return (
//     <Button onClick={() => initializeCampaign.mutateAsync({})} disabled={initializeCampaign.isPending}>
//       Create {initializeCampaign.isPending && '...'}
//     </Button>
//   )
// }

export function CrowdfundingList() {
  const { accounts, getProgramAccount } = useCrowdfundingProgram()
  // const { donate } = useCrowdfundingProgramAccount();

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info grid justify-center ">
        <div className='pt-10'>
          <span className='flex justify-center items-center text-2xl font-bold'>No Campaign yet. Create One.</span>
          <span className='flex justify-center'>
            <CrowdfundinfInitCampaignCard />
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={'space-y-6'}>
      {accounts.isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : accounts.data?.length ? (
        <div className='grid'>
          <div className='text-center'>
            <CrowdfundinfInitCampaignCard />
          </div>
          <h1 className='text-2xl font-bold justify-start py-5'>Featured Projects/Campaign</h1>
          <div className='grid grid-cols-2 gap-5'>
            {accounts.data.map((campaign) => (
              <DonateCard account={campaign.publicKey} key={campaign.publicKey.toString()} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <h2 className={'text-2xl'}>No accounts</h2>
          <h5>No accounts found. Create one above to get started.</h5>
          <div><CrowdfundinfInitCampaignCard /></div>
        </div>
      )}
    </div>
  )
}

function CrowdfundinfInitCampaignCard() {
  const [fundsGoal, setFundingGoal] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { publicKey } = useWallet();

  const { initializeCampaign } = useCrowdfundingProgram();

  const isValid = fundsGoal > 0 && duration > 0;
  const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
  
    // TODO: createCampaign
    const handleSumbit = () => {
      setIsLoading(true);

      console.log("time", duration)
      console.log("amount", fundsGoal)

      if (publicKey && isValid) {
        const [campaignCounterPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("campaign_counter")],
          CROWDFUNDING_PROGRAM_ID
        );
        initializeCampaign.mutateAsync({ goal_amount: fundsGoal * LAMPORTS_PER_SOL, duration: duration * ONE_DAY_IN_SECONDS, creator: publicKey, campaignCounterPDA });
      }
  };

  return <Dialog>
    <DialogTrigger className={"bg-white text-black text-lg font-semibold py-2 px-3 rounded-lg m-5"}>Create Campaign</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-white text-gray-900 rounded-lg shadow-lg p-6">
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-3xl font-extrabold text-purple-700">
            Start A Campaign
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-600">
            Support this project and make a difference!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-3">
            <Label
              htmlFor="fundsGoal"
              className="text-lg font-semibold text-gray-700"
            >
              Funding Goal (SOL)
            </Label>
            <Input
              id="fundsGoal"
              type="number"
              value={fundsGoal || ""}
              onChange={(e) => setFundingGoal(parseFloat(e.target.value))}
              className="bg-gray-100 text-gray-900 border-gray-300 rounded-lg px-4 py-2"
              placeholder="Enter funding goal"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-3">
            <Label
              htmlFor="duration"
              className="text-lg font-semibold text-gray-700"
            >
              Duration (days)
            </Label>
            <Input
              id="duration"
              type="number"
              value={duration || ""}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="bg-gray-100 text-gray-900 border-gray-300 rounded-lg px-4 py-2"
              placeholder="Enter campaign duration"
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter className="mt-8">
          <Button
            onClick={() => {
              handleSumbit()
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg font-semibold rounded-lg transition-all"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Campaign...
              </>
            ) : (
              "Create Campaign"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

}

function DonateCard({ account }: { account: PublicKey }) {
  const { accountQuery, donate, finalizeCampaign, refund } = useCrowdfundingProgramAccount({
    account
  })
  const [donationAmount, setDonationAmount] = useState<number>(0);
  const { publicKey } = useWallet()

  const isValid = donationAmount > 0;
  const handleOnDonate = () => {
    if (publicKey && isValid) {
      donate.mutateAsync({ amount: donationAmount, donorPubkey: publicKey, campaignPDA: account })
    }
  }

  const unixToTime = (unix: number): string => {
    const date = new Date(unix * 1000);
    return date.toLocaleString();
  }

  // finalize campaign logic
  const endTimeBN = accountQuery.data?.endTime;
  const endTime = endTimeBN ? new Date(endTimeBN.toNumber() * 1000) : null;
  const now = new Date();
  const canClaim = endTime && now > endTime;

  const finalizeIsValid = publicKey == accountQuery.data?.creator && canClaim

  const handleOnFinalize = () => {
    if (finalizeIsValid) {
      finalizeCampaign.mutateAsync({ campaign: account, signerPubkey: publicKey })
    }
  }

  const RefundIsValid = canClaim;
  const handleOnRefund = () => {
    if (publicKey && RefundIsValid) {
      refund.mutateAsync({ donor: publicKey, campaign: account })
    }
  }

  return accountQuery.isLoading ? (
    <span className='loading loading-spinner loading-lg'></span>
  ) : (
    <div key={accountQuery?.data?.id.toNumber()} className='border bg-[#171717] rounded-lg p-2'>
      <div className='text-right flex text-sm gap-1'>Is Active: {
        accountQuery?.data?.isActive == true ? (
          <span className='flex items-center self-center rounded-full bg-green-400 p-1 w-1 h-1'></span> ) : (
          <span className='rounded-full bg-red-400'></span>
        )}
      </div>
      <div className='text-sm'>Campaign Creator: <span className='text-sm font-bold'>{accountQuery?.data?.creator.toBase58()}</span></div>
      <div className='text-sm'>Goal Amount: <span className='text-sm font-bold'>{accountQuery?.data?.goalAmount ? accountQuery.data.goalAmount.toNumber() / LAMPORTS_PER_SOL : 'N/A'} SOL</span></div>
      <div className='text-sm'>Total Fund: <span className='text-sm font-bold'>{accountQuery?.data?.totalFunded.toNumber()} SOL</span></div>
      <div className='text-sm text-right'>End In: <span className='text-sm font-bold'>{
        accountQuery?.data?.endTime !== undefined
          ? unixToTime(accountQuery.data.endTime.toNumber())
          : 'N/A'
      }</span></div>
      <div> 
        {/* porgress bar not working */}
        {/* <Progress
          value={
            accountQuery.data?.goalAmount && accountQuery.data?.totalFunded
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    (accountQuery.data.totalFunded.toNumber() / accountQuery.data.goalAmount.toNumber()) * 100
                  )
                )
              : 0
          }
        /> */}
      </div>
      <Dialog>
        <DialogTrigger className=' text-black font-semibold bg-gray-200 w-full rounded-lg py-1 hover:bg-gray-300 mt-3'>Make Donation</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Support this project and make a difference!</DialogTitle>
            <DialogDescription>
              Donation Amount (SOL)
            </DialogDescription>
              <Input
                placeholder='Enter Donation Amount'
                value={donationAmount}
                className='my-2'
                type='number'
                onChange={(e) => {
                  setDonationAmount(Number(e.target.value))
                }}
              />
              <Button
                className='hover:bg-[#D8B4FE] text-semibold text-black'
                onClick={() => {
                  handleOnDonate()
                }}
              >Donate</Button>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      { // TODO: add logic to show button only if the time is more than endtime and totalamount is more than goal and publickey is same as creator pubkey.
        canClaim ? (
          <Button
            className='w-full mt-2 font-bold text-black'
            onClick={() => {
              handleOnFinalize()
            }}
          >Finalize Campaign Claim Funds</Button>
        ) : null
      }
      { RefundIsValid ? (
        <Button
          className='w-full mt-2 font-bold text-black'
          onClick={() => {
            handleOnRefund()
          }}
        >Claim Refund</Button>
      ) : null
      }
    </div>
  )
}