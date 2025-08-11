import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { storage } from '../storage';

const router = Router();

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const googleUser = {
      id: profile.id,
      email: profile.emails?.[0]?.value || null,
      firstName: profile.name?.givenName || null,
      lastName: profile.name?.familyName || null,
      profileImageUrl: profile.photos?.[0]?.value || null,
      displayName: profile.displayName || null
    };

    // Create user in database if doesn't exist
    let user = await storage.getUser(profile.id);
    if (!user) {
      user = await storage.upsertUser({
        id: profile.id,
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        profileImageUrl: googleUser.profileImageUrl,
        // Google OAuth users get basic KYC level (identity verified through Google)
        isKycVerified: true,
        kycLevel: 'basic',
        kycProvider: 'google'
      });
    }

    return done(null, {
      claims: {
        sub: profile.id,
        email: googleUser.email,
        first_name: googleUser.firstName,
        last_name: googleUser.lastName,
        profile_image_url: googleUser.profileImageUrl,
        display_name: googleUser.displayName
      },
      google: {
        accessToken,
        refreshToken,
        isVerified: true,
        kycLevel: 'basic' // Google provides identity verification
      }
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

// Google OAuth routes
router.get('/auth/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/auth?error=google_auth_failed' 
  }),
  async (req, res) => {
    try {
      // Store user in session with Google OAuth data
      req.session.user = req.user;
      req.session.kycStatus = {
        level: 'basic',
        provider: 'google',
        verifiedAt: new Date().toISOString(),
        features: {
          highLimitTransactions: false, // Basic KYC - limited features
          internationalTransfers: true,  // Google provides good identity verification
          advancedTrading: false,
          institutionalFeatures: false
        }
      };

      console.log('✅ Google OAuth login successful:', {
        userId: req.user?.claims?.sub,
        email: req.user?.claims?.email,
        kycLevel: 'basic'
      });

      // Redirect to dashboard or return URL
      const returnUrl = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      res.redirect(returnUrl);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/auth?error=session_creation_failed');
    }
  }
);

// Google logout
router.get('/auth/google/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Google logout error:', err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      res.redirect('/');
    });
  });
});

export { router as googleAuthRoutes };