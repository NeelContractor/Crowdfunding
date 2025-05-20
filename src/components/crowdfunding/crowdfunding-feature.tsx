'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { CrowdfundingList } from './crowdfunding-ui'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import Link from 'next/link'
import Image from 'next/image'
import { PublicKey } from '@solana/web3.js'
import { Button } from '../ui/button'
import { useRouter } from 'next/navigation'

const ADMIN_PUBLICKEY = new PublicKey("NeeF4wurno255WqxWwgTsXK6EWkwNkZiRkxHZE919AD");

export default function CounterFeature() {
  const { publicKey } = useWallet()
  const router = useRouter();

  return publicKey ? (
    <div className='bg-black text-white'>
      <div className='border-b border-gray-700 py-3 px-2 flex justify-between'>
        <div>
          <h1 className='font-bold text-2xl'>Crowdfunding</h1>
        </div>
        <div className='flex justify-center items-center gap-4'>
          <Link href={"#projects"} style={{scrollBehavior: "smooth"}}>Projects</Link>
          <Link href={"#stats"} style={{scrollBehavior: "smooth"}}>Stats</Link>
          <Link href={"#about"} style={{scrollBehavior: "smooth"}}>About Us</Link>
        </div>
        <div className='flex justify-center gap-2'>
          <div>
            {publicKey && publicKey.equals(ADMIN_PUBLICKEY) ? (
              <Button
                className='bg-white text-black'
                onClick={() => {
                  router.push("/dashboard")
                }}
              >Go to Dashboard</Button>
            ) : null }
          </div>
          <WalletMultiButton />
        </div>
      </div>
      <div>
        <h1 className='text-6xl font-bold text-center pt-10'>Empower Change with Solana</h1>
        <h5 className='text-center text-xl pt-3'>Fund innovative projects or create your own campaign on our decentralized platform.</h5>
      </div>
      <div id="projects">
        <CrowdfundingList />
      </div>
      <div id='stats' className='grid justify-center'>
        <h1 className='text-4xl font-bold text-[#D8B4FE] text-center py-10'>Platform Statistics</h1>
        <div className='grid grid-cols-3 gap-10 '>
          <div className='bg-[#171717] grid rounded-lg py-10 px-15'>
            <div className='flex justify-center gap-4 '>
              <Image src={"/arrow.png"} alt='Arrow' width={50} height={50}  />
              <h1 className='text-2xl text-[#D8B4FE]'>Total Raised</h1>
            </div>
            <h1 className='text-3xl font-bold'>50,000 SOL</h1>
          </div>
          <div className='bg-[#171717] grid rounded-lg py-10 px-15'>
            <div className='flex justify-center gap-4 '>
              <Image src={"/peoples.png"} alt='Arrow' width={40} height={40}  />
              <h1 className='text-2xl text-[#D8B4FE]'>Active Projects</h1>
            </div>
            <h1 className='text-3xl font-bold'>250+</h1>
          </div>
          <div className='bg-[#171717] grid rounded-lg py-10 px-15'>
            <div className='flex justify-center gap-4 '>
              <Image src={"/dollar.png"} alt='Arrow' width={40} height={40}  />
              <h1 className='text-2xl text-[#D8B4FE]'>Avg. Donation</h1>
            </div>
            <h1 className='text-3xl font-bold'>20 SOL</h1>
          </div>
        </div>
      </div>
      <div id="about">
        <div className='border-t grid grid-cols-4 gap-4 my-10'>
          <div>
            <h1 className='py-3 font-semibold'>About Us</h1>
            <p className='text-sm text-gray-400'>Empowering innovation through decentralized crowdfunding on Solana.</p>
          </div>
          <div>
            <h1 className='py-3 font-semibold'>Quick Links</h1>
            <div className='grid'>
              <Link href={"#"} className='text-sm text-gray-400'>How It Works</Link>
              <Link href={"#"} className='text-sm text-gray-400'>Start a Project</Link>
              <Link href={"#"} className='text-sm text-gray-400'>Explore Projects</Link>
            </div>
          </div>
          <div>
            <h1 className='py-3 font-semibold'>Legal</h1>
            <div className='grid'>
              <Link href={"#"} className='text-sm text-gray-400'>Terms of Service</Link>
              <Link href={"#"} className='text-sm text-gray-400'>Privacy Policy</Link>
              <Link href={"#"} className='text-sm text-gray-400'>Cookie Policy</Link>
            </div>
          </div>
          <div>
            <h1 className='py-3 font-semibold'>Connect</h1>
            <div className='grid'>
              <Link href={"#"} className='text-sm text-gray-400'>Twitter</Link>
              <Link href={"#"} className='text-sm text-gray-400'>Discord</Link>
              <Link href={"#"} className='text-sm text-gray-400'>GitHub</Link>
            </div>
          </div>
        </div>
        <div>
          <h3 className='text-gray-500 text-center border-t py-2 text-sm'>© 2025 Solana Crowdfunding. All rights reserved.</h3>
        </div>
      </div>
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  )
}
