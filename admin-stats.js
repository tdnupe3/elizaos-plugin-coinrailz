#!/usr/bin/env node

// Simple Node.js script to check platform statistics
// Usage: node admin-stats.js

const baseUrl = 'http://localhost:5000';

async function getStats() {
  try {
    console.log('🔍 Fetching Coin Railz Platform Statistics...\n');

    // Get user count
    const userResponse = await fetch(`${baseUrl}/api/analytics/admin-stats`, {
      headers: {
        'x-admin-key': 'admin-secret-key'
      }
    });
    
    if (!userResponse.ok) {
      console.log('❌ Unable to fetch admin stats. Using direct database queries...\n');
      
      // Alternative: Direct database queries
      console.log('📊 Platform Overview (from database):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // You can run these SQL queries directly in your database
      console.log('Run these queries in your PostgreSQL database:');
      console.log('');
      console.log('-- Total Users');
      console.log('SELECT COUNT(*) as total_users FROM users;');
      console.log('');
      console.log('-- Transaction Statistics');
      console.log('SELECT COUNT(*) as total_transactions, SUM(CAST(amount AS DECIMAL)) as total_volume, SUM(CAST(platform_fee AS DECIMAL)) as total_fees FROM transactions;');
      console.log('');
      console.log('-- Recent Signups');
      console.log('SELECT DATE(created_at) as signup_date, COUNT(*) as daily_signups FROM users GROUP BY DATE(created_at) ORDER BY signup_date DESC LIMIT 10;');
      console.log('');
      console.log('-- Referral Statistics');
      console.log('SELECT COUNT(*) as total_referrals FROM referrals;');
      
      return;
    }

    const stats = await userResponse.json();
    
    console.log('📊 Coin Railz Platform Statistics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 Total Users: ${stats.analytics?.users?.total || 0}`);
    console.log(`💰 Total Transaction Volume: $${stats.analytics?.transactions?.totalVolume || '0'}`);
    console.log(`📈 Total Transactions: ${stats.analytics?.transactions?.total || 0}`);
    console.log(`💵 Platform Revenue: $${stats.analytics?.transactions?.totalFeesCollected || '0'}`);
    console.log(`🔗 Active Referrers: ${stats.analytics?.referrals?.activeReferrers || 0}`);
    console.log(`🤖 AI Agents: ${stats.analytics?.aiAgents?.total || 0}`);
    console.log(`📊 Platform Status: ${stats.analytics?.summary?.platformHealth || 'Operational'}`);
    
    if (stats.analytics?.users?.dailySignups) {
      console.log('\n📅 Recent Daily Signups:');
      stats.analytics.users.dailySignups.slice(0, 7).forEach(day => {
        console.log(`   ${day.date}: ${day.signups} users`);
      });
    }
    
    console.log(`\n🕒 Last Updated: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error fetching statistics:', error.message);
    console.log('\n💡 Alternative: Access database directly with these commands:');
    console.log('   psql $DATABASE_URL -c "SELECT COUNT(*) as total_users FROM users;"');
    console.log('   psql $DATABASE_URL -c "SELECT COUNT(*) as total_transactions, SUM(CAST(amount AS DECIMAL)) as total_volume FROM transactions;"');
  }
}

getStats();