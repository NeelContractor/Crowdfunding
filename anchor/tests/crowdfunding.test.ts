
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { Crowdfunding } from '../target/types/crowdfunding'
import { BN } from 'bn.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { resolve } from 'path'
import { Camera } from 'lucide-react'

describe('Crowdfunding', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Crowdfunding as Program<Crowdfunding>;
  
  const creator = anchor.web3.Keypair.generate();
  const donor1 = anchor.web3.Keypair.generate();
  const donor2 = anchor.web3.Keypair.generate();

  let campaignCounterPDA: PublicKey;
  let campaignPDA: PublicKey;
  let donationPDA1: PublicKey;
  let donationPDA2: PublicKey;
  let campaignBump: number;
  let campaignId = new BN(1);

  const ONE_SOL = new BN(1_000_000_000)
  const HALF_SOL = new BN(500_000_000)
  const TWO_SOL = new BN(2_000_000_000)
  const ONE_DAY_SECONDS = 24 * 60 * 60;
  const MAX_CAMPAIGN_DURATION = 365 * ONE_DAY_SECONDS;

  beforeAll(async () => {
    await provider.connection.requestAirdrop(creator.publicKey, 10 * ONE_SOL.toNumber())
    await provider.connection.requestAirdrop(donor1.publicKey, 10 * ONE_SOL.toNumber())
    await provider.connection.requestAirdrop(donor2.publicKey, 10 * ONE_SOL.toNumber())

    await new Promise(resolve => setTimeout(resolve, 1000));

    [campaignCounterPDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from("campaign_counter")],
      program.programId
    );

    // init campaign counter if it doesnt exist
    try {
      await program.account.campaignCounter.fetch(campaignCounterPDA);
    } catch {
      await program.methods
        .initializeCampaignCounter()
        .accounts({
          payer: provider.wallet.publicKey,
          campaignCounter: campaignCounterPDA,
          systemProgram: SystemProgram.programId
        } as any)
        .rpc();
    }
  });

  describe('init campaign', () => {
    it("should initialize a campaign successfully", async() => {
      const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
      campaignId = counterAccount.count;

      [campaignPDA, campaignBump] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), campaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      await program.methods
        .initializeCampaign(
          ONE_SOL,
          new BN(7 * ONE_DAY_SECONDS)
        )
        .accounts({
          creator: creator.publicKey,
          campaignCounter: campaignCounterPDA,
          campaign: campaignPDA,
          systemProgram: SystemProgram.programId
        } as any)
        .signers([creator])
        .rpc();

      const campaign = await program.account.campaign.fetch(campaignPDA);
      expect(campaign.creator.toBase58()).toEqual(creator.publicKey.toBase58());
      expect(campaign.id.toNumber()).toEqual(campaignId.toNumber());
      expect(campaign.goalAmount.toNumber()).toEqual(ONE_SOL.toNumber());
      expect(campaign.totalFunded.toNumber()).toEqual(0);
      expect(campaign.isActive).toEqual(true);
      expect(campaign.bump).toEqual(campaignBump)

      const updatedCounter = await program.account.campaignCounter.fetch(campaignCounterPDA);
      expect(updatedCounter.count.toNumber()).toEqual(campaignId.add(new BN(1)).toNumber());
    });

    it("should fail with invalid goal amount", async() => {
      const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
      const newCampaignId = counterAccount.count;

      const [newCampaignPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), newCampaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      try {
        await program.methods
          .initializeCampaign(
            new BN(0),
            new BN(7 * ONE_DAY_SECONDS)
          )
          .accounts({
            creator: creator.publicKey,
            campaignCounter: campaignCounterPDA,
            campaign: newCampaignPDA,
            systemProgram: SystemProgram.programId
          } as any)
          .signers([creator])
          .rpc();

          // should not reach here
        expect('Expected transaction to fail with InvalidGoalAmount error');
      } catch (error: any) {
        expect(error.error.errorCode.code).toContain('InvalidGoalAmount');
      }
    });

    it("should fail with invalid duration", async() => {
      const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
      const newCampaignId = counterAccount.count;

      const [newCampaignPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), newCampaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      try {
        await program.methods
          .initializeCampaign(
            ONE_SOL,
            new BN(0)
          )
          .accounts({
            creator: creator.publicKey,
            campaignCounter: campaignCounterPDA,
            campaign: newCampaignPDA,
            systemProgram: SystemProgram.programId
          } as any)
          .signers([creator])
          .rpc();

          // should not reach here
          expect("Expected transaction to fail with InvalidDuration error");
      } catch (error: any) {
        expect(error.error.errorCode.code).toContain('InvalidDuration');
      }
    });

    it("should fail with too long duration", async () => {
      const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
      const newCampaignId = counterAccount.count;

      const [newCampaignPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), newCampaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      try {
        await program.methods
          .initializeCampaign(
            ONE_SOL,
            new BN(MAX_CAMPAIGN_DURATION + 1)
          )
          .accounts({
            creator: creator.publicKey,
            campaignCounter: campaignCounterPDA,
            campaign: newCampaignPDA,
            systemProgram: SystemProgram.programId
          } as any)
          .signers([creator])
          .rpc();
          
          // should not reach here
          expect("Expected transaction to fail with DurationTooLong");
      } catch (error: any) {
        expect(error.error.errorCode.code).toContain('DurationTooLong');
      }
    });
  });

  describe("Donate", () => {
    it("should let a donor contribute to a campaign", async() => {
      [donationPDA1] = await PublicKey.findProgramAddressSync(
        [Buffer.from("donation"), campaignPDA.toBuffer(), donor1.publicKey.toBuffer()],
        program.programId
      );

      const initialCampaignBalance = await provider.connection.getBalance(campaignPDA);

      await program.methods
        .donate(HALF_SOL)
        .accounts({
          campaign: campaignPDA,
          donor: donor1.publicKey,
          donation: donationPDA1,
          systemProgram: SystemProgram.programId
        }as any)
        .signers([donor1])
        .rpc();

        const donation = await program.account.donation.fetch(donationPDA1);
        expect(donation.donor.toBase58()).toEqual(donor1.publicKey.toBase58());
        expect(donation.campaign.toBase58()).toEqual(campaignPDA.toBase58());
        expect(donation.amount.toNumber()).toEqual(HALF_SOL.toNumber());
        expect(donation.refunded).toBeFalsy();

        const campaign = await program.account.campaign.fetch(campaignPDA);
        expect(campaign.totalFunded.toNumber()).toEqual(HALF_SOL.toNumber());

        const finalCampaignBalance = await provider.connection.getBalance(campaignPDA);
        expect(finalCampaignBalance - initialCampaignBalance).toEqual(HALF_SOL.toNumber());
    });

    it("should allow multiple donations from different donors", async () => {
      [donationPDA2] = await PublicKey.findProgramAddressSync(
        [Buffer.from("donation"), campaignPDA.toBuffer(), donor2.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .donate(ONE_SOL)
        .accounts({
          campaign: campaignPDA,
          donor: donor2.publicKey,
          donation: donationPDA2,
          systemProgram: SystemProgram.programId
        } as any)
        .signers([donor2])
        .rpc();

        const campaign = await program.account.campaign.fetch(campaignPDA);
        expect(campaign.totalFunded.toNumber()).toEqual(HALF_SOL.add(ONE_SOL).toNumber());
    });

    it("should fail with invalid amount", async() => {
      try {
        await program.methods
          .donate(new BN(0))
          .accounts({
            campaign: campaignPDA,
            donor: donor1.publicKey,
            systemProgram: SystemProgram.programId
          } as any)
          .signers([donor1])
          .rpc();

          expect("Expected transaction to fail with InvalidAmount error");
      } catch(error: any) {
        console.log(error);
        expect(error).toContain("InvalidAmount");
      }
    });
  });

  describe("Finalize campaign", () => {
    let successfulCampaignPDA: PublicKey;
    let failedCampaignPDA: PublicKey;

    beforeAll(async() => {
      const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
      const successfulCampaignId = counterAccount.count;

      [successfulCampaignPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), successfulCampaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      await program.methods
        .initializeCampaign(ONE_SOL, new BN(2))
        .accounts({
          creator: creator.publicKey,
          campaignCounter: campaignCounterPDA,
          campaign: successfulCampaignPDA,
          systemProgram: SystemProgram.programId
        } as any)
        .signers([creator])
        .rpc()

      // fund with 1.5 sol(over the goal)
      const [successfulDonationPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("donation"), successfulCampaignPDA.toBuffer(), donor1.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .donate(ONE_SOL.add(HALF_SOL))
        .accounts({
          campaign: successfulCampaignPDA,
          donor: donor1.publicKey,
          donation: successfulDonationPDA,
          systemProgram: SystemProgram.programId
        }as any)
        .signers([donor1])
        .rpc();

      const updatedCounter = await program.account.campaignCounter.fetch(campaignCounterPDA);
      const failedCampaignId = updatedCounter.count;

      [failedCampaignPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), failedCampaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      await program.methods
        .initializeCampaign(TWO_SOL, new BN(2))
        .accounts({
          creator: creator.publicKey,
          campaignCounter: campaignCounterPDA,
          campaign: failedCampaignPDA,
          systemProgram: SystemProgram.programId
        }as any)
        .signers([creator])
        .rpc();

      const [failedDonationPDA] =await PublicKey.findProgramAddressSync(
        [Buffer.from("donation"), failedCampaignPDA.toBuffer(), donor1.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .donate(HALF_SOL)
        .accounts({
          campaign: failedCampaignPDA,
          donor: donor1.publicKey,
          donation: failedDonationPDA,
          systemProgram: SystemProgram.programId
        }as any)
        .signers([donor1])
        .rpc();

      await new Promise(resolve => setTimeout(resolve, 3000));
    });

    it("should fail to finalize active campaign", async() => {
      try {
        await program.methods
          .finalizeCampaign()
          .accounts({
            creator: creator.publicKey,
            campaign: campaignPDA,
            systemProgram: SystemProgram.programId
          }as any)
          .signers([creator])
          .rpc();
        
          expect("EXpected transaction to fail with CampaignNotEnded error");
      } catch(error: any) {
        expect(error.error.errorCode.code).toContain("CampaignNotEnded");
      }
    })

    it('should finalize successful campaign and transfer funds to creator', async () => {
        // Get initial balances
        const initialCreatorBalance = await provider.connection.getBalance(creator.publicKey);
        const initialCampaignBalance = await provider.connection.getBalance(successfulCampaignPDA);
        
        // Finalize the successful campaign
        await program.methods
          .finalizeCampaign()
          .accounts({
            creator: creator.publicKey,
            campaign: successfulCampaignPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          }as any)
          .signers([creator])
          .rpc();
        
        // Verify campaign is now inactive
        const campaign = await program.account.campaign.fetch(successfulCampaignPDA);
        expect(campaign.isActive).toBeFalsy();
        
        // Verify funds transferred to creator
        const finalCreatorBalance = await provider.connection.getBalance(creator.publicKey);
        const finalCampaignBalance = await provider.connection.getBalance(successfulCampaignPDA);
        
        // Account for transaction fees in the assertion
        expect(finalCreatorBalance).toBeGreaterThan(initialCreatorBalance);
        expect(finalCampaignBalance).toBeLessThan(initialCampaignBalance);
      });
      
      it('should finalize unsuccessful campaign without transferring funds', async () => {
        // Finalize the failed campaign
        await program.methods
          .finalizeCampaign()
          .accounts({
            creator: creator.publicKey,
            campaign: failedCampaignPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .signers([creator])
          .rpc();
        
        // Verify campaign is now inactive
        const campaign = await program.account.campaign.fetch(failedCampaignPDA);
        expect(campaign.isActive).toBeFalsy();
        
        // Campaign should still hold the funds for refunds
        const campaignBalance = await provider.connection.getBalance(failedCampaignPDA);
        expect(campaignBalance).toEqual(HALF_SOL.toNumber());
      });
      
      it('should fail when non-creator tries to finalize', async () => {
        // Create a new campaign for this test
        const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
        const newCampaignId = counterAccount.count;
        
        const [newCampaignPDA] = await PublicKey.findProgramAddressSync(
          [Buffer.from("campaign"), newCampaignId.toArrayLike(Buffer, 'le', 8)],
          program.programId
        );
        
        // Create campaign with 1 SOL goal and very short duration
        await program.methods
          .initializeCampaign(ONE_SOL, new BN(2)) // 2 seconds duration
          .accounts({
            creator: creator.publicKey,
            campaignCounter: campaignCounterPDA,
            campaign: newCampaignPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          }as any)
          .signers([creator])
          .rpc();
        
        // Wait for campaign to end
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
          // Try to finalize with a different account (donor1)
          await program.methods
            .finalizeCampaign()
            .accounts({
              creator: donor1.publicKey,
              campaign: newCampaignPDA,
              systemProgram: anchor.web3.SystemProgram.programId,
            }as any)
            .signers([donor1])
            .rpc();
          
          // Should not reach here
          expect('Expected transaction to fail due to constraint violation');
        } catch (error: any) {
          // This should be a constraint error about creator != campaign.creator
          expect(error.error.errorCode.code).toContain('Constraint');
        }
      });
  })

  describe('Refund', () => {
    let refundCampaignPDA: PublicKey;
    let refundDonationPDA: PublicKey;
    
    beforeAll(async () => {
      // Create a new campaign for refund testing
      const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
      const refundCampaignId = counterAccount.count;
      
      [refundCampaignPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), refundCampaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      
      // Create campaign with 2 SOL goal and very short duration
      await program.methods
        .initializeCampaign(TWO_SOL, new BN(2)) // 2 seconds duration
        .accounts({
          creator: creator.publicKey,
          campaignCounter: campaignCounterPDA,
          campaign: refundCampaignPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        }as any)
        .signers([creator])
        .rpc();
      
      // Fund it with only 0.5 SOL (under the goal)
      [refundDonationPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("donation"), refundCampaignPDA.toBuffer(), donor1.publicKey.toBuffer()],
        program.programId
      );
      
      await program.methods
        .donate(HALF_SOL)
        .accounts({
          campaign: refundCampaignPDA,
          donor: donor1.publicKey,
          donation: refundDonationPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        }as any)
        .signers([donor1])
        .rpc();
      
      // Wait for campaign to end
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Finalize the campaign
      await program.methods
        .finalizeCampaign()
        .accounts({
          creator: creator.publicKey,
          campaign: refundCampaignPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        }as any)
        .signers([creator])
        .rpc();
    });
    
    it('should allow donor to get refund from failed campaign', async () => {
      // Get initial balances
      const initialDonorBalance = await provider.connection.getBalance(donor1.publicKey);
      const initialCampaignBalance = await provider.connection.getBalance(refundCampaignPDA);
      
      // Process refund
      await program.methods
        .refund()
        .accounts({
          donor: donor1.publicKey,
          campaign: refundCampaignPDA,
          donation: refundDonationPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        }as any)
        .signers([donor1])
        .rpc();
      
      // Verify donation marked as refunded
      const donation = await program.account.donation.fetch(refundDonationPDA);
      expect(donation.refunded).toBeTruthy();
      
      // Verify funds transferred back to donor
      const finalDonorBalance = await provider.connection.getBalance(donor1.publicKey);
      const finalCampaignBalance = await provider.connection.getBalance(refundCampaignPDA);
      
      // Account for transaction fees in the assertion
      expect(finalDonorBalance).toBeGreaterThan(initialDonorBalance);
      expect(finalCampaignBalance).toBeLessThan(initialCampaignBalance);
      expect(initialCampaignBalance - finalCampaignBalance).toEqual(HALF_SOL.toNumber());
    });
    
    it('should not allow double refunds', async () => {
      try {
        // Try to refund again
        await program.methods
          .refund()
          .accounts({
            donor: donor1.publicKey,
            campaign: refundCampaignPDA,
            donation: refundDonationPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          }as any)
          .signers([donor1])
          .rpc();
        
        // Should not reach here
        expect('Expected transaction to fail with AlreadyRefunded error');
      } catch (error: any) {
        expect(error.error.errorCode.code).toContain('AlreadyRefunded');
      }
    });
    
    it('should not allow refunds from successful campaigns', async () => {
      // Create a new successful campaign
      const counterAccount = await program.account.campaignCounter.fetch(campaignCounterPDA);
      const successCampaignId = counterAccount.count;
      
      const [successCampaignPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), successCampaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      
      // Create campaign with low goal (0.1 SOL) and short duration
      await program.methods
        .initializeCampaign(new BN(100_000_000), new BN(2)) // 0.1 SOL, 2 seconds
        .accounts({
          creator: creator.publicKey,
          campaignCounter: campaignCounterPDA,
          campaign: successCampaignPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        }as any)
        .signers([creator])
        .rpc();
      
      // Fund it with 0.5 SOL (over the goal)
      const [successDonationPDA] = await PublicKey.findProgramAddressSync(
        [Buffer.from("donation"), successCampaignPDA.toBuffer(), donor2.publicKey.toBuffer()],
        program.programId
      );
      
      await program.methods
        .donate(HALF_SOL)
        .accounts({
          campaign: successCampaignPDA,
          donor: donor2.publicKey,
          donation: successDonationPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        }as any)
        .signers([donor2])
        .rpc();
      
      // Wait for campaign to end
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Finalize the campaign
      await program.methods
        .finalizeCampaign()
        .accounts({
          creator: creator.publicKey,
          campaign: successCampaignPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        }as any)
        .signers([creator])
        .rpc();
      
      try {
        // Try to refund from successful campaign
        await program.methods
          .refund()
          .accounts({
            donor: donor2.publicKey,
            campaign: successCampaignPDA,
            donation: successDonationPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .signers([donor2])
          .rpc();
        
        // Should not reach here
        expect('Expected transaction to fail with CampaignSuccessful error');
      } catch (error: any) {
        expect(error.error.errorCode.code).toContain('CampaignSuccessful');
      }
    });
  });
})
