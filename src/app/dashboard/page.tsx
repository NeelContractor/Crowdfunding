"use client"
import { useCrowdfundingProgram } from "@/components/crowdfunding/crowdfunding-data-access";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useRouter } from "next/navigation";

const ADMIN_PUBLICKEY = new PublicKey("NeeF4wurno255WqxWwgTsXK6EWkwNkZiRkxHZE919AD");

export default function Dashboard() {
    const { publicKey } = useWallet();
    const router = useRouter();
    const { CamapignCounter, intilializeCamapignCounter } = useCrowdfundingProgram();
    console.log("counter count", CamapignCounter.data?.count);

    const handleInitCounter = () => {
        if (!publicKey) return;
        intilializeCamapignCounter.mutateAsync({ creator: publicKey });
    }

    if (publicKey?.toBase58() != ADMIN_PUBLICKEY.toBase58()) {
        return <div>
            <div className="">Sorry this page is not accessable to you.</div>
            <Button
                onClick={() => {
                    router.push("/crowdfunding")
                }}
            >Return to Home Page</Button>
        </div>
    }

    return <div className="grid justify-center items-center gap-4">
        <div className="flex justify-between">
            <Button
                onClick={() => {
                    router.push("/")
                }}
            >Back to Home Page</Button>
            <WalletMultiButton />
        </div>
        <div>
            <h1 className="text-5xl font-bold">Dashboard Only for Admin</h1>
        </div>
        <div className="grid juctify-center items-center pt-20">
            <div className="flex justify-center" >
                <Button
                    onClick={() => {
                        handleInitCounter()
                    }}
                >InitializeCampaignCounter</Button>
            </div>
            <h3 className="text-center text-xl">Campaign Count: {CamapignCounter.data?.count.toNumber()}</h3>
            {CamapignCounter.data?.count.toNumber()}
        </div>
    </div>
}