#![allow(unexpected_cfgs)]
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("BkpRdi7GmMvmkE9KtUDHKhSYbdFEGVZepP2XjjPJNWHX");

#[constant]
pub const MAX_CAMPAIGN_DURATION: i64 = 365 * 24 * 60 * 60; // 1 year in seconds


#[program]
pub mod crowdfunding {
    use super::*;

    pub fn initialize_campaign_counter(ctx: Context<InitializeCampaignCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.campaign_counter;
        counter.count = 0;
        Ok(())
    }

    pub fn initialize_campaign(ctx: Context<InitializeCampaign>, goal_amount: u64, duration: i64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let counter = &mut ctx.accounts.campaign_counter;

        require!(duration <= MAX_CAMPAIGN_DURATION, CrowdfundingError::DurationTooLong);
        require!(goal_amount > 0, CrowdfundingError::InvalidGoalAmount);
        require!(duration > 0, CrowdfundingError::InvalidDuration);

        campaign.creator = ctx.accounts.creator.key();
        campaign.id = counter.count;
        campaign.goal_amount = goal_amount;
        campaign.end_time = Clock::get()?.unix_timestamp + duration;
        campaign.total_funded = 0;
        campaign.is_active = true;
        campaign.bump = ctx.bumps.campaign;

        counter.count = counter.count.checked_add(1).ok_or(CrowdfundingError::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        require!(campaign.is_active, CrowdfundingError::CampaignInactive);
        require!(Clock::get()?.unix_timestamp < campaign.end_time, CrowdfundingError::CampaignEnded);
        require!(amount > 0, CrowdfundingError::InvalidAmount);

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer { 
                    from: ctx.accounts.donor.to_account_info(), 
                    to: campaign.to_account_info(), 
                    }
                ),
                amount
            )?;

            campaign.total_funded = campaign.total_funded.checked_add(amount).ok_or(CrowdfundingError::ArithmeticOverflow)?;

            let donation = &mut ctx.accounts.donation;
            donation.donor = ctx.accounts.donor.key();
            donation.campaign = campaign.key();
            donation.amount = amount;
            donation.refunded = false;
            donation.bump = ctx.bumps.donation;

        Ok(())
    }

    pub fn finalize_campaign(ctx: Context<FinalizeCampaign>, ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        require!(Clock::get()?.unix_timestamp >= campaign.end_time, CrowdfundingError::CampaignNotEnded);

        
        if campaign.total_funded >= campaign.goal_amount {
            let seeds = &[
                b"campaign",
                &campaign.id.to_le_bytes()[..],
                &[campaign.bump]
                ];
                let signer_seeds: &[&[&[u8]]] = &[&seeds[..]];
                
                transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        Transfer {
                            from: campaign.to_account_info(),
                            to: ctx.accounts.creator.to_account_info(),
                        },
                        &signer_seeds
                    ), campaign.total_funded
                )?;
            }
            
        campaign.is_active = false;

        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let donation = &mut ctx.accounts.donation;

        require!(!campaign.is_active, CrowdfundingError::CampaignIsStillActive);
        require!(campaign.total_funded < campaign.goal_amount, CrowdfundingError::CampaignSuccessful);

        require!(donation.donor == ctx.accounts.donor.key(), CrowdfundingError::InvalidDonor);
        require!(!donation.refunded, CrowdfundingError::AlreadyRefunded);

        let seeds = &[
            b"campaign",
            &campaign.id.to_le_bytes()[..],
            &[campaign.bump]
        ];
        let signer_seeds: &[&[&[u8]]] = &[&seeds[..]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer { 
                    from: campaign.to_account_info(), 
                    to: ctx.accounts.donor.to_account_info()
                }, &signer_seeds
            ), donation.amount
        )?;

        campaign.total_funded = campaign.total_funded.saturating_sub(donation.amount);
        donation.refunded = true;

        Ok(())
    }

}

#[derive(Accounts)]
pub struct InitializeCampaignCounter<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer, 
        space = 8 + CampaignCounter::INIT_SPACE,
        seeds = [b"campaign_counter"],
        bump
    )]
    pub campaign_counter: Account<'info, CampaignCounter>,
    
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct CampaignCounter {
    pub count: u64,
}

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct InitializeCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign_counter"],
        bump,
    )]
    pub campaign_counter: Account<'info, CampaignCounter>,

    #[account(
        init,
        space = 8 + Campaign::INIT_SPACE,
        payer = creator,
        seeds = [b"campaign", campaign_counter.count.to_le_bytes().as_ref()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(
        init,
        payer = donor,
        space = 8 + Donation::INIT_SPACE,
        seeds = [b"donation", campaign.key().as_ref(), donor.key().as_ref()],
        bump
    )]
    pub donation: Account<'info, Donation>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        constraint = campaign.creator == creator.key()
    )]
    pub campaign: Account<'info, Campaign>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        constraint = donor.key() == donation.donor
    )]
    pub donor: Signer<'info>,
    #[account(
        mut,
        seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(
        mut,
        seeds = [b"donation", campaign.key().as_ref(), donor.key().as_ref()],
        bump = donation.bump,
        constraint = donation.campaign == campaign.key()
    )]
    pub donation: Account<'info, Donation>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub creator: Pubkey,
    pub id: u64,
    pub goal_amount: u64,
    pub end_time: i64,
    pub total_funded: u64,
    pub is_active: bool,
    pub bump: u8
}

#[account]
#[derive(InitSpace)]
pub struct Donation {
    pub donor: Pubkey,
    pub campaign: Pubkey,
    pub amount: u64,
    pub refunded: bool,
    pub bump: u8
}

#[error_code]
pub enum CrowdfundingError {
    #[msg("The campaign is not active")]
    CampaignInactive,
    #[msg("The campaign has ended")]
    CampaignEnded,
    #[msg("The campaign has not ended yet")]
    CampaignNotEnded,
    #[msg("You cant claim refund campaign is still active.")]
    CampaignIsStillActive,
    #[msg("The campaign was successful, no refunds allowed")]
    CampaignSuccessful,
    #[msg("You have been Refunded Already!")]
    AlreadyRefunded,
    #[msg("Invalid Donor!")]
    InvalidDonor,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid goal amount")]
    InvalidGoalAmount,
    #[msg("Invalid duration")]
    InvalidDuration,
    #[msg("Duration too long")]
    DurationTooLong,
    #[msg("Unauthorized")]
    Unauthorized,
}